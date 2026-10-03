// Opens every priority doctype in briskrew on a running site and records unsupported desk APIs.
// Usage: node flow/scripts/audit-priority-screens.cjs [priority|performance|hiring|shifts|<Doctype>…]
// (expects the site on http://127.0.0.1:8000, Administrator/admin)
const { chromium } = require("playwright");
const fs = require("fs");
const GROUPS = {
  priority: [
    "Employee",
    "Leave Application",
    "Leave Allocation",
    "Leave Policy",
    "Leave Type",
    "Holiday List",
    "Attendance",
    "Employee Checkin",
    "Attendance Request",
    "Shift Request",
    "Shift Assignment",
    "Expense Claim",
    "Employee Advance",
    "Payroll Entry",
    "Salary Slip",
    "Salary Structure",
    "Salary Structure Assignment",
    "Job Opening",
    "Job Applicant",
    "Appraisal",
  ],
  performance: [
    "Appraisal Cycle",
    "Appraisal Template",
    "Appraisal",
    "KRA",
    "Goal",
    "Employee Performance Feedback",
    "Employee Feedback Criteria",
  ],
  hiring: [
    "Staffing Plan",
    "Job Requisition",
    "Job Opening",
    "Job Applicant",
    "Interview Type",
    "Interview",
    "Interview Feedback",
    "Job Offer",
    "Appointment Letter",
    "Employee Referral",
  ],
  shifts: [
    "Shift Type",
    "Shift Location",
    "Shift Schedule",
    "Shift Schedule Assignment",
    "Shift Assignment",
    "Shift Request",
    "Employee Checkin",
  ],
};
// Groups or doctype names on the command line; the priority screens by default.
const args = process.argv.slice(2);
const DOCTYPES = (args.length ? args : ["priority"]).flatMap(
  (a) => GROUPS[a] || [a],
);
const OUT = process.env.AUDIT_OUT || "audit.json";
(async () => {
  const b = await chromium.launch({});
  const p = await (
    await b.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage();
  let errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const base = "http://127.0.0.1:8000";
  await p.request.post(base + "/api/method/login", {
    data: { usr: "Administrator", pwd: "admin" },
  });
  const out = [];
  for (const dt of DOCTYPES) {
    const res = { doctype: dt, screens: [] };
    const list = await (
      await p.request.get(
        `${base}/api/method/frappe.client.get_list?doctype=${encodeURIComponent(
          dt,
        )}&limit_page_length=1&order_by=modified%20desc`,
      )
    ).json();
    const existing = list.message?.[0]?.name;
    const targets = [
      ["list", `/flow/r/${encodeURIComponent(dt)}`],
      ["new", `/flow/r/${encodeURIComponent(dt)}/new`],
    ];
    if (existing)
      targets.push([
        "existing",
        `/flow/r/${encodeURIComponent(dt)}/${encodeURIComponent(existing)}`,
      ]);
    for (const [kind, url] of targets) {
      errs = [];
      await p.goto(base + url);
      await p.waitForTimeout(3500);
      const banner = (await p.locator("main p").allInnerTexts())
        .filter(
          (t) => /classic desk/i.test(t) && /(script|extras|report)/i.test(t),
        )
        .join(" ");
      const alerts = (
        await p.locator("main [role=alert]").allInnerTexts()
      ).join(" ");
      const buttons = (
        await p
          .locator("main header button, main header a.btn-ink")
          .allInnerTexts()
      )
        .map((x) => x.trim().replace(/\s+/g, " "))
        .filter((x) => x && !["•••"].includes(x));
      res.screens.push({
        kind,
        name: kind === "existing" ? existing : null,
        unsupported: banner.replace(/\s+/g, " "),
        errors: [...new Set(errs)],
        alerts,
        buttons,
      });
    }
    out.push(res);
    console.log(
      dt,
      res.screens
        .map(
          (s) =>
            `${s.kind}:${
              s.unsupported || s.errors.length || s.alerts ? "⚠" : "ok"
            }`,
        )
        .join(" "),
    );
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  await b.close();
})();
