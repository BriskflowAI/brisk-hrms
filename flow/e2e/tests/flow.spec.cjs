// briskrew in a real browser, on a site seeded with the demo team (hrms.briskrew.demo).
// Every test fails on a page error or a failed API call, so a missing or changed Frappe API
// shows up even when the screen still looks right.
const { test, expect } = require("@playwright/test");

const ADMIN = {
  usr: "Administrator",
  pwd: process.env.E2E_ADMIN_PASSWORD || "admin",
};
const LEAD = { usr: "lead@briskrew.demo", pwd: "briskrew-demo-1" };

function watch(page) {
  const problems = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400) {
      problems.push(
        `${r.status()} ${r.request().method()} ${r.url().split("?")[0]}`,
      );
    }
  });
  return problems;
}

async function signIn(page, { usr, pwd }) {
  const res = await page.request.post("/api/method/login", {
    data: { usr, pwd },
  });
  expect(res.ok()).toBeTruthy();
}

async function api(page, method, params = {}) {
  const res = await page.request.get(`/api/method/${method}`, { params });
  expect(res.ok(), `${method} ${res.status()}`).toBeTruthy();
  return (await res.json()).message;
}

test("signs in through the login page and opens briskrew", async ({ page }) => {
  const problems = watch(page);
  await page.goto("/login");
  await page.fill("#login_email", LEAD.usr);
  await page.fill("#login_password", LEAD.pwd);
  await page.press("#login_password", "Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  // Where the login page lands depends on the site's home page settings; only briskrew counts.
  problems.length = 0;
  await page.goto("/flow/");
  await expect(page.locator('nav[aria-label="Areas"]').first()).toBeVisible();
  await expect(page.locator("main")).toContainText(/\S/);
  expect(problems).toEqual([]);
});

test("list view shows records", async ({ page }) => {
  const problems = watch(page);
  await signIn(page, LEAD);
  await page.goto("/flow/r/Leave%20Application");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  expect(await page.locator("tbody tr").count()).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});

test("saves a record from the form", async ({ page }) => {
  const problems = watch(page);
  await signIn(page, ADMIN);
  const [draft] = await api(page, "frappe.client.get_list", {
    doctype: "Leave Application",
    filters: JSON.stringify({ docstatus: 0 }),
    fields: JSON.stringify(["name"]),
    limit_page_length: 1,
  });
  expect(draft, "a draft leave application from the demo data").toBeTruthy();
  const reason = `Saved from e2e ${Date.now()}`;

  await page.goto(
    `/flow/r/Leave%20Application/${encodeURIComponent(draft.name)}`,
  );
  const field = page.locator("#f-description");
  await expect(field).toBeVisible();
  await field.fill(reason);
  await field.blur();
  await page.keyboard.press("Control+s");
  await expect
    .poll(async () =>
      api(page, "frappe.client.get_value", {
        doctype: "Leave Application",
        filters: draft.name,
        fieldname: "description",
      }).then((m) => m.description),
    )
    .toBe(reason);
  expect(problems).toEqual([]);
});

test("app switcher lists Frappe HR and other apps' workspaces", async ({
  page,
}) => {
  const problems = watch(page);
  await signIn(page, ADMIN);
  await page.goto("/flow/");
  await page.locator('button[aria-label="Apps"]').first().click();
  await expect(page.locator("text=Open the app screen")).toBeVisible();
  const links = page.locator('a[href^="/desk/"], a[href^="/app/"]');
  await expect.poll(() => links.count()).toBeGreaterThan(3);
  await expect(page.locator("text=Frappe HR").first()).toBeVisible();
  expect(problems).toEqual([]);
});

test("Report view groups with totals", async ({ page }) => {
  const problems = watch(page);
  await signIn(page, LEAD);
  await page.goto("/flow/r/Leave%20Application?view=report");
  const grid = page.locator('section[aria-label="Report view"]');
  await expect(grid).toBeVisible();
  await expect(grid.locator("tbody tr").first()).toBeVisible();
  await page.selectOption("#rg-group", "status");
  await page.check("text=Totals row");
  await expect(
    grid.locator("tfoot, tr:has-text('Total')").first(),
  ).toBeVisible();
  expect(problems).toEqual([]);
});

test("Gantt view draws bars", async ({ page }) => {
  const problems = watch(page);
  await signIn(page, LEAD);
  await page.goto("/flow/r/Leave%20Application?view=gantt");
  const gantt = page.locator('[aria-label="Gantt"]');
  await expect(gantt).toBeVisible();
  await expect(gantt.locator("a[title*='→']").first()).toBeVisible();
  await expect(page.locator("[role=alert]")).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("phone layout uses bottom tabs", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const problems = watch(page);
  await signIn(page, LEAD);
  await page.goto("/flow/");
  const tabs = page.locator('nav[aria-label="Areas"].fixed');
  await expect(tabs).toBeVisible();
  const box = await tabs.boundingBox();
  expect(box.y + box.height).toBeGreaterThan(800);
  await page.goto("/flow/r/Leave%20Application");
  await expect(page.locator("main")).toContainText(/\S/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(problems).toEqual([]);
  await context.close();
});

test("translations load for briskrew's own text", async ({ page }) => {
  await signIn(page, LEAD);
  const messages = await api(page, "hrms.briskrew.api.translations", {
    lang: "de",
  });
  expect(Object.keys(messages).length).toBeGreaterThan(100);
});

test("Image and Map views render", async ({ page }) => {
  const problems = watch(page);
  await signIn(page, ADMIN);
  await page.goto("/flow/r/Employee?view=image");
  await expect(
    page.locator("main a[href*='/flow/r/Employee/']").first(),
  ).toBeVisible();
  await page.goto("/flow/r/Employee%20Checkin?view=map");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("[role=alert]")).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("undo, redo and jump to field on a record", async ({ page }) => {
  const problems = watch(page);
  await signIn(page, ADMIN);
  const [draft] = await api(page, "frappe.client.get_list", {
    doctype: "Leave Application",
    filters: JSON.stringify({ docstatus: 0 }),
    fields: JSON.stringify(["name"]),
    limit_page_length: 1,
  });
  await page.goto(
    `/flow/r/Leave%20Application/${encodeURIComponent(draft.name)}`,
  );
  const reason = page.locator("#f-description");
  await expect(reason).toBeVisible();
  const before = await reason.inputValue();
  await reason.fill(`Undo check ${Date.now()}`);
  await reason.blur();
  const edited = await reason.inputValue();
  await page.locator("h1").first().click();
  await page.keyboard.press("Control+z");
  await expect(reason).toHaveValue(before);
  await page.keyboard.press("Control+Shift+z");
  await expect(reason).toHaveValue(edited);

  await page.keyboard.press("Control+j");
  await page.keyboard.type("posting");
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
    .toBe("f-posting_date");
  expect(problems).toEqual([]);
});

// Needs Frappe's realtime server reachable from the browser (socketio); set E2E_REALTIME=1.
test("a record updates instantly when someone else saves it", async ({
  page,
  playwright,
}) => {
  test.skip(
    !process.env.E2E_REALTIME,
    "set E2E_REALTIME=1 when socketio is running",
  );
  // Your own saves don't count as someone else's change, so the lead watches and the admin edits.
  const admin = await playwright.request.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  await admin.post("/api/method/login", { data: ADMIN });
  const list = await admin.get("/api/method/frappe.client.get_list", {
    params: {
      doctype: "Leave Application",
      filters: JSON.stringify({ docstatus: 0, leave_approver: LEAD.usr }),
      fields: JSON.stringify(["name"]),
      limit_page_length: 1,
    },
  });
  const [draft] = (await list.json()).message;
  expect(draft, "a draft leave application waiting on the lead").toBeTruthy();

  await signIn(page, LEAD);
  const sockets = [];
  page.on("websocket", (ws) => sockets.push(ws.url()));
  await page.goto(
    `/flow/r/Leave%20Application/${encodeURIComponent(draft.name)}`,
  );
  await expect(page.locator("#f-description")).toBeVisible();

  const value = `Realtime check ${Date.now()}`;
  await admin.post("/api/method/frappe.client.set_value", {
    data: {
      doctype: "Leave Application",
      name: draft.name,
      fieldname: "description",
      value,
    },
  });
  // Polling would take up to 20 s; realtime is well under that.
  await expect(page.locator("#f-description")).toHaveValue(value, {
    timeout: 10_000,
  });
  expect(sockets.some((u) => u.includes("socket.io"))).toBeTruthy();
  await admin.dispose();
});

// Stock and assets (demo data from hrms.briskrew.demo_inventory).
async function inventorySeeded(page) {
  const summary = await api(page, "hrms.briskrew.inventory.stock_summary");
  return (summary?.items || 0) > 0;
}

test("stock levels flag what needs reordering and open the item page", async ({
  page,
}) => {
  const problems = watch(page);
  await signIn(page, ADMIN);
  test.skip(!(await inventorySeeded(page)), "no stock demo data on this site");
  await page.goto("/flow/stock-levels");
  await expect(
    page.getByRole("heading", { name: "Stock levels" }),
  ).toBeVisible();
  const ink = page.locator("tbody tr", { hasText: "BR-INK" }).first();
  await expect(ink).toBeVisible();
  await expect(ink.getByText("Reorder")).toBeVisible();

  await ink.getByRole("link", { name: "Printer Ink Cartridge" }).click();
  await expect(page).toHaveURL(/\/flow\/item\/BR-INK/);
  await expect(
    page.getByRole("heading", { name: "Stock by warehouse" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recent movements" }),
  ).toBeVisible();
  expect(problems).toEqual([]);
});

test("asset register opens an asset's page", async ({ page }) => {
  const problems = watch(page);
  await signIn(page, ADMIN);
  test.skip(!(await inventorySeeded(page)), "no assets demo data on this site");
  await page.goto("/flow/asset-register");
  await expect(
    page.getByRole("heading", { name: "Asset register" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Laptop 01" }).first().click();
  await expect(page).toHaveURL(/\/flow\/asset\//);
  await expect(
    page.getByRole("heading", { name: "Depreciation schedule" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  expect(problems).toEqual([]);
});

// ERPNext's own Stock Entry controller runs in briskrew: the type sets the purpose and picking
// an item fills its unit and rate.
test("makes a stock entry with ERPNext's form script", async ({ page }) => {
  const problems = watch(page);
  await signIn(page, ADMIN);
  test.skip(!(await inventorySeeded(page)), "no stock demo data on this site");
  const [stores] = await api(page, "frappe.client.get_list", {
    doctype: "Warehouse",
    filters: JSON.stringify({ warehouse_name: "Stores", is_group: 0 }),
    fields: JSON.stringify(["name"]),
    limit_page_length: 1,
  });

  await page.goto(
    `/flow/r/Stock%20Entry/new?stock_entry_type=Material%20Receipt&to_warehouse=${encodeURIComponent(
      stores.name,
    )}`,
  );
  await expect
    .poll(() => page.evaluate(() => window.cur_frm?.doc?.purpose))
    .toBe("Material Receipt");

  await page.getByRole("button", { name: "+ Add row" }).first().click();
  const item = page.locator('[id$="-item_code"]').first();
  await item.fill("BR-CHAIR");
  await page
    .getByRole("option", { name: /BR-CHAIR/ })
    .first()
    .click();
  await expect
    .poll(() => page.evaluate(() => window.cur_frm?.doc?.items?.[0]?.uom))
    .toBe("Nos");
  const qty = page.locator('[id$="-qty"]').first();
  await qty.fill("2");
  await qty.blur();
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(/\/flow\/r\/Stock%20Entry\/MAT-STE-/);
  const name = decodeURIComponent(page.url().split("/").pop());
  const saved = await api(page, "frappe.client.get", {
    doctype: "Stock Entry",
    name,
  });
  expect(saved.purpose).toBe("Material Receipt");
  expect(saved.items[0].t_warehouse).toBe(stores.name);
  expect(saved.items[0].qty).toBe(2);
  expect(problems).toEqual([]);
});

// ERPNext's "Get Items From" picker (MultiSelectDialog and the server-side mapper).
test("gets items from a material request into a purchase order", async ({
  page,
}) => {
  const problems = watch(page);
  await signIn(page, ADMIN);
  test.skip(!(await inventorySeeded(page)), "no stock demo data on this site");
  await page.goto(
    "/flow/r/Purchase%20Order/new?supplier=Brisk%20Office%20Supplies",
  );
  await page.getByRole("button", { name: /Get Items From/ }).click();
  await page.getByRole("menuitem", { name: "Material Request" }).click();
  const dialog = page.getByRole("dialog");
  const row = dialog.locator("tbody tr", { hasText: "MAT-MR-" }).first();
  await expect(row).toBeVisible();
  await row.locator('input[type="checkbox"]').first().check();
  await dialog.getByRole("button", { name: "Get Items" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.cur_frm?.doc?.items || []).map((r) => r.item_code).sort(),
      ),
    )
    .toEqual(["BR-INK", "BR-PAPER"]);
  expect(problems).toEqual([]);
});
