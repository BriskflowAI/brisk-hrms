// Records server responses for briskrew's preview mode (flow/src/demo/mock.js).
//
// Walks every screen in the navigation on a running site as the demo team lead and
// saves each /api/method response to flow/src/demo/recordings.json (not committed:
// it holds site data). Usage, with the site on http://127.0.0.1:8000:
//   node flow/scripts/record-demo.cjs [out.json]
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.SITE_URL || "http://127.0.0.1:8000";
const USER = process.env.DEMO_USER || "lead@briskrew.demo";
const PASSWORD = process.env.DEMO_PASSWORD || "briskrew-demo-1";
const OUT = process.argv[2] || path.join(__dirname, "../src/demo/recordings.json");

const canonical = (v) => {
	if (Array.isArray(v)) return v.map(canonical);
	if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
	return v;
};

(async () => {
	const navSrc = fs.readFileSync(path.join(__dirname, "../src/nav.js"), "utf8");
	const doctypes = [...new Set([...navSrc.matchAll(/r\("[^"]+", "([^"]+)"\)/g)].map((m) => m[1]))];
	const reports = [...new Set([...navSrc.matchAll(/report\("([^"]+)"\)/g)].map((m) => m[1]))];

	const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
	const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
	const recordings = {};
	page.on("response", async (res) => {
		const url = new URL(res.url());
		const m = url.pathname.match(/\/api\/method\/(.+)$/);
		if (!m || res.status() >= 400) return;
		let args = Object.fromEntries(url.searchParams);
		const body = res.request().postData();
		if (body) {
			try {
				Object.assign(args, JSON.parse(body));
			} catch {
				Object.assign(args, Object.fromEntries(new URLSearchParams(body)));
			}
		}
		try {
			const data = await res.json();
			delete data._server_messages;
			recordings[`${decodeURIComponent(m[1])}|${JSON.stringify(canonical(args))}`] = data;
		} catch {
			/* not JSON (file downloads) */
		}
	});

	await page.request.post(`${BASE}/api/method/login`, { data: { usr: USER, pwd: PASSWORD } });
	const visit = async (route, wait = 2500) => {
		await page.goto(`${BASE}/flow${route}`);
		await page.waitForTimeout(wait);
	};
	const firstName = async (dt) => {
		const r = await (await page.request.get(`${BASE}/api/method/frappe.client.get_list?doctype=${encodeURIComponent(dt)}&limit_page_length=3&order_by=modified%20desc`)).json();
		return (r.message || []).map((x) => x.name);
	};

	await visit("/", 3500);
	await visit("/about");

	// Inbox: open every request so each one's context is recorded.
	await visit("/inbox", 3500);
	const items = page.locator("section[aria-label=Requests] li button");
	for (let i = 0; i < (await items.count()); i++) {
		await items.nth(i).click();
		await page.waitForTimeout(1500);
	}

	// People: every view and every profile.
	await visit("/people", 3000);
	for (const view of ["away", "joining", "probation", "leaving", "everyone"]) {
		await page.getByRole("tab", { name: new RegExp(view === "away" ? "Away" : view, "i") }).click();
		await page.waitForTimeout(1200);
	}
	const people = page.locator("tbody tr[tabindex]");
	for (let i = 0; i < (await people.count()); i++) {
		await people.nth(i).click();
		await page.waitForTimeout(900);
	}

	// Every list in the navigation, a new record, and the latest few records.
	for (const dt of doctypes) {
		await visit(`/r/${encodeURIComponent(dt)}`);
		await visit(`/r/${encodeURIComponent(dt)}/new`);
		for (const name of (await firstName(dt)).slice(0, 2)) await visit(`/r/${encodeURIComponent(dt)}/${encodeURIComponent(name)}`, 3000);
	}

	// Payroll review for each run.
	for (const run of await firstName("Payroll Entry")) {
		await visit(`/r/Payroll%20Entry/${encodeURIComponent(run)}`, 3000);
		await visit(`/payroll/${encodeURIComponent(run)}`, 3000);
	}

	// Reports, with the company filled where one is asked for.
	const company = (await (await page.request.get(`${BASE}/api/method/frappe.client.get_value?doctype=Employee&filters=${encodeURIComponent(JSON.stringify({ user_id: USER }))}&fieldname=company`)).json()).message?.company;
	for (const r of reports) {
		await visit(`/report/${encodeURIComponent(r)}`, 3500);
		if (company) {
			await page.evaluate((c) => window.frappe?.query_report?.set_filter_value("company", c), company).catch(() => {});
			await page.waitForTimeout(3000);
		}
	}

	// A new leave request picking an employee (searches, balances, approver).
	await visit("/r/Leave%20Application/new", 3000);
	const emp = page.locator("#f-employee");
	await emp.click();
	await emp.fill("Pri");
	await page.waitForTimeout(1200);
	await page.locator("[role=option]").first().click().catch(() => {});
	await page.waitForTimeout(2500);

	// Command palette searches.
	await visit("/");
	for (const q of ["pri", "sal", "leave"]) {
		await page.keyboard.press("Control+k");
		await page.keyboard.type(q);
		await page.waitForTimeout(900);
		await page.keyboard.press("Escape");
	}

	const boot = recordings[Object.keys(recordings).find((k) => k.startsWith("hrms.briskrew.api.boot|"))]?.message || {};
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, JSON.stringify({ user: { user: boot.user, full_name: boot.user_fullname }, recorded: new Date().toISOString(), recordings }));
	console.log(`${Object.keys(recordings).length} responses → ${OUT}`);
	await browser.close();
})();
