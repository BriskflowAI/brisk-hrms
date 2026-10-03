import frappe
from frappe.utils import add_days, add_months, get_first_day, nowdate

from erpnext.setup.doctype.employee.test_employee import make_employee

from hrms.briskrew.leave_policies import assign, get_candidates, get_overview, save_leave_type, save_policy
from hrms.tests.utils import HRMSTestSuite


class TestBriskrewLeavePolicies(HRMSTestSuite):
	def setUp(self):
		frappe.set_user("Administrator")
		self.employees = [
			make_employee(f"policy_member_{i}@example.com", "_Test Company", date_of_joining="2020-01-01")
			for i in range(2)
		]
		# Start each test with no leave for these test employees.
		for doctype in ("Leave Ledger Entry", "Leave Allocation", "Leave Policy Assignment"):
			frappe.db.delete(doctype, {"employee": ("in", self.employees)})
		existing = frappe.db.exists("Leave Type", "_Test Builder Leave")
		self.leave_type = save_leave_type(
			{
				"leave_type_name": "_Test Builder Leave",
				"max_leaves_allowed": 15,
				"is_carry_forward": 1,
				"max_continuous_days_allowed": 0,
			},
			name=existing,
		)["name"]

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_leave_type_rules_save(self):
		saved = save_leave_type({"max_continuous_days_allowed": 3, "not_a_field": 1}, name=self.leave_type)
		self.assertEqual(saved["max_continuous_days_allowed"], 3)
		self.assertEqual(saved["is_carry_forward"], 1)
		self.assertNotIn("not_a_field", saved)

	def test_draft_then_submit(self):
		draft = save_policy(
			"_Test Builder Policy", [{"leave_type": self.leave_type, "annual_allocation": 10}]
		)
		self.assertEqual(draft["docstatus"], 0)
		res = save_policy(
			"_Test Builder Policy",
			[{"leave_type": self.leave_type, "annual_allocation": 12}],
			name=draft["name"],
			submit=1,
		)
		self.assertEqual(res["docstatus"], 1)
		self.assertEqual(
			frappe.db.get_value("Leave Policy Detail", {"parent": res["name"]}, "annual_allocation"), 12
		)
		# Submitted policies can't change.
		self.assertRaises(
			frappe.ValidationError, save_policy, "x", [{"leave_type": self.leave_type}], name=res["name"]
		)

	def test_over_the_leave_type_maximum_is_refused(self):
		self.assertRaises(
			frappe.ValidationError,
			save_policy,
			"_Test Too Much",
			[{"leave_type": self.leave_type, "annual_allocation": 20}],
		)

	def test_assign_creates_balances_and_reports_failures(self):
		policy = save_policy(
			"_Test Builder Policy", [{"leave_type": self.leave_type, "annual_allocation": 12}], submit=1
		)["name"]
		start = get_first_day(nowdate())
		data = {
			"assignment_based_on": "",
			"effective_from": str(start),
			"effective_to": str(add_days(add_months(start, 12), -1)),
		}
		res = assign(policy, self.employees, data)
		self.assertEqual(len(res["created"]), 2)
		self.assertFalse(res["failed"])
		for e in self.employees:
			self.assertTrue(
				frappe.db.exists(
					"Leave Allocation", {"employee": e, "leave_type": self.leave_type, "docstatus": 1}
				)
			)

		# The same people again overlap with what they have, and each failure says why.
		again = assign(policy, self.employees, data)
		self.assertFalse(again["created"])
		self.assertEqual(len(again["failed"]), 2)
		self.assertIn("already assigned", again["failed"][0]["error"])

		candidates = {c.name: c for c in get_candidates({"company": "_Test Company"})}
		self.assertEqual(candidates[self.employees[0]].current.leave_policy, policy)

	def test_draft_policies_cannot_be_assigned(self):
		draft = save_policy("_Test Draft", [{"leave_type": self.leave_type, "annual_allocation": 5}])
		self.assertRaises(frappe.ValidationError, assign, draft["name"], self.employees, {})

	def test_overview(self):
		save_policy("_Test Builder Policy", [{"leave_type": self.leave_type, "annual_allocation": 5}])
		res = get_overview()
		self.assertIn(self.leave_type, [t.name for t in res["leave_types"]])
		self.assertIn("_Test Builder Policy", [p.title for p in res["policies"]])
		fields = [f["fieldname"] for g in res["groups"] for f in g["fields"]]
		self.assertIn("is_earned_leave", fields)

	def test_needs_permission(self):
		frappe.set_user("Guest")
		self.assertRaises(frappe.PermissionError, get_overview)
