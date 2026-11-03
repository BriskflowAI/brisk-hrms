from datetime import datetime, time, timedelta

import frappe
from frappe.utils import add_days, getdate, now_datetime

from erpnext.setup.doctype.employee.test_employee import make_employee

from hrms.briskrew.attendance import (
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
		self.assertEqual(str(shift.start_time), "10:00:00")
		self.assertEqual(str(shift.end_time), "19:00:00")
		self.assertTrue(shift.enable_auto_attendance)
		self.assertEqual(shift.working_hours_threshold_for_half_day, 8)
		self.assertEqual(shift.working_hours_threshold_for_absent, 4)
		self.assertEqual(shift.late_entry_grace_period, 30)
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
			"present": self.employee,
			"late": make_employee("checkin_late@example.com", COMPANY),
			"half": make_employee("checkin_half@example.com", COMPANY),
			"absent": make_employee("checkin_short@example.com", COMPANY),
		}
		for name in people.values():
			frappe.db.set_value(
				"Employee", name, {"default_shift": SHIFT, "date_of_joining": add_days(day, -30)}
			)

		def at(h, m):
			return datetime.combine(day, time(h, m))

		self._log(people["present"], "IN", at(9, 58))
		self._log(people["present"], "OUT", at(19, 5))
		self._log(people["late"], "IN", at(10, 45))
		self._log(people["late"], "OUT", at(19, 0))
		self._log(people["half"], "IN", at(10, 0))
		self._log(people["half"], "OUT", at(16, 0))  # 6 hours: under 8
		self._log(people["absent"], "IN", at(10, 0))
		self._log(people["absent"], "OUT", at(12, 30))  # 2.5 hours: under 4

		shift = frappe.get_doc("Shift Type", SHIFT)
		shift.process_attendance_after = day
		shift.last_sync_of_checkin = datetime.combine(add_days(day, 1), time(1, 0))
		shift.save()
		shift.process_auto_attendance()

		def marked(name):
			return frappe.db.get_value(
				"Attendance",
				{"employee": name, "attendance_date": day, "docstatus": 1},
				["status", "late_entry"],
				as_dict=True,
			)

		self.assertEqual(marked(people["present"]).status, "Present")
		self.assertFalse(marked(people["present"]).late_entry)
		self.assertEqual(marked(people["late"]).status, "Present")
		self.assertTrue(marked(people["late"]).late_entry)
		self.assertEqual(marked(people["half"]).status, "Half Day")
		self.assertEqual(marked(people["absent"]).status, "Absent")

		# The month view shows the same
		month = team_month(day.strftime("%Y-%m"), company=COMPANY)
		cells = {r["employee"]: r["cells"][day.day - 1] for r in month["rows"]}
		self.assertEqual(cells[people["present"]]["code"], "P")
		self.assertTrue(cells[people["late"]]["late"])
		self.assertEqual(cells[people["half"]]["code"], "H")
		self.assertEqual(cells[people["absent"]]["code"], "A")

	def test_team_day(self):
		late = make_employee("checkin_team_late@example.com", COMPANY)
		apply_attendance_setup()  # both get the standard shift
		now = now_datetime()
		self._log(self.employee, "IN", now - timedelta(minutes=20))
		if now.time() > time(10, 40):
			self._log(late, "IN", datetime.combine(now.date(), time(10, 35)))

		rows = {r["employee"]: r for r in team_day(company=COMPANY)["rows"]}
		self.assertEqual(rows[self.employee]["status"], "in")
		if now.time() > time(10, 40):
			self.assertTrue(rows[late]["late"])
			self.assertEqual(rows[late]["status"], "in")

	def test_people_see_themselves_and_their_team_only(self):
		manager_user = "checkin_manager@example.com"
		manager = make_employee(manager_user, COMPANY)
		report = make_employee("checkin_report@example.com", COMPANY)
		frappe.get_doc("Employee", report).update({"reports_to": manager}).save()
		frappe.get_doc("User", manager_user).add_roles("Employee")

		frappe.set_user(manager_user)
		seen = {r["employee"] for r in team_day()["rows"]}
		self.assertEqual(seen, {manager, report})
