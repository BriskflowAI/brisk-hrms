// Opens every priority doctype (or report) in briskrew on a running site and records unsupported
// desk APIs, script errors and failed API calls.
// Usage: node flow/scripts/audit-priority-screens.cjs
//   [priority|performance|hiring|shifts|<Doctype>|report:<Report>…]
// (expects the site on AUDIT_BASE_URL, default http://127.0.0.1:8000, as Administrator/admin)
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
  p.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400)
      errs.push(`${r.status()} ${r.url().split("?")[0].split("/api/")[1]}`);
  });
  const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:8000";
  await p.request.post(base + "/api/method/login", {
    data: { usr: "Administrator", pwd: "admin" },
  });
  const out = [];
  for (const dt of DOCTYPES) {
    const res = { doctype: dt, screens: [] };
    const report = dt.startsWith("report:") ? dt.slice(7) : null;
    const list = report
      ? {}
      : await (
          await p.request.get(
            `${base}/api/method/frappe.client.get_list?doctype=${encodeURIComponent(
              dt,
            )}&limit_page_length=1&order_by=modified%20desc`,
          )
        ).json();
    const existing = list.message?.[0]?.name;
    const targets = report
      ? [["report", `/flow/report/${encodeURIComponent(report)}`]]
      : [
          ["list", `/flow/r/${encodeURIComponent(dt)}`],
          ["new", `/flow/r/${encodeURIComponent(dt)}/new`],
        ];
    if (existing && !report)
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
      // A report that refuses to run without some filter says so (HTTP 417), as in the desk:
      // that's expected, not a failure.
      let errors = [...new Set(errs)];
      let needsFilters = "";
      if (
        kind === "report" &&
        errors.length &&
        errors.every((e) => e === "417 method/frappe.desk.query_report.run")
      ) {
        needsFilters = alerts;
        errors = [];
      }
      res.screens.push({
        kind,
        name: kind === "existing" ? existing : null,
        unsupported: banner.replace(/\s+/g, " "),
        errors,
        alerts: needsFilters ? "" : alerts,
        needs_filters: needsFilters,
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
