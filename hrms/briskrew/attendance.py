"""Checking in and out from briskrew, who's in today, and attendance for everyone from check-ins.

Check-ins are Frappe HR's own Employee Checkin records, so the employee app, biometric devices
and briskrew all feed the same log. Attendance is marked by Frappe HR's Auto Attendance (the
hourly Shift Type job) from those logs; `apply_attendance_setup` turns it on for everyone with a
default shift. Each endpoint reads only what the user may read.
"""

import calendar
import html
from datetime import datetime, time, timedelta

import frappe
from frappe import _
from frappe.utils import (
	add_days,
	add_years,
	cint,
	escape_html,
	flt,
	get_datetime,
	get_time,
	getdate,
	now_datetime,
	nowdate,
)

# The flexible shift everyone without a shift of their own works (set up with HR, Nov 2026):
# check in at any time of the day, Monday to Saturday. Every hour clocked is recorded; a day
# under 3 hours is absent, and a day under 9 hours is flagged short. Nobody is late or early.
SHIFT = "Flexible hours"
LEGACY_SHIFT = "Standard 10:00-19:00"
TARGET_HOURS = 9
NOTE_MAX_LENGTH = 500
SHIFT_SETTINGS = {
	"start_time": "00:00:00",
	"end_time": "23:59:00",
	"enable_auto_attendance": 1,
	"auto_update_last_sync": 1,
	"determine_check_in_and_check_out": "Strictly based on Log Type in Employee Checkin",
	"working_hours_calculation_based_on": "First Check-in and Last Check-out",
	# 0 turns the half day off: a day is either present (3 hours or more) or absent.
	"working_hours_threshold_for_half_day": 0,
	"working_hours_threshold_for_absent": 3,
	"enable_late_entry_marking": 0,
	"enable_early_exit_marking": 0,
	# The shift is the whole day, and Frappe refuses a window that overlaps the next day's, so
	# logs count on the day they are made.
	"begin_check_in_before_shift_start_time": 0,
	"allow_check_out_after_shift_end_time": 0,
	"mark_auto_attendance_on_holidays": 0,
}
WEEKLY_OFF = "Sunday"
HR_ROLES = {"HR Manager", "HR User", "System Manager"}
SETUP_ROLES = ("HR Manager", "System Manager")


# ---------------------------------------------------------------------------------------
# My check-in
# ---------------------------------------------------------------------------------------


@frappe.whitelist()
def my_checkin() -> dict:
	"""The current user's check-in state for today: what they can do next, their logs and hours."""
	employee = _my_employee()
	if not employee:
		return {"employee": None}

	now = now_datetime()
	logs = _logs_between([employee.name], _day_start(now.date()), now).get(employee.name, [])
	shift = _shift_for(employee.name, now)
	attendance = frappe.db.get_value(
		"Attendance",
		{"employee": employee.name, "attendance_date": now.date(), "docstatus": 1},
		["status"],
		as_dict=True,
	)
	hours = _hours_worked(logs, now)
	open_in = logs[-1] if logs and logs[-1].log_type == "IN" else None
	return {
		"employee": employee.name,
		"employee_name": employee.employee_name,
		"next": "OUT" if logs and logs[-1].log_type == "IN" else "IN",
		"logs": logs,
		"hours": hours,
		# Counted on the server, so the screen's timer doesn't depend on the phone's clock or zone.
		"since_seconds": int((now - get_datetime(open_in.time)).total_seconds()) if open_in else None,
		"target_hours": TARGET_HOURS,
		"short": _is_short(hours, logs, now.date(), now),
		"working_on": _working_on(logs),
		"shift": shift,
		"attendance": attendance,
		"needs_location": bool(frappe.db.get_single_value("HR Settings", "allow_geolocation_tracking")),
	}


@frappe.whitelist(methods=["POST"])
def check(
	log_type: str,
	latitude: float | None = None,
	longitude: float | None = None,
	note: str | None = None,
) -> dict:
	"""Check the current user in or out now, with where they are when location is recorded and,
	optionally, what they are working on."""
	if log_type not in ("IN", "OUT"):
		frappe.throw(_("Choose to check in or check out."))
	note = (note or "").strip()
	if len(note) > NOTE_MAX_LENGTH:
		frappe.throw(_("Keep what you're working on under {0} characters.").format(NOTE_MAX_LENGTH))
	employee = _my_employee()
	if not employee:
		frappe.throw(_("Your user isn't linked to an employee record, so you can't check in."))

	doc = frappe.new_doc("Employee Checkin")
	doc.update(
		{
			"employee": employee.name,
			"log_type": log_type,
			"time": now_datetime(),
			"device_id": "briskrew",
		}
	)
	if latitude is not None and longitude is not None:
		doc.latitude = flt(latitude)
		doc.longitude = flt(longitude)
	# Frappe HR's own rules apply: location when it's required, the shift's check-in radius,
	# no two logs at the same time.
	doc.insert()
	if note:
		# A standard comment on the check-in: no schema change, and it shows in the desk timeline too.
		# Stored as escaped text, since comments render as HTML there.
		frappe.get_doc(
			{
				"doctype": "Comment",
				"comment_type": "Comment",
				"reference_doctype": "Employee Checkin",
				"reference_name": doc.name,
				"content": escape_html(note),
			}
		).insert(ignore_permissions=True)
	return my_checkin()


# ---------------------------------------------------------------------------------------
# Who's in
# ---------------------------------------------------------------------------------------


@frappe.whitelist()
def team_day(date: str | None = None, company: str | None = None, department: str | None = None) -> dict:
	"""Everyone the user may see, for one day: checked in, late, out, on leave, off or not in."""
	day = getdate(date or nowdate())
	employees = _visible_employees(company, department, day)
	names = [e.name for e in employees]
	now = now_datetime()
	end = min(_day_start(add_days(day, 1)), now) if day >= now.date() else _day_start(add_days(day, 1))
	logs = _logs_between(names, _day_start(day), end)
	shifts = _shifts_on(names, day)
	leave = _leave_on(names, day)
	attendance = _attendance_between(names, day, day)
	holidays = _holidays_between(employees, shifts, day, day)

	rows = []
	for e in employees:
		elogs = logs.get(e.name, [])
		shift = shifts.get(e.name)
		marked = attendance.get((e.name, day))
		first_in = next((log.time for log in elogs if log.log_type == "IN"), None)
		last_out = next((log.time for log in reversed(elogs) if log.log_type == "OUT"), None)
		hours = _hours_worked(elogs, end)
		status = _day_status(
			day, now, elogs, shift, leave.get(e.name), marked, day in holidays.get(e.name, set())
		)
		location = next((log for log in elogs if log.latitude and log.longitude), None)
		rows.append(
			{
				"employee": e.name,
				"employee_name": e.employee_name,
				"department": e.department,
				"designation": e.designation,
				"image": e.image,
				"status": status,
				"first_in": first_in,
				"last_out": last_out,
				"hours": hours,
				"short": _is_short(hours, elogs, day, now),
				"working_on": _working_on(elogs),
				"shift": shift and shift.name,
				"leave_type": (leave.get(e.name) or {}).get("leave_type") or (marked and marked.leave_type),
				"location": location and {"latitude": location.latitude, "longitude": location.longitude},
			}
		)

	order = {"in": 0, "out": 1, "not_in": 2, "absent": 3, "leave": 4, "off": 5, "not_yet": 6}
	rows.sort(key=lambda r: (order.get(r["status"], 9), r["employee_name"] or ""))
	summary = {}
	for r in rows:
		summary[r["status"]] = summary.get(r["status"], 0) + 1
	summary["short"] = sum(1 for r in rows if r["short"])
	return {"date": str(day), "rows": rows, "summary": summary, **_filters_payload()}


@frappe.whitelist()
def team_month(month: str | None = None, company: str | None = None, department: str | None = None) -> dict:
	"""A month of attendance for everyone the user may see: one cell per person per day."""
	first = getdate(f"{month}-01") if month else getdate(nowdate()).replace(day=1)
	last = first.replace(day=calendar.monthrange(first.year, first.month)[1])
	employees = _visible_employees(company, department, last)
	names = [e.name for e in employees]
	attendance = _attendance_between(names, first, last)
	shifts = {}
	for d in range(last.day):
		day = add_days(first, d)
		for name, shift in _shifts_on(names, day).items():
			shifts.setdefault(name, shift)
	holidays = _holidays_between(employees, shifts, first, last)
	today = getdate(nowdate())

	codes = {
		"Present": "P",
		"Absent": "A",
		"Half Day": "H",
		"On Leave": "L",
		"Work From Home": "W",
	}
	rows = []
	for e in employees:
		cells, totals = [], {"P": 0, "A": 0, "H": 0, "L": 0, "W": 0, "short": 0}
		for d in range(last.day):
			day = add_days(first, d)
			marked = attendance.get((e.name, day))
			if marked:
				code = codes.get(marked.status, "")
				totals[code] = totals.get(code, 0) + 1
				short = marked.status == "Present" and 0 < flt(marked.working_hours) < TARGET_HOURS
				totals["short"] += 1 if short else 0
				cells.append({"code": code, "short": short, "hours": flt(marked.working_hours)})
			elif day in holidays.get(e.name, set()):
				cells.append({"code": "off"})
			elif e.date_of_joining and day < getdate(e.date_of_joining):
				cells.append({"code": "-"})
			else:
				cells.append({"code": "" if day >= today else "?"})
		rows.append(
			{
				"employee": e.name,
				"employee_name": e.employee_name,
				"department": e.department,
				"image": e.image,
				"cells": cells,
				"totals": totals,
			}
		)
	return {
		"month": first.strftime("%Y-%m"),
		"days": [
			{"date": str(add_days(first, d)), "weekday": add_days(first, d).strftime("%a")}
			for d in range(last.day)
		],
		"rows": rows,
		**_filters_payload(),
	}


# ---------------------------------------------------------------------------------------
# Setting attendance up for everyone
# ---------------------------------------------------------------------------------------


@frappe.whitelist()
def attendance_setup_status() -> dict:
	"""What's in place for check-ins and automatic attendance, and what setting up would change."""
	if not _can_set_up():
		return {"can_set_up": False}
	hr = frappe.get_single("HR Settings")
	shift = frappe.db.get_value(
		"Shift Type",
		SHIFT,
		["enable_auto_attendance", "holiday_list", "process_attendance_after"],
		as_dict=True,
	)
	active = frappe.get_all(
		"Employee", filters={"status": "Active"}, fields=["name", "default_shift", "user_id"]
	)
	assigned = set(_assigned_today([e.name for e in active]))
	without_shift = [
		e.name
		for e in active
		if (not e.default_shift or e.default_shift == LEGACY_SHIFT) and e.name not in assigned
	]
	without_user = [e.name for e in active if not e.user_id]
	steps = {
		"app_checkin": bool(hr.allow_employee_checkin_from_mobile_app),
		"location": bool(hr.allow_geolocation_tracking),
		"shift": bool(shift and shift.enable_auto_attendance),
		"holidays": bool(shift and shift.holiday_list),
		"everyone_has_shift": not without_shift,
	}
	return {
		"can_set_up": True,
		"done": all(steps.values()),
		"steps": steps,
		"shift": SHIFT,
		"shift_settings": {
			"start": SHIFT_SETTINGS["start_time"][:5],
			"end": SHIFT_SETTINGS["end_time"][:5],
			"weekly_off": WEEKLY_OFF,
			"target_hours": TARGET_HOURS,
			"absent_below": SHIFT_SETTINGS["working_hours_threshold_for_absent"],
		},
		"process_attendance_after": shift and shift.process_attendance_after,
		"employees": len(active),
		"without_shift": len(without_shift),
		"without_user": len(without_user),
	}


@frappe.whitelist(methods=["POST"])
def apply_attendance_setup() -> dict:
	"""Turn on check-ins and automatic attendance for everyone (safe to run again).

	- Employees may check in from briskrew and the employee app, with their location.
	- A Monday-to-Saturday holiday list for this year and next, with the company's own holidays.
	- The standard shift with Auto Attendance from today (nothing earlier is marked).
	- Active employees with no shift of their own get it as their default shift; existing default
	  shifts and shift assignments are left alone.
	"""
	frappe.only_for(SETUP_ROLES)

	hr = frappe.get_single("HR Settings")
	hr.allow_employee_checkin_from_mobile_app = 1
	hr.allow_geolocation_tracking = 1
	hr.save()

	holiday_list = _ensure_holiday_list()

	if frappe.db.exists("Shift Type", SHIFT):
		shift = frappe.get_doc("Shift Type", SHIFT)
	else:
		shift = frappe.new_doc("Shift Type")
		shift.set("__newname", SHIFT)
	shift.update(SHIFT_SETTINGS)
	shift.holiday_list = holiday_list
	# Attendance starts today: earlier days without check-ins must not turn into absences.
	shift.process_attendance_after = shift.process_attendance_after or nowdate()
	if shift.is_new():
		shift.insert()
	else:
		shift.save()

	active = frappe.get_all("Employee", filters={"status": "Active"}, fields=["name", "default_shift"])
	assigned = set(_assigned_today([e.name for e in active]))
	given = 0
	for e in active:
		# The earlier fixed 10-19 shift was this setup's own default, so those people move over.
		if (not e.default_shift or e.default_shift == LEGACY_SHIFT) and e.name not in assigned:
			frappe.db.set_value("Employee", e.name, "default_shift", SHIFT)
			given += 1

	result = attendance_setup_status()
	result["given_shift"] = given
	return result


def _ensure_holiday_list() -> str:
	"""Mondays to Saturdays as working days from 1 January this year to 31 December next year,
	with the default company's own (non weekly-off) holidays copied in."""
	start = getdate(nowdate()).replace(month=1, day=1)
	end = add_days(add_years(start, 2), -1)
	name = f"briskrew Mon-Sat {start.year}-{end.year}"
	if frappe.db.exists("Holiday List", name):
		return name

	doc = frappe.new_doc("Holiday List")
	doc.holiday_list_name = name
	doc.from_date = start
	doc.to_date = end
	doc.weekly_off = WEEKLY_OFF
	doc.get_weekly_off_dates()

	company = frappe.defaults.get_global_default("company")
	source = company and frappe.db.get_value("Company", company, "default_holiday_list")
	if source:
		existing = {getdate(h.holiday_date) for h in doc.holidays}
		for h in frappe.get_all(
			"Holiday",
			filters={
				"parent": source,
				"parenttype": "Holiday List",
				"weekly_off": 0,
				"holiday_date": ["between", [start, end]],
			},
			fields=["holiday_date", "description"],
		):
			if getdate(h.holiday_date) not in existing:
				doc.append("holidays", {"holiday_date": h.holiday_date, "description": h.description})
	doc.insert()
	return doc.name


# ---------------------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------------------


def _my_employee():
	return frappe.db.get_value(
		"Employee",
		{"user_id": frappe.session.user, "status": "Active"},
		["name", "employee_name", "company"],
		as_dict=True,
	)


def _can_set_up() -> bool:
	return bool(set(frappe.get_roles()) & set(SETUP_ROLES))


def _visible_employees(company, department, as_on):
	"""HR sees everyone they may read; anyone else sees themselves and the people under them."""
	fields = [
		"name",
		"employee_name",
		"department",
		"designation",
		"image",
		"company",
		"holiday_list",
		"default_shift",
		"date_of_joining",
		"lft",
		"rgt",
	]
	filters = {"status": "Active"}
	if company:
		filters["company"] = company
	if department:
		filters["department"] = department
	if set(frappe.get_roles()) & HR_ROLES:
		employees = frappe.get_list("Employee", filters=filters, fields=fields, order_by="employee_name")
	else:
		me = frappe.db.get_value(
			"Employee", {"user_id": frappe.session.user}, ["name", "lft", "rgt"], as_dict=True
		)
		if not me:
			return []
		# The reporting tree: everyone whose manager chain leads to me.
		employees = frappe.get_all(
			"Employee",
			filters={**filters, "lft": [">=", me.lft], "rgt": ["<=", me.rgt]},
			fields=fields,
			order_by="employee_name",
		)
	return [e for e in employees if not e.date_of_joining or getdate(e.date_of_joining) <= as_on]


def _day_start(day) -> datetime:
	return datetime.combine(getdate(day), time.min)


def _logs_between(employees, start, end) -> dict:
	if not employees:
		return {}
	out = {}
	for log in frappe.get_all(
		"Employee Checkin",
		filters={"employee": ["in", employees], "time": ["between", [start, end]]},
		fields=["name", "employee", "log_type", "time", "latitude", "longitude", "device_id"],
		order_by="time asc",
	):
		out.setdefault(log.employee, []).append(log)
	notes = _notes_for([log.name for logs in out.values() for log in logs])
	for logs in out.values():
		for log in logs:
			log["note"] = notes.get(log.name)
	return out


def _notes_for(check_ins) -> dict:
	"""What people said they were working on, by check-in (the latest comment wins)."""
	if not check_ins:
		return {}
	return {
		c.reference_name: html.unescape(c.content)
		for c in frappe.get_all(
			"Comment",
			filters={
				"reference_doctype": "Employee Checkin",
				"reference_name": ["in", check_ins],
				"comment_type": "Comment",
			},
			fields=["reference_name", "content"],
			order_by="creation asc",
		)
	}


def _working_on(logs) -> str | None:
	"""The note from the most recent check-in that has one."""
	return next((log.note for log in reversed(logs) if log.log_type == "IN" and log.note), None)


def _hours_worked(logs, until) -> float:
	"""Hours between each check-in and the check-out after it; an open check-in counts to now."""
	total, started = 0.0, None
	for log in logs:
		if log.log_type == "IN" and started is None:
			started = get_datetime(log.time)
		elif log.log_type == "OUT" and started is not None:
			total += (get_datetime(log.time) - started).total_seconds()
			started = None
	if started is not None and get_datetime(until) > started:
		total += (get_datetime(until) - started).total_seconds()
	return round(total / 3600, 2)


def _shift_for(employee, when):
	from hrms.hr.doctype.shift_assignment.shift_assignment import get_employee_shift

	details = get_employee_shift(employee, get_datetime(when), consider_default_shift=True)
	shift_type = details and details.get("shift_type")
	if not shift_type:
		return None
	return frappe._dict(
		name=shift_type.name,
		start=details.start_datetime,
		end=details.end_datetime,
		grace=cint(shift_type.late_entry_grace_period) if shift_type.enable_late_entry_marking else 0,
	)


def _shifts_on(employees, day) -> dict:
	"""Each employee's shift on a day: an active assignment, else their default shift."""
	if not employees:
		return {}
	by_employee = {}
	for a in frappe.get_all(
		"Shift Assignment",
		filters={
			"employee": ["in", employees],
			"docstatus": 1,
			"status": "Active",
			"start_date": ["<=", day],
		},
		fields=["employee", "shift_type", "end_date"],
		order_by="start_date desc",
	):
		if not a.end_date or getdate(a.end_date) >= day:
			by_employee.setdefault(a.employee, a.shift_type)
	for e in frappe.get_all(
		"Employee",
		filters={"name": ["in", employees], "default_shift": ["is", "set"]},
		fields=["name", "default_shift"],
	):
		by_employee.setdefault(e.name, e.default_shift)

	types = {
		t.name: t
		for t in frappe.get_all(
			"Shift Type",
			filters={"name": ["in", list(set(by_employee.values()))]},
			fields=[
				"name",
				"start_time",
				"end_time",
				"holiday_list",
				"enable_late_entry_marking",
				"late_entry_grace_period",
			],
		)
	}
	out = {}
	for employee, name in by_employee.items():
		t = types.get(name)
		if not t:
			continue
		start = datetime.combine(day, get_time(t.start_time))
		end = datetime.combine(day, get_time(t.end_time))
		if end <= start:
			end += timedelta(days=1)
		out[employee] = frappe._dict(
			name=t.name,
			start=start,
			end=end,
			holiday_list=t.holiday_list,
			grace=cint(t.late_entry_grace_period) if t.enable_late_entry_marking else 0,
		)
	return out


def _assigned_today(employees) -> list:
	if not employees:
		return []
	today = getdate(nowdate())
	return [
		a.employee
		for a in frappe.get_all(
			"Shift Assignment",
			filters={
				"employee": ["in", employees],
				"docstatus": 1,
				"status": "Active",
				"start_date": ["<=", today],
			},
			fields=["employee", "end_date"],
		)
		if not a.end_date or getdate(a.end_date) >= today
	]


def _is_short(hours, logs, day, now) -> bool:
	"""Hours were clocked but fewer than the target. Today is only short once the person is out:
	someone still checked in has not finished the day."""
	if not logs or hours >= TARGET_HOURS:
		return False
	return day < now.date() or logs[-1].log_type == "OUT"


def _leave_on(employees, day) -> dict:
	if not employees:
		return {}
	return {
		la.employee: la
		for la in frappe.get_all(
			"Leave Application",
			filters={
				"employee": ["in", employees],
				"docstatus": 1,
				"status": "Approved",
				"from_date": ["<=", day],
				"to_date": [">=", day],
			},
			fields=["employee", "leave_type", "half_day", "half_day_date"],
		)
	}


def _attendance_between(employees, start, end) -> dict:
	if not employees:
		return {}
	return {
		(a.employee, getdate(a.attendance_date)): a
		for a in frappe.get_all(
			"Attendance",
			filters={
				"employee": ["in", employees],
				"docstatus": 1,
				"attendance_date": ["between", [start, end]],
			},
			fields=["employee", "attendance_date", "status", "working_hours", "leave_type"],
		)
	}


def _holidays_between(employees, shifts, start, end) -> dict:
	"""Days off per employee: their shift's holiday list, else their own assigned one."""
	from hrms.utils.holiday_list import get_holiday_list_for_employee

	lists = {}
	for e in employees:
		shift = shifts.get(e.name)
		lists[e.name] = (shift and shift.holiday_list) or get_holiday_list_for_employee(
			e.name, raise_exception=False, as_on=end
		)
	dates = {}
	wanted = [x for x in set(lists.values()) if x]
	if wanted:
		for h in frappe.get_all(
			"Holiday",
			filters={"parent": ["in", wanted], "holiday_date": ["between", [start, end]]},
			fields=["parent", "holiday_date"],
		):
			dates.setdefault(h.parent, set()).add(getdate(h.holiday_date))
	return {name: dates.get(hl, set()) for name, hl in lists.items()}


def _day_status(day, now, logs, shift, leave, marked, holiday) -> str:
	if logs:
		return "in" if logs[-1].log_type == "IN" and day == now.date() else "out"
	if marked:
		return {"Absent": "absent", "On Leave": "leave", "Half Day": "out", "Work From Home": "out"}.get(
			marked.status, "out"
		)
	if leave and not leave.half_day:
		return "leave"
	if holiday:
		return "off"
	if day > now.date() or (day == now.date() and shift and now < shift.start):
		return "not_yet"
	return "not_in" if day == now.date() else "absent"


def _filters_payload() -> dict:
	return {
		"companies": frappe.get_list("Company", pluck="name", order_by="name"),
		"departments": frappe.get_list("Department", filters={"is_group": 0}, pluck="name", order_by="name"),
		"can_set_up": _can_set_up(),
	}
