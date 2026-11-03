from datetime import datetime, time, timedelta

import frappe
from frappe.utils import add_days, getdate, now_datetime

from erpnext.setup.doctype.employee.test_employee import make_employee

from hrms.briskrew.attendance import (
	LEGACY_SHIFT,
	SHIFT,
	apply_attendance_setup,
	attendance_setup_status,
	check,
	my_checkin,
	team_day,
	team_month,
)
from hrms.tests.utils import HRMSTestSuite

COMPANY = "_Test Company"


def _last_working_day(before_days=2):
	"""A recent Monday-to-Saturday date, before today."""
	day = getdate(add_days(now_datetime().date(), -before_days))
	while day.weekday() == 6:  # Sunday is the weekly off
		day = add_days(day, -1)
	return getdate(day)


class TestBriskrewAttendance(HRMSTestSuite):
	def setUp(self):
		frappe.set_user("Administrator")
		self.addCleanup(frappe.set_user, "Administrator")
		self.user = "checkin_member@example.com"
		self.employee = make_employee(self.user, COMPANY)
		frappe.get_doc("User", self.user).add_roles("Employee")

	def _log(self, employee, log_type, when):
		return frappe.get_doc(
			{
				"doctype": "Employee Checkin",
				"employee": employee,
				"log_type": log_type,
				"time": when,
				"latitude": 12.97,
				"longitude": 77.59,
			}
		).insert(ignore_permissions=True)

	def test_check_in_and_out_as_the_employee(self):
		frappe.db.set_single_value("HR Settings", "allow_geolocation_tracking", 0)
		frappe.set_user(self.user)
		state = my_checkin()
		self.assertEqual(state["employee"], self.employee)
		self.assertEqual(state["next"], "IN")

		state = check("IN")
		self.assertEqual(state["next"], "OUT")
		self.assertEqual([log.log_type for log in state["logs"]], ["IN"])
		self.assertEqual(
			frappe.db.get_value("Employee Checkin", state["logs"][0].name, "device_id"), "briskrew"
		)

		state = check("OUT")
		self.assertEqual(state["next"], "IN")
		self.assertEqual([log.log_type for log in state["logs"]], ["IN", "OUT"])

	def test_a_check_in_can_say_what_the_person_is_working_on(self):
		frappe.db.set_single_value("HR Settings", "allow_geolocation_tracking", 0)
		frappe.set_user(self.user)
		note = "Reviewing the Q3 <b>filing</b> & tests"
		state = check("IN", note=f"  {note}  ")

		self.assertEqual(state["logs"][0]["note"], note)
		self.assertEqual(state["working_on"], note)
		stored = frappe.db.get_value(
			"Comment",
			{"reference_doctype": "Employee Checkin", "reference_name": state["logs"][0].name},
			"content",
		)
		self.assertNotIn("<b>", stored)  # kept as text, so the desk timeline can't render markup

		state = check("OUT")
		self.assertIsNone(state["logs"][1]["note"])
		self.assertEqual(state["working_on"], note)

		frappe.set_user("Administrator")
		row = next(r for r in team_day(company=COMPANY)["rows"] if r["employee"] == self.employee)
		self.assertEqual(row["working_on"], note)

	def test_a_blank_or_oversized_note(self):
		frappe.db.set_single_value("HR Settings", "allow_geolocation_tracking", 0)
		frappe.set_user(self.user)
		state = check("IN", note="   ")
		self.assertIsNone(state["logs"][0]["note"])
		self.assertIsNone(state["working_on"])
		check("OUT")
		self.assertRaises(frappe.ValidationError, check, "IN", note="x" * 501)

	def test_location_is_required_when_tracked(self):
		frappe.db.set_single_value("HR Settings", "allow_geolocation_tracking", 1)
		frappe.set_user(self.user)
		self.assertRaises(frappe.ValidationError, check, "IN")
		state = check("IN", latitude=12.9716, longitude=77.5946)
		log = frappe.db.get_value(
			"Employee Checkin", state["logs"][0].name, ["latitude", "longitude"], as_dict=True
		)
		self.assertAlmostEqual(log.latitude, 12.9716, places=3)
		self.assertTrue(state["needs_location"])

	def test_a_user_without_an_employee_cannot_check_in(self):
		self.assertIsNone(my_checkin()["employee"])
		self.assertRaises(frappe.ValidationError, check, "IN")

	def test_hours_count_an_open_check_in_until_now(self):
		now = now_datetime()
		self._log(self.employee, "IN", now - timedelta(hours=3))
		self._log(self.employee, "OUT", now - timedelta(hours=2))
		self._log(self.employee, "IN", now - timedelta(minutes=30))
		frappe.set_user(self.user)
		state = my_checkin()
		self.assertEqual(state["next"], "OUT")
		self.assertAlmostEqual(state["hours"], 1.5, delta=0.05)

	def test_setup_gives_the_standard_shift_only_to_people_without_one(self):
		frappe.get_doc(
			{"doctype": "Shift Type", "name": "_Test Night", "start_time": "22:00:00", "end_time": "06:00:00"}
		).insert()
		has_shift = make_employee("checkin_has_shift@example.com", COMPANY)
		frappe.db.set_value("Employee", has_shift, "default_shift", "_Test Night")

		result = apply_attendance_setup()
		self.assertTrue(result["done"])
		self.assertEqual(frappe.db.get_value("Employee", self.employee, "default_shift"), SHIFT)
		self.assertEqual(frappe.db.get_value("Employee", has_shift, "default_shift"), "_Test Night")

		hr = frappe.get_single("HR Settings")
		self.assertTrue(hr.allow_employee_checkin_from_mobile_app)
		self.assertTrue(hr.allow_geolocation_tracking)

		shift = frappe.get_doc("Shift Type", SHIFT)
		self.assertEqual(str(shift.start_time), "0:00:00")
		self.assertEqual(str(shift.end_time), "23:59:00")
		self.assertTrue(shift.enable_auto_attendance)
		self.assertEqual(shift.working_hours_threshold_for_half_day, 0)
		self.assertEqual(shift.working_hours_threshold_for_absent, 3)
		self.assertFalse(shift.enable_late_entry_marking)
		self.assertFalse(shift.enable_early_exit_marking)
		self.assertEqual(getdate(shift.process_attendance_after), getdate(now_datetime().date()))

		# Sundays off, Saturdays worked
		days_off = {
			getdate(h.holiday_date).weekday()
			for h in frappe.get_all(
				"Holiday", filters={"parent": shift.holiday_list, "weekly_off": 1}, fields=["holiday_date"]
			)
		}
		self.assertEqual(days_off, {6})

		# Running it again changes nothing
		self.assertEqual(apply_attendance_setup()["given_shift"], 0)

	def test_setup_is_for_hr_managers(self):
		frappe.set_user(self.user)
		self.assertFalse(attendance_setup_status()["can_set_up"])
		self.assertRaises(frappe.PermissionError, apply_attendance_setup)

	def test_auto_attendance_from_check_ins(self):
		apply_attendance_setup()
		day = _last_working_day()
		people = {
			"full": self.employee,
			"early": make_employee("checkin_early@example.com", COMPANY),
			"late": make_employee("checkin_late@example.com", COMPANY),
			"short": make_employee("checkin_short@example.com", COMPANY),
			"absent": make_employee("checkin_absent@example.com", COMPANY),
		}
		for name in people.values():
			frappe.db.set_value(
				"Employee", name, {"default_shift": SHIFT, "date_of_joining": add_days(day, -30)}
			)

		def at(h, m):
			return datetime.combine(day, time(h, m))

		self._log(people["full"], "IN", at(10, 0))
		self._log(people["full"], "OUT", at(19, 0))  # 9 hours
		self._log(people["early"], "IN", at(5, 30))
		self._log(people["early"], "OUT", at(14, 30))  # 9 hours, long before 10:00
		self._log(people["late"], "IN", at(14, 0))
		self._log(people["late"], "OUT", at(23, 30))  # 9.5 hours, long after 19:00
		self._log(people["short"], "IN", at(10, 0))
		self._log(people["short"], "OUT", at(16, 0))  # 6 hours: recorded, flagged short
		self._log(people["absent"], "IN", at(10, 0))
		self._log(people["absent"], "OUT", at(12, 30))  # 2.5 hours: under 3 is absent

		shift = frappe.get_doc("Shift Type", SHIFT)
		shift.process_attendance_after = day
		shift.last_sync_of_checkin = datetime.combine(add_days(day, 1), time(1, 0))
		shift.save()
		shift.process_auto_attendance()

		def marked(name):
			return frappe.db.get_value(
				"Attendance",
				{"employee": name, "attendance_date": day, "docstatus": 1},
				["status", "late_entry", "early_exit", "working_hours"],
				as_dict=True,
			)

		# Whatever the hour, a day of 3 hours or more is present and nobody is late or early
		for who in ("full", "early", "late", "short"):
			self.assertEqual(marked(people[who]).status, "Present", who)
			self.assertFalse(marked(people[who]).late_entry, who)
			self.assertFalse(marked(people[who]).early_exit, who)
		self.assertAlmostEqual(marked(people["short"]).working_hours, 6, delta=0.05)
		self.assertEqual(marked(people["absent"]).status, "Absent")

		# The month view shows the same, and flags the short day
		month = team_month(day.strftime("%Y-%m"), company=COMPANY)
		cells = {r["employee"]: r["cells"][day.day - 1] for r in month["rows"]}
		for who in ("full", "early", "late"):
			self.assertEqual(cells[people[who]]["code"], "P", who)
			self.assertFalse(cells[people[who]]["short"], who)
		self.assertEqual(cells[people["short"]]["code"], "P")
		self.assertTrue(cells[people["short"]]["short"])
		self.assertEqual(cells[people["absent"]]["code"], "A")

	def test_team_day(self):
		out = make_employee("checkin_team_out@example.com", COMPANY)
		apply_attendance_setup()  # both get the flexible shift
		now = now_datetime()
		self._log(self.employee, "IN", now - timedelta(minutes=20))
		self._log(out, "IN", now - timedelta(minutes=50))
		self._log(out, "OUT", now - timedelta(minutes=30))

		day = team_day(company=COMPANY)
		rows = {r["employee"]: r for r in day["rows"]}
		self.assertEqual(rows[self.employee]["status"], "in")
		self.assertFalse(rows[self.employee]["short"])  # still checked in: the day isn't over
		self.assertEqual(rows[out]["status"], "out")
		self.assertTrue(rows[out]["short"])  # out after 20 minutes: recorded, under 9 hours
		self.assertNotIn("late", rows[out])
		self.assertEqual(day["summary"]["short"], 1)

	def test_the_check_in_card_flags_a_short_day_once_out(self):
		now = now_datetime()
		self._log(self.employee, "IN", now - timedelta(hours=5))
		frappe.set_user(self.user)
		self.assertFalse(my_checkin()["short"])  # still in
		self.assertEqual(my_checkin()["target_hours"], 9)

		frappe.set_user("Administrator")
		self._log(self.employee, "OUT", now - timedelta(hours=1))
		frappe.set_user(self.user)
		state = my_checkin()
		self.assertTrue(state["short"])
		self.assertAlmostEqual(state["hours"], 4, delta=0.05)

	def test_setup_moves_the_earlier_fixed_shift_to_the_flexible_one(self):
		frappe.get_doc(
			{
				"doctype": "Shift Type",
				"name": LEGACY_SHIFT,
				"start_time": "10:00:00",
				"end_time": "19:00:00",
			}
		).insert()
		frappe.db.set_value("Employee", self.employee, "default_shift", LEGACY_SHIFT)
		apply_attendance_setup()
		self.assertEqual(frappe.db.get_value("Employee", self.employee, "default_shift"), SHIFT)

	def test_people_see_themselves_and_their_team_only(self):
		manager_user = "checkin_manager@example.com"
		manager = make_employee(manager_user, COMPANY)
		report = make_employee("checkin_report@example.com", COMPANY)
		frappe.get_doc("Employee", report).update({"reports_to": manager}).save()
		frappe.get_doc("User", manager_user).add_roles("Employee")

		frappe.set_user(manager_user)
		seen = {r["employee"] for r in team_day()["rows"]}
		self.assertEqual(seen, {manager, report})
