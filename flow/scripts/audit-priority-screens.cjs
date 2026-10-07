// Opens every priority doctype (or report) in briskrew on a running site and records unsupported
// desk APIs, script errors and failed API calls.
// Usage: node flow/scripts/audit-priority-screens.cjs
//   [priority|performance|hiring|shifts|stock|assets|stock-reports|asset-reports|<Doctype>|report:<Report>…]
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
  stock: [
    "Item",
    "Item Group",
    "Brand",
    "UOM",
    "UOM Conversion Factor",
    "Item Attribute",
    "Item Price",
    "Price List",
    "Pricing Rule",
    "Product Bundle",
    "Item Alternative",
    "Item Manufacturer",
    "Manufacturer",
    "Customs Tariff Number",
    "Warehouse",
    "Warehouse Type",
    "Material Request",
    "Stock Entry",
    "Stock Entry Type",
    "Purchase Receipt",
    "Delivery Note",
    "Pick List",
    "Packing Slip",
    "Delivery Trip",
    "Shipment",
    "Stock Reconciliation",
    "Landed Cost Voucher",
    "Quality Inspection",
    "Quality Inspection Template",
    "Quality Inspection Parameter",
    "Serial No",
    "Batch",
    "Serial and Batch Bundle",
    "Stock Reservation Entry",
    "Putaway Rule",
    "Inventory Dimension",
    "Installation Note",
    "Stock Closing Entry",
    "Repost Item Valuation",
    "Stock Ledger Entry",
  ],
  assets: [
    "Asset",
    "Asset Category",
    "Location",
    "Asset Movement",
    "Asset Capitalization",
    "Asset Depreciation Schedule",
    "Asset Value Adjustment",
    "Asset Repair",
    "Asset Maintenance",
    "Asset Maintenance Team",
    "Asset Maintenance Log",
    "Asset Shift Allocation",
    "Asset Shift Factor",
    "Asset Activity",
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
  // The reports in briskrew's Stock and Assets areas (src/nav.js).
  "stock-reports": [
    "report:Stock Balance",
    "report:Stock Ledger",
    "report:Stock Projected Qty",
    "report:Stock Ageing",
    "report:Warehouse Wise Stock Balance",
    "report:Warehouse wise Item Balance Age and Value",
    "report:Stock Analytics",
    "report:Total Stock Summary",
    "report:Item Shortage Report",
    "report:Itemwise Recommended Reorder Level",
    "report:Items To Be Requested",
    "report:Requested Items To Be Transferred",
    "report:Item Prices",
    "report:Item Price Stock",
    "report:Item-wise Price List Rate",
    "report:Item Variant Details",
    "report:Item Where Used",
    "report:Item Wise Consumption",
    "report:Item Balance (Simple)",
    "report:Product Bundle Balance",
    "report:Reserved Stock",
    "report:Delivery Note Trends",
    "report:Purchase Receipt Trends",
    "report:Delayed Item Report",
    "report:Delayed Order Report",
    "report:Landed Cost Report",
    "report:COGS By Item Group",
    "report:Material Requests for which Supplier Quotations are not created",
    "report:Batch-Wise Balance History",
    "report:Batch Item Expiry Status",
    "report:Available Batch Report",
    "report:Available Serial No",
    "report:Serial No Ledger",
    "report:Serial No and Batch Traceability",
    "report:Serial and Batch Summary",
    "report:Serial No Status",
    "report:Serial No Warranty Expiry",
    "report:Serial No Service Contract Expiry",
    "report:Negative Batch Report",
    "report:Stock and Account Value Comparison",
    "report:Stock Ledger Variance",
    "report:Stock Ledger Invariant Check",
    "report:Incorrect Stock Value Report",
    "report:Incorrect Balance Qty After Transaction",
    "report:Incorrect Serial No Valuation",
    "report:Incorrect Serial and Batch Bundle",
    "report:FIFO Queue vs Qty After Transaction Comparison",
    "report:Stock Qty vs Batch Qty",
    "report:Stock Qty vs Serial No Count",
  ],
  "asset-reports": [
    "report:Fixed Asset Register",
    "report:Asset Depreciation Ledger",
    "report:Asset Depreciations and Balances",
    "report:Asset Activity",
    "report:Asset Maintenance",
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
