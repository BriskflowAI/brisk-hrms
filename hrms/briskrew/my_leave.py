"""Leave > My data: the signed-in employee's own balances, requests and holidays.

Every function works on the caller's own Employee record only; nothing here takes an
employee argument. Balances and day counts come from Frappe HR's own leave functions, and
requests are created and withdrawn through the Leave Application document, so validations,
approvers and notifications behave exactly as in the classic desk.
"""

import frappe
from frappe import _
from frappe.utils import add_days, cint, date_diff, flt, getdate, nowdate, strip_html

from erpnext.setup.doctype.employee.employee import get_holiday_list_for_employee

from hrms.hr.doctype.leave_application.leave_application import (
	get_leave_details,
	get_leaves_for_period,
	get_number_of_leave_days,
	is_lwp,
)

REQUEST_FIELDS = [
	"name",
	"leave_type",
	"from_date",
	"to_date",
	"half_day",
	"half_day_date",
	"total_leave_days",
	"posting_date",
	"status",
	"docstatus",
	"description",
	"leave_approver",
	"leave_approver_name",
]


def _me():
	employee = frappe.db.get_value(
		"Employee",
		{"user_id": frappe.session.user, "status": "Active"},
		["name", "employee_name", "company"],
		as_dict=True,
	)
	if not employee:
		frappe.throw(_("Your user isn't linked to an active employee."), frappe.DoesNotExistError)
	return employee


def _period(company, from_date=None, to_date=None):
	if from_date and to_date:
		return getdate(from_date), getdate(to_date)
	today = getdate(nowdate())
	# The company's leave year when HR has set one up, else the calendar year.
	period = frappe.db.get_value(
		"Leave Period",
		{"company": company, "is_active": 1, "from_date": ("<=", today), "to_date": (">=", today)},
		["from_date", "to_date"],
		as_dict=True,
	)
	if period:
		return getdate(period.from_date), getdate(period.to_date)
	return getdate(f"{today.year}-01-01"), getdate(f"{today.year}-12-31")


@frappe.whitelist()
def summary(from_date: str | None = None, to_date: str | None = None) -> dict:
	"""Everything the Leave > My data screens show for one leave period."""
	me = _me()
	start, end = _period(me.company, from_date, to_date)
	if date_diff(end, start) < 0 or date_diff(end, start) > 731:
		frappe.throw(_("Pick a period of up to two years."))
	today = getdate(nowdate())

	# Withdrawn and cancelled requests stay in, so the history is complete.
	requests = frappe.get_list(
		"Leave Application",
		filters={"employee": me.name, "from_date": ("<=", end), "to_date": (">=", start)},
		fields=REQUEST_FIELDS,
		order_by="from_date desc",
		limit=500,
	)
	unpaid = set(frappe.get_all("Leave Type", filters={"is_lwp": 1}, pluck="name"))
	for r in requests:
		r.paid = r.leave_type not in unpaid
		r.can_withdraw = r.docstatus == 0 and r.status == "Open"

	return {
		"employee": me,
		"today": today,
		"period": {"from_date": start, "to_date": end},
		"balances": _balances(me.name, start, end, today, requests, unpaid),
		"requests": requests,
		"holidays": _holidays(me.name, start, end),
		"absent": _absent(me.name, start, min(end, today)),
	}


def _balances(employee, start, end, today, requests, unpaid):
	"""One card per leave type: Available and Booked, with Booked split into used and
	planned, plus what's waiting on the approver."""
	as_on = min(max(today, start), end)
	allocations = get_leave_details(employee, as_on)["leave_allocation"]
	cards = []
	for leave_type, a in allocations.items():
		allocation = frappe.db.get_value(
			"Leave Allocation",
			{
				"employee": employee,
				"leave_type": leave_type,
				"docstatus": 1,
				"from_date": ("<=", as_on),
				"to_date": (">=", as_on),
			},
			["from_date", "to_date"],
			as_dict=True,
		)
		used = 0
		if allocation and today > getdate(allocation.from_date):
			used = abs(
				flt(
					get_leaves_for_period(
						employee,
						leave_type,
						allocation.from_date,
						min(add_days(today, -1), allocation.to_date),
					)
				)
			)
		booked = flt(a["leaves_taken"])
		pending = flt(a["leaves_pending_approval"])
		cards.append(
			{
				"leave_type": leave_type,
				"paid": True,
				"allocated": flt(a["total_leaves"]),
				"used": min(used, booked),
				"planned": max(booked - used, 0),
				"pending": pending,
				"expired": flt(a["expired_leaves"]),
				# Frappe's balance ignores requests still waiting on the approver; counting them
				# here keeps people from asking for the same days twice.
				"available": flt(a["remaining_leaves"]) - pending,
				"valid_till": allocation.to_date if allocation else None,
			}
		)

	# Unpaid leave has no allocation; show it once someone has used or asked for it.
	for leave_type in sorted(unpaid):
		mine = [r for r in requests if r.leave_type == leave_type and r.docstatus < 2]
		if not mine:
			continue
		approved = [r for r in mine if r.docstatus == 1 and r.status == "Approved"]
		booked = sum(_days_within(employee, r, start, end) for r in approved)
		used = sum(_days_within(employee, r, start, min(end, add_days(today, -1))) for r in approved)
		cards.append(
			{
				"leave_type": leave_type,
				"paid": False,
				"allocated": None,
				"used": used,
				"planned": max(booked - used, 0),
				"pending": sum(r.total_leave_days for r in mine if r.status == "Open"),
				"expired": 0,
				"available": None,
				"valid_till": None,
			}
		)
	return cards


def _days_within(employee, request, start, end):
	"""Days of an approved request that fall between start and end, as Frappe counts them."""
	lo, hi = max(getdate(request.from_date), start), min(getdate(request.to_date), end)
	if lo > hi:
		return 0
	if lo == getdate(request.from_date) and hi == getdate(request.to_date):
		return flt(request.total_leave_days)
	half = request.half_day and request.half_day_date and lo <= getdate(request.half_day_date) <= hi
	return flt(
		get_number_of_leave_days(
			employee,
			request.leave_type,
			lo,
			hi,
			half_day=1 if half else 0,
			half_day_date=request.half_day_date if half else None,
		)
	)


def _holiday_rows(employee, start, end, weekly_offs=False):
	holiday_list = get_holiday_list_for_employee(employee, raise_exception=False, as_on=start)
	if not holiday_list:
		return []
	filters = {"parent": holiday_list, "holiday_date": ("between", [start, end])}
	if not weekly_offs:
		filters["weekly_off"] = 0
	# The employee's own holiday list; plain employees can't read Holiday List itself.
	return frappe.get_all(
		"Holiday",
		filters=filters,
		fields=["holiday_date", "description", "weekly_off"],
		order_by="holiday_date asc",
	)


def _holidays(employee, start, end):
	return [
		{"date": h.holiday_date, "name": strip_html(h.description or "").strip()}
		for h in _holiday_rows(employee, start, end)
	]


def _absent(employee, start, end):
	"""Days marked absent with no leave behind them, so the person can apply leave for them."""
	if start > end:
		return []
	return frappe.get_list(
		"Attendance",
		filters={
			"employee": employee,
			"docstatus": 1,
			"status": "Absent",
			"attendance_date": ("between", [start, end]),
			"leave_application": ("is", "not set"),
		},
		fields=["attendance_date"],
		order_by="attendance_date desc",
		pluck="attendance_date",
		limit=100,
	)


@frappe.whitelist()
def leave_types() -> list[str]:
	"""Leave types the employee can apply for today: those with an allocation, plus unpaid."""
	me = _me()
	details = get_leave_details(me.name, nowdate())
	return list(details["leave_allocation"]) + details["lwps"]


@frappe.whitelist()
def preview(
	leave_type: str,
	from_date: str,
	to_date: str,
	half_day: int = 0,
	half_day_date: str | None = None,
) -> dict:
	"""The Apply Leave side panel: the days asked for and the balance before and after."""
	me = _me()
	if not frappe.db.exists("Leave Type", leave_type):
		frappe.throw(_("Pick a leave type."))
	start, end = getdate(from_date), getdate(to_date)
	if end < start:
		frappe.throw(_("The end date is before the start date."))
	if date_diff(end, start) > 366:
		frappe.throw(_("A leave request can cover at most a year."))
	half_day = cint(half_day)
	if half_day and start != end and not half_day_date:
		half_day_date = start

	days = flt(get_number_of_leave_days(me.name, leave_type, start, end, half_day, half_day_date))
	off = {h.holiday_date: h for h in _holiday_rows(me.name, start, end, weekly_offs=True)}
	include_holidays = cint(frappe.db.get_value("Leave Type", leave_type, "include_holiday"))
	day_rows = []
	for i in range(date_diff(end, start) + 1):
		d = add_days(start, i)
		h = off.get(d)
		day_rows.append(
			{
				"date": d,
				"off": None
				if include_holidays or not h
				else ("weekly_off" if h.weekly_off else strip_html(h.description or "")),
				"half": bool(half_day) and (start == end or getdate(half_day_date) == d),
			}
		)

	balance = None
	if not is_lwp(leave_type):
		allocation = get_leave_details(me.name, start)["leave_allocation"].get(leave_type)
		if allocation:
			available = flt(allocation["remaining_leaves"]) - flt(allocation["leaves_pending_approval"])
			balance = {"as_on": start, "available": available, "after": available - days}

	return {
		"days": days,
		"day_rows": day_rows,
		"paid": not is_lwp(leave_type),
		"balance": balance,
		"approver": _approver(me.name),
	}


def _approver(employee):
	from hrms.briskrew.approvers import get_request_approver

	user = get_request_approver("Leave Application", employee)
	if not user:
		return None
	return {"user": user, "name": frappe.db.get_value("User", user, "full_name") or user}


@frappe.whitelist(methods=["POST"])
def apply(
	leave_type: str,
	from_date: str,
	to_date: str,
	half_day: int = 0,
	half_day_date: str | None = None,
	reason: str | None = None,
) -> str:
	"""Send a leave request to the approver. Frappe's own validation decides whether it's allowed."""
	me = _me()
	half_day = cint(half_day)
	if half_day and getdate(from_date) != getdate(to_date) and not half_day_date:
		half_day_date = from_date
	doc = frappe.get_doc(
		{
			"doctype": "Leave Application",
			"employee": me.name,
			"company": me.company,
			"leave_type": leave_type,
			"from_date": from_date,
			"to_date": to_date,
			"half_day": half_day,
			"half_day_date": half_day_date if half_day else None,
			"description": reason,
			"status": "Open",
			"posting_date": nowdate(),
		}
	).insert()
	return doc.name


@frappe.whitelist(methods=["POST"])
def withdraw(name: str) -> None:
	"""Take back a request the approver hasn't decided yet."""
	me = _me()
	doc = frappe.get_doc("Leave Application", name)
	# Someone else's request reads as missing, the same as a name that doesn't exist.
	if doc.employee != me.name:
		raise frappe.DoesNotExistError(_("Leave Application {0} not found").format(name))
	if doc.docstatus != 0 or doc.status != "Open":
		frappe.throw(_("Only a request still waiting on the approver can be withdrawn."))
	doc.discard()
