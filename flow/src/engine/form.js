// The record engine: one reactive object per open document.
//
// It mirrors what the classic desk form does (load, defaults, dependency rules,
// save / submit / cancel / amend, child tables, workflow, docinfo) so any record
// type works without screen-specific code. Screen-specific behaviour comes from
// the doctype's own form script, run through the compatibility layer (compat.js),
// which drives this object through the same methods.

import { reactive } from "vue";
import { call } from "frappe-ui";
import { getMeta, isLayout, isTable } from "@/composables/api";
import { useSession } from "@/composables/session";
import { __ } from "@/composables/i18n";

const LOCAL_PREFIX = "new-";
let localCounter = 0;

export function localName(doctype) {
	localCounter += 1;
	return `${LOCAL_PREFIX}${doctype.toLowerCase().replace(/ /g, "-")}-${Date.now().toString(
		36,
	)}${localCounter}`;
}

export const isLocalName = (name) => !name || String(name).startsWith(LOCAL_PREFIX);

// Unsaved documents created by form scripts (frappe.model.get_new_doc, open_mapped_doc)
// and then opened with set_route("Form", doctype, name).
export const localDocs = new Map();

export function createForm(doctype, name) {
	const f = reactive({
		doctype,
		name: name || null,
		doc: null,
		meta: null,
		byName: {},
		docinfo: null,
		perms: null,
		dirty: false,
		busy: "",
		error: "",
		ready: false,
		// Set by form scripts (compat layer) or by the engine.
		overrides: {}, // "<table>|<field>" -> partial df
		buttons: [], // { label, group, action, primary }
		intro: null, // { text, color }
		indicator: null, // { label, color }
		headline: null,
		dashboard: [], // { label, color }
		sections: [], // { title, html } from frm.dashboard.add_section
		saveDisabled: false, // frm.disable_save(): the form drives its own primary actions
		transitions: [],
		unsupported: [], // form-script APIs we couldn't run (see compat.js)
		listeners: {}, // event -> [fn]

		get isNew() {
			return !!(f.doc && (f.doc.__islocal || isLocalName(f.doc.name)));
		},
		get docstatus() {
			return f.doc?.docstatus || 0;
		},
		get titleValue() {
			if (!f.doc) return "";
			const tf = f.meta?.title_field;
			return (tf && f.doc[tf]) || f.doc.name;
		},

		// ---- field definitions -------------------------------------------------------------

		fieldsOf(dt) {
			return (dt === f.doctype ? f.meta : f.byName[dt])?.fields || [];
		},
		df(fieldname, table = "") {
			const dt = table ? f.tableDoctype(table) : f.doctype;
			const base = f.fieldsOf(dt).find((d) => d.fieldname === fieldname);
			if (!base) return null;
			const o = f.overrides[`${table}|${fieldname}`];
			return o ? { ...base, ...o } : base;
		},
		// Link search filters: a form script's set_query wins, then the field's own link_filters.
		queries: {}, // "<table>|<field>" -> fn(doc, cdt, cdn) returning { filters, query }
		linkQuery(df, row = null) {
			const table = row ? row.parentfield : "";
			const fn = f.queries[`${table}|${df.fieldname}`] || f.queries[`|${df.fieldname}`];
			let q = {};
			if (fn) {
				try {
					q =
						(typeof fn === "function"
							? fn(f.doc, row?.doctype || f.doctype, row?.name || f.doc.name)
							: fn) || {};
				} catch {
					q = {};
				}
			} else if (df.link_filters) {
				try {
					q = { filters: JSON.parse(df.link_filters) };
				} catch {
					q = {};
				}
			}
			return q;
		},
		tableDoctype(tableField) {
			return f.meta?.fields.find((d) => d.fieldname === tableField)?.options;
		},

		// ---- dependency rules --------------------------------------------------------------

		evaluate(expr, row = null) {
			if (!expr) return true;
			const doc = row || f.doc;
			if (typeof expr === "boolean") return expr;
			expr = String(expr).trim();
			if (expr.startsWith("eval:")) {
				try {
					// Same variables the desk exposes to depends_on expressions.
					// eslint-disable-next-line no-new-func
					const fn = new Function(
						"doc",
						"parent",
						"frappe",
						"cur_frm",
						`return (${expr.slice(5)})`,
					);
					return !!fn(doc, row ? f.doc : null, window.frappe, window.cur_frm);
				} catch {
					return true;
				}
			}
			const v = doc?.[expr];
			return Array.isArray(v) ? v.length > 0 : !!v;
		},
		visible(df, row = null) {
			if (!df || df.hidden) return false;
			if (df.depends_on && !f.evaluate(df.depends_on, row)) return false;
			return true;
		},
		required(df, row = null) {
			if (!df) return false;
			if (df.reqd) return true;
			return !!(df.mandatory_depends_on && f.evaluate(df.mandatory_depends_on, row));
		},
		readOnly(df, row = null) {
			if (!df) return true;
			if (!f.canWrite) return true;
			if (["Read Only", "Button", "HTML", "Heading"].includes(df.fieldtype)) return true;
			if (df.read_only) return true;
			if (df.read_only_depends_on && f.evaluate(df.read_only_depends_on, row)) return true;
			if (f.docstatus === 2) return true;
			if (f.docstatus === 1 && !df.allow_on_submit) return true;
			if (df.set_only_once && !f.isNew && f.doc?.[df.fieldname]) return true;
			return false;
		},
		get canWrite() {
			if (!f.perms) return true;
			if (f.isNew) return !!f.perms.create || !!f.perms.write;
			return !!f.perms.write;
		},

		// ---- events -----------------------------------------------------------------------

		on(event, fn) {
			(f.listeners[event] ||= []).push(fn);
		},
		async trigger(event, ...args) {
			for (const fn of f.listeners[event] || []) {
				// A listener may return false to stop the action (e.g. validate).
				if ((await fn(...args)) === false) return false;
			}
			return true;
		},

		// ---- loading ----------------------------------------------------------------------

		async load() {
			f.undoStack = [];
			f.redoStack = [];
			f.error = "";
			f.ready = false;
			try {
				const m = await getMeta(f.doctype);
				f.meta = m.meta;
				f.byName = m.byName;
				if (!f.name || isLocalName(f.name)) {
					await f.newDoc();
				} else {
					const res = await call("frappe.desk.form.load.getdoc", {
						doctype: f.doctype,
						name: f.name,
					});
					const doc = res?.docs?.[0];
					if (!doc)
						throw new Error(
							`${f.doctype} ${f.name} doesn't exist, or you can't see it.`,
						);
					f.doc = doc;
					f.docinfo = res.docinfo || null;
					f.perms = docPerms(res.docinfo);
				}
				if (f.isNew) {
					// Defaults that are links fill their dependent fields, as the desk does.
					for (const d of f.meta.fields.filter(
						(x) => x.fieldtype === "Link" && f.doc[x.fieldname],
					)) {
						await f.fetchFrom(d, f.doc[d.fieldname]);
					}
				}
				await f.loadTransitions();
				f.dirty = false;
				f.ready = true;
				await f.trigger("loaded");
			} catch (e) {
				f.error = messageOf(e, `Couldn't open ${f.doctype}.`);
			}
		},
		async newDoc(values = {}) {
			const handed = f.name && localDocs.get(f.name);
			if (handed) {
				localDocs.delete(f.name);
				values = { ...handed, ...values };
			}
			const doc = await call("hrms.briskrew.api.new_doc", { doctype: f.doctype });
			doc.name = f.name && isLocalName(f.name) ? f.name : localName(f.doctype);
			doc.__islocal = 1;
			doc.docstatus = 0;
			Object.assign(doc, values);
			for (const tf of f.meta.fields.filter(isTable)) doc[tf.fieldname] ||= [];
			f.doc = doc;
			f.name = doc.name;
			f.docinfo = null;
			f.perms = null;
		},
		async reload() {
			f.overrides = {};
			f.buttons = [];
			await f.load();
			await f.trigger("refresh");
		},

		// ---- editing ----------------------------------------------------------------------

		async setValue(fieldname, value, row = null) {
			const target = row || f.doc;
			if (!target || target[fieldname] === value) return;
			// Only the outermost change is undoable: values that scripts and linked fields fill in
			// as a result follow from it, so undoing it re-runs them, as in the desk.
			const outer = f.setDepth === 0 && !f.replaying;
			if (outer) {
				f.undoStack.push({
					fieldname,
					row: row?.name || null,
					table: row?.parentfield || "",
					before: target[fieldname],
					after: value,
				});
				if (f.undoStack.length > 100) f.undoStack.shift();
				f.redoStack = [];
			}
			target[fieldname] = value;
			f.dirty = true;
			f.setDepth++;
			try {
				const table = row ? row.parentfield : "";
				const df = f.df(fieldname, table);
				if (df?.fieldtype === "Link") await f.fetchFrom(df, value, row);
				await f.trigger("change", fieldname, row);
			} finally {
				f.setDepth--;
			}
		},
		// ---- undo / redo (Ctrl/⌘ Z, Ctrl/⌘ Shift Z) ----
		undoStack: [],
		redoStack: [],
		setDepth: 0,
		replaying: false,
		async replay(from, to, key) {
			const step = from.pop();
			if (!step) return null;
			const row = step.row
				? (f.doc[step.table] || []).find((r) => r.name === step.row)
				: null;
			if (step.row && !row) return f.replay(from, to, key); // that row has since been removed
			f.replaying = true;
			try {
				await f.setValue(step.fieldname, step[key], row);
			} finally {
				f.replaying = false;
			}
			to.push(step);
			return step;
		},
		undo: () => f.replay(f.undoStack, f.redoStack, "before"),
		redo: () => f.replay(f.redoStack, f.undoStack, "after"),
		// Fields with "fetch_from: link.field" fill in when the link changes, as in the desk.
		extraFetches: [], // from frm.add_fetch(link, source, target, table)
		async fetchFrom(linkDf, value, row = null) {
			const dt = row ? row.doctype : f.doctype;
			const table = row ? row.parentfield : "";
			const targets = f
				.fieldsOf(dt)
				.filter((d) => d.fetch_from && d.fetch_from.split(".")[0] === linkDf.fieldname);
			for (const x of f.extraFetches) {
				if (
					x.link === linkDf.fieldname &&
					(x.table || "") === table &&
					!targets.some((d) => d.fieldname === x.target)
				)
					targets.push({ fieldname: x.target, fetch_from: `${x.link}.${x.source}` });
			}
			if (!targets.length) return;
			const target = row || f.doc;
			if (!value) {
				for (const d of targets) if (!d.fetch_if_empty) target[d.fieldname] = null;
				return;
			}
			try {
				const res = await call("frappe.client.get_value", {
					doctype: linkDf.options,
					filters: { name: value },
					fieldname: targets.map((d) => d.fetch_from.split(".")[1]),
				});
				for (const d of targets) {
					if (d.fetch_if_empty && target[d.fieldname]) continue;
					// Through setValue so fetched links fetch in turn (employee -> company -> account).
					await f.setValue(d.fieldname, res?.[d.fetch_from.split(".")[1]] ?? null, row);
				}
			} catch {
				/* the server fills these on save anyway */
			}
		},
		addRow(tableField, values = {}) {
			const row = f.addRowSync(tableField, values);
			return f.trigger("row_add", tableField, row).then(() => row);
		},
		addRowSync(tableField, values = {}) {
			const dt = f.tableDoctype(tableField);
			const rows = (f.doc[tableField] ||= []);
			const row = {
				doctype: dt,
				name: localName(dt),
				__islocal: 1,
				parent: f.doc.name,
				parenttype: f.doctype,
				parentfield: tableField,
				idx: rows.length + 1,
				docstatus: 0,
			};
			for (const d of f.fieldsOf(dt)) {
				if (isLayout(d) || d.default === undefined || d.default === null) continue;
				row[d.fieldname] = defaultValue(d);
			}
			Object.assign(row, values);
			rows.push(row);
			f.dirty = true;
			return row;
		},
		async removeRow(tableField, row) {
			const rows = f.doc[tableField] || [];
			const i = rows.indexOf(row);
			if (i < 0) return;
			rows.splice(i, 1);
			rows.forEach((r, n) => (r.idx = n + 1));
			f.dirty = true;
			await f.trigger("row_remove", tableField, row);
		},
		missingMandatory() {
			const missing = [];
			const check = (dt, doc, table, label) => {
				for (const d of f.fieldsOf(dt)) {
					if (isLayout(d)) continue;
					const df = f.df(d.fieldname, table);
					if (!f.required(df, table ? doc : null) || !f.visible(df, table ? doc : null))
						continue;
					const v = doc[d.fieldname];
					const empty =
						v === null ||
						v === undefined ||
						v === "" ||
						(Array.isArray(v) && !v.length);
					if (empty) missing.push(label ? `${label}: ${df.label}` : df.label);
				}
			};
			check(f.doctype, f.doc, "", "");
			for (const tf of f.meta.fields.filter(isTable)) {
				for (const row of f.doc[tf.fieldname] || [])
					check(tf.options, row, tf.fieldname, `${tf.label} row ${row.idx}`);
			}
			return missing;
		},

		// ---- actions ----------------------------------------------------------------------

		async run(label, fn) {
			if (f.busy) return false;
			f.busy = label;
			f.error = "";
			try {
				return (await fn()) ?? true;
			} catch (e) {
				f.error = messageOf(e, `${label} failed. Nothing was changed.`);
				return false;
			} finally {
				f.busy = "";
			}
		},
		save() {
			return f.run("Saving", async () => {
				const missing = f.missingMandatory();
				if (missing.length) throw new Error(`Fill in: ${missing.join(", ")}`);
				if ((await f.trigger("validate")) === false) return false;
				if ((await f.trigger("before_save")) === false) return false;
				const wasNew = f.isNew;
				// Submitted docs can still change fields marked "allow on submit": that's an Update.
				await f.saveDocs(f.docstatus === 1 ? "Update" : "Save");
				await f.trigger("after_save", wasNew);
			});
		},
		submit() {
			return f.run("Submitting", async () => {
				if (f.dirty || f.isNew) {
					const missing = f.missingMandatory();
					if (missing.length) throw new Error(`Fill in: ${missing.join(", ")}`);
				}
				if ((await f.trigger("before_submit")) === false) return false;
				await f.saveDocs("Submit");
				await f.trigger("on_submit");
			});
		},
		cancel() {
			return f.run("Cancelling", async () => {
				if ((await f.trigger("before_cancel")) === false) return false;
				await call("frappe.desk.form.save.cancel", {
					doctype: f.doctype,
					name: f.doc.name,
				});
				await f.reloadDoc();
				await f.trigger("after_cancel");
			});
		},
		remove() {
			return f.run("Deleting", async () => {
				await call("frappe.client.delete", { doctype: f.doctype, name: f.doc.name });
				f.doc = null;
				await f.trigger("deleted");
			});
		},
		// A copy to edit: amended (keeps the link to the cancelled original) or a plain duplicate.
		copy(amend = false) {
			const src = JSON.parse(JSON.stringify(f.doc));
			const skip = new Set([
				"name",
				"owner",
				"creation",
				"modified",
				"modified_by",
				"docstatus",
				"amended_from",
				"__onload",
				"_comments",
				"_assign",
				"_liked_by",
				"_user_tags",
				"_seen",
			]);
			const clean = (d, dt) => {
				for (const k of Object.keys(d)) if (skip.has(k) || k.startsWith("__")) delete d[k];
				for (const df of f.fieldsOf(dt)) if (df.no_copy && !amend) delete d[df.fieldname];
			};
			clean(src, f.doctype);
			for (const tf of f.meta.fields.filter(isTable)) {
				src[tf.fieldname] = (src[tf.fieldname] || []).map((row) => {
					clean(row, tf.options);
					return { ...row, name: localName(tf.options), __islocal: 1, docstatus: 0 };
				});
			}
			if (amend) src.amended_from = f.doc.name;
			return src;
		},
		async reloadDoc() {
			// The record now matches the server; earlier edits can't be stepped back through.
			f.undoStack = [];
			f.redoStack = [];
			const res = await call("frappe.desk.form.load.getdoc", {
				doctype: f.doctype,
				name: f.doc.name,
			});
			f.doc = res.docs[0];
			f.docinfo = res.docinfo || null;
			f.perms = docPerms(res.docinfo) || f.perms;
			f.dirty = false;
			await f.loadTransitions();
		},
		// The same endpoint the classic desk uses, so naming, attachment relinking and
		// background submission behave identically.
		async saveDocs(action) {
			const res = await call("frappe.desk.form.save.savedocs", {
				doc: JSON.stringify(plain(f.doc)),
				action,
			});
			const saved = res?.docs?.[0];
			if (saved) await f.afterWrite(saved);
			else await f.reloadDoc();
		},
		async afterWrite(saved) {
			f.doc = saved;
			f.name = saved.name;
			f.dirty = false;
			await f.reloadDoc();
			await f.trigger("refresh");
		},

		// ---- workflow ---------------------------------------------------------------------

		async loadTransitions() {
			f.transitions = [];
			if (f.isNew || !f.meta?.__workflow_docs?.length) return;
			try {
				f.transitions = await call("frappe.model.workflow.get_transitions", {
					doc: f.doc,
				});
			} catch {
				f.transitions = [];
			}
		},
		applyWorkflow(action) {
			return f.run(action, async () => {
				if (f.dirty) await f.saveDocs("Save");
				const saved = await call("frappe.model.workflow.apply_workflow", {
					doc: f.doc,
					action,
				});
				await f.afterWrite(saved);
			});
		},
		get workflowState() {
			const wf = f.meta?.__workflow_docs?.[0];
			return wf ? f.doc?.[wf.workflow_state_field] : null;
		},

		// ---- docinfo: comments, attachments, assignments, tags, share --------------------

		addComment(content) {
			return f.run("Commenting", async () => {
				const session = useSession();
				await call("frappe.desk.form.utils.add_comment", {
					reference_doctype: f.doctype,
					reference_name: f.doc.name,
					content,
					comment_email: window.frappe?.session?.user || session.user,
					comment_by: window.frappe?.session?.user_fullname || session.fullName,
				});
				await f.reloadDoc();
			});
		},
		upload(file, fieldname = null, isPrivate = 1) {
			return f.run("Uploading", async () => {
				const form = new FormData();
				form.append("file", file, file.name);
				form.append("is_private", isPrivate ? "1" : "0");
				form.append("doctype", f.doctype);
				form.append("docname", f.doc.name);
				if (fieldname) form.append("fieldname", fieldname);
				const res = await fetch("/api/method/upload_file", {
					method: "POST",
					headers: { "X-Frappe-CSRF-Token": window.csrf_token },
					body: form,
				});
				const data = await res.json();
				if (!res.ok) throw new Error(serverMessage(data) || "Upload failed");
				if (fieldname) await f.setValue(fieldname, data.message.file_url);
				if (!f.isNew) await f.reloadDoc();
				return data.message;
			});
		},
		removeAttachment(fileName) {
			return f.run("Removing", async () => {
				await call("frappe.desk.form.utils.remove_attach", {
					fid: fileName,
					dt: f.doctype,
					dn: f.doc.name,
				});
				await f.reloadDoc();
			});
		},
		assign(users, description = "") {
			return f.run("Assigning", async () => {
				await call("frappe.desk.form.assign_to.add", {
					assign_to: users,
					doctype: f.doctype,
					name: f.doc.name,
					description,
				});
				await f.reloadDoc();
			});
		},
		unassign(user) {
			return f.run("Unassigning", async () => {
				await call("frappe.desk.form.assign_to.remove", {
					doctype: f.doctype,
					name: f.doc.name,
					assign_to: user,
				});
				await f.reloadDoc();
			});
		},
		addTag(tag) {
			return f.run("Tagging", async () => {
				await call("frappe.desk.doctype.tag.tag.add_tag", {
					tag,
					dt: f.doctype,
					dn: f.doc.name,
				});
				await f.reloadDoc();
			});
		},
		removeTag(tag) {
			return f.run("Tagging", async () => {
				await call("frappe.desk.doctype.tag.tag.remove_tag", {
					tag,
					dt: f.doctype,
					dn: f.doc.name,
				});
				await f.reloadDoc();
			});
		},
		share(user, rights = { read: 1 }) {
			return f.run("Sharing", async () => {
				await call("frappe.share.add", {
					doctype: f.doctype,
					name: f.doc.name,
					user,
					...rights,
				});
				await f.reloadDoc();
			});
		},
		follow(on = true) {
			return f.run("Updating", async () => {
				await call(
					on
						? "frappe.desk.form.document_follow.follow_document"
						: "frappe.desk.form.document_follow.unfollow_document",
					{
						doctype: f.doctype,
						doc_name: f.doc.name,
						user: window.frappe?.session?.user,
					},
				);
				await f.reloadDoc();
			});
		},
		rename(newName, merge = false) {
			return f.run("Renaming", async () => {
				const res = await call("frappe.model.rename_doc.update_document_title", {
					doctype: f.doctype,
					docname: f.doc.name,
					name: newName,
					merge: merge ? 1 : 0,
					enqueue: true,
				});
				f.name = res || newName;
				f.doc.name = f.name;
				await f.reloadDoc();
				return f.name;
			});
		},

		// ---- print ------------------------------------------------------------------------

		get printFormats() {
			return [
				"Standard",
				...(f.meta?.__print_formats || [])
					.map((p) => p.name)
					.filter((n) => n !== "Standard"),
			];
		},
		printUrl(format = "Standard", letterhead = true) {
			const q = new URLSearchParams({
				doctype: f.doctype,
				name: f.doc.name,
				format,
				no_letterhead: letterhead ? "0" : "1",
			});
			return `/printview?${q}`;
		},
		pdfUrl(format = "Standard", letterhead = true) {
			const q = new URLSearchParams({
				doctype: f.doctype,
				name: f.doc.name,
				format,
				no_letterhead: letterhead ? "0" : "1",
			});
			return `/api/method/frappe.utils.print_format.download_pdf?${q}`;
		},

		// ---- connections (the desk's "links" dashboard) ----------------------------------

		async loadConnections() {
			const dash = f.meta?.__dashboard;
			if (!dash || f.isNew) return [];
			const items = (dash.transactions || []).flatMap((t) => t.items || []);
			if (!items.length) return [];
			try {
				const res = await call("frappe.desk.notifications.get_open_count", {
					doctype: f.doctype,
					name: f.doc.name,
					items,
				});
				const counts = Object.fromEntries(
					(res?.count || []).map((c) => [c.name, c.count]),
				);
				return (dash.transactions || []).map((t) => ({
					label: t.label,
					items: (t.items || []).map((dt) => ({
						doctype: dt,
						count: counts[dt] || 0,
						filter: filterFor(dash, dt, f.doc),
					})),
				}));
			} catch {
				return [];
			}
		},
	});
	return f;
}

function filterFor(dash, doctype, doc) {
	const field = dash.non_standard_fieldnames?.[doctype] || dash.fieldname;
	return { [field]: doc.name };
}

export function defaultValue(df) {
	const d = df.default;
	if (d === "Today") return new Date().toISOString().slice(0, 10);
	if (d === "Now") return new Date().toISOString().slice(0, 19).replace("T", " ");
	if (d === "__user") return window.frappe?.session?.user || null;
	if (["Check", "Int"].includes(df.fieldtype)) return parseInt(d, 10) || 0;
	if (["Float", "Currency", "Percent"].includes(df.fieldtype)) return parseFloat(d) || 0;
	return d;
}

const plain = (doc) => JSON.parse(JSON.stringify(doc));

function serverMessage(data) {
	try {
		return JSON.parse(data._server_messages || "[]")
			.map((m) => JSON.parse(m).message)
			.join(" ");
	} catch {
		return data?.message || "";
	}
}

// The document's permissions, plus what has been shared with this user (the desk does the same,
// which is how people can edit their own User record).
function docPerms(docinfo) {
	if (!docinfo?.permissions) return null;
	const perms = { ...docinfo.permissions };
	const me = document.cookie.match(/(?:^|; )user_id=([^;]*)/)?.[1];
	const user = me ? decodeURIComponent(me) : "";
	for (const s of docinfo.shared || []) {
		if (s.user !== user && !s.everyone) continue;
		for (const right of ["read", "write", "submit", "share"]) perms[right] ||= s[right];
	}
	return perms;
}

export function messageOf(e, fallback) {
	// Server messages arrive in the user's language already; briskrew's own fallbacks go through
	// the same catalogue (and the site's Translation records).
	const own = fallback ? __(fallback) : fallback;
	const text = e?.messages?.filter(Boolean).join(" ") || e?.message || own;
	return humanError(String(text).replace(/<[^>]+>/g, ""), own);
}

// Server errors arrive as "frappe.exceptions.ValidationError: …" or with a Python traceback;
// people only need the sentence.
export function humanError(text, fallback = "Something went wrong.") {
	let t = String(text || "").trim();
	if (/Traceback \(most recent call last\)/.test(t))
		t = t.split("\n").filter(Boolean).pop() || "";
	t = t.replace(/^(?:[\w.]+\.)?(?:exceptions\.)?\w*(?:Error|Exception)\s*:\s*/, "");
	// Developer-facing type errors ("Argument 'x' in 'module.fn' should be of type…")
	if (/should be of type '\w+' but got/.test(t))
		t = "Some required information is missing. Fill in the required fields and try again.";
	return t || fallback;
}
