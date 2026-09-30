// Preview mode: briskrew without a server.
//
// Built with VITE_BRISKREW_DEMO=1, the app answers every /api/method call from
// responses recorded on a real Frappe HR site (demo/recordings.json, produced by
// flow/scripts/record-demo.cjs). Writes are simulated and never leave the browser.
// Only used for shareable previews; normal builds don't include this file.

let recordings = {};
const byMethod = new Map();

const WRITES = new Set([
	"frappe.desk.form.save.savedocs",
	"frappe.desk.form.save.cancel",
	"frappe.client.delete",
	"frappe.client.set_value",
	"frappe.client.insert",
	"frappe.desk.form.utils.add_comment",
	"frappe.desk.form.assign_to.add",
	"frappe.desk.form.assign_to.remove",
	"frappe.desk.doctype.tag.tag.add_tag",
	"frappe.desk.doctype.tag.tag.remove_tag",
	"frappe.share.add",
	"frappe.desk.reportview.delete_items",
	"frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
	"frappe.model.workflow.apply_workflow",
	"hrms.briskrew.inbox.decide",
	"hrms.briskrew.inbox.approve_clear",
	"hrms.briskrew.inbox.add_comment",
	"run_doc_method",
	"upload_file",
]);

const canonical = (v) => {
	if (Array.isArray(v)) return v.map(canonical);
	if (v && typeof v === "object")
		return Object.fromEntries(
			Object.keys(v)
				.sort()
				.map((k) => [k, canonical(v[k])]),
		);
	return v;
};
const keyOf = (method, args) => `${method}|${JSON.stringify(canonical(args || {}))}`;
const identity = (args) =>
	[args?.doctype, args?.name, args?.report_name, args?.payroll_entry, args?.employee]
		.filter(Boolean)
		.join("|");

function answer(method, args) {
	if (WRITES.has(method)) return simulateWrite(method, args);
	const exact = recordings[keyOf(method, args)];
	if (exact) return exact;
	// Same method for the same record, then any recorded call of the method.
	const candidates = byMethod.get(method) || [];
	const id = identity(args);
	const sameRecord = id && candidates.find((c) => identity(c.args) === id);
	if (sameRecord) return sameRecord.response;
	if (candidates.length) return candidates[0].response;
	return { message: null };
}

function simulateWrite(method, args) {
	notify();
	if (method === "frappe.desk.form.save.savedocs") {
		const doc = typeof args.doc === "string" ? JSON.parse(args.doc) : args.doc;
		if (String(doc.name || "").startsWith("new-"))
			doc.name = `${doc.doctype.slice(0, 3).toUpperCase()}-PREVIEW`;
		delete doc.__islocal;
		if (args.action === "Submit") doc.docstatus = 1;
		doc.__unsaved = 0;
		return { docs: [doc] };
	}
	if (method === "run_doc_method") {
		const doc = JSON.parse(args.docs || "{}");
		return { docs: [doc], message: null };
	}
	if (method === "hrms.briskrew.inbox.approve_clear") {
		const items = typeof args.items === "string" ? JSON.parse(args.items) : args.items || [];
		return { message: { approved: items, skipped: [], failed: [], count: items.length } };
	}
	if (method === "hrms.briskrew.inbox.decide")
		return { message: { name: args.name, docstatus: 1 } };
	if (method.endsWith("delete_items") || method.endsWith("submit_cancel_or_update_docs"))
		return { message: [] };
	return { message: null };
}

let noticeTimer;
function notify() {
	const el = document.getElementById("briskrew-preview-note");
	if (!el) return;
	el.textContent = "Preview: that change wasn't saved anywhere";
	el.dataset.flash = "1";
	clearTimeout(noticeTimer);
	noticeTimer = setTimeout(() => {
		el.textContent = "Preview · changes aren't saved";
		delete el.dataset.flash;
	}, 3500);
}

function methodOf(url) {
	const u = new URL(url, window.location.href);
	const m = u.pathname.match(/\/api\/method\/(.+)$/);
	return m
		? { method: decodeURIComponent(m[1]), query: Object.fromEntries(u.searchParams) }
		: null;
}

async function argsOf(init) {
	const body = init?.body;
	if (!body) return {};
	if (typeof body === "string") {
		try {
			return JSON.parse(body);
		} catch {
			return Object.fromEntries(new URLSearchParams(body));
		}
	}
	if (body instanceof FormData) return Object.fromEntries(body.entries());
	return {};
}

const json = (data) =>
	new Response(JSON.stringify(data), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});

export async function installDemo() {
	const res = await fetch(new URL("demo/recordings.json", document.baseURI));
	const data = await res.json();
	recordings = data.recordings || {};
	for (const [k, response] of Object.entries(recordings)) {
		const i = k.indexOf("|");
		const method = k.slice(0, i);
		let args = {};
		try {
			args = JSON.parse(k.slice(i + 1));
		} catch {
			/* keep empty */
		}
		if (!byMethod.has(method)) byMethod.set(method, []);
		byMethod.get(method).push({ args, response });
	}
	window.__briskrewDemoUser = data.user || {};
	window.csrf_token = "preview";

	const realFetch = window.fetch.bind(window);
	window.fetch = async (input, init) => {
		const url = typeof input === "string" ? input : input.url;
		const hit = methodOf(url);
		if (!hit) {
			if (/^\/(printview|app\/)/.test(new URL(url, window.location.href).pathname))
				return json({});
			return realFetch(input, init);
		}
		const args = { ...hit.query, ...(await argsOf(init)) };
		return json(answer(hit.method, args));
	};

	// Desk scripts sometimes call the server synchronously.
	const RealXHR = window.XMLHttpRequest;
	window.XMLHttpRequest = class extends RealXHR {
		open(method, url, ...rest) {
			this.__hit = methodOf(url);
			if (!this.__hit) return super.open(method, url, ...rest);
		}
		setRequestHeader(...a) {
			if (!this.__hit) super.setRequestHeader(...a);
		}
		send(body) {
			if (!this.__hit) return super.send(body);
			let args = {};
			try {
				args = JSON.parse(body || "{}");
			} catch {
				args = {};
			}
			const text = JSON.stringify(
				answer(this.__hit.method, { ...this.__hit.query, ...args }),
			);
			Object.defineProperty(this, "status", { value: 200 });
			Object.defineProperty(this, "readyState", { value: 4 });
			Object.defineProperty(this, "responseText", { value: text });
			Object.defineProperty(this, "response", { value: text });
			this.onreadystatechange && this.onreadystatechange();
			this.onload && this.onload();
		}
	};

	const note = document.createElement("div");
	note.id = "briskrew-preview-note";
	note.setAttribute("role", "status");
	note.textContent = "Preview · changes aren't saved";
	document.body.appendChild(note);
}
