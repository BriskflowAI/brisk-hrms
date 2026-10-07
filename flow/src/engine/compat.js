// Desk compatibility layer.
//
// Frappe ships every doctype's form script with its metadata (meta.__js, plus
// meta.__custom_js for Client Scripts added in the site). Those scripts are written
// against the classic desk API: frappe.ui.form.on(...), frm.add_custom_button,
// frm.set_query, frappe.call, dialogs... This module provides that API on top of
// the briskrew record engine, so the original scripts run unchanged: every button,
// filter and field rule keeps working, including future upstream changes and a
// site's own customisations.
//
// Anything a script uses that isn't implemented here is recorded on
// form.unsupported (shown to the user with a link to the classic desk) instead of
// failing silently.

import { __ } from "@/composables/i18n";
import { markRaw, reactive } from "vue";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import customParseFormat from "dayjs/plugin/customParseFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";
import weekday from "dayjs/plugin/weekday";
import jQuery from "jquery";
import { getMeta, metaFromCache } from "@/composables/api";
import { humanError, localDocs, localName, messageOf } from "./form";

import hrmsUtils from "../../../hrms/public/js/utils/index.js?raw";
import hrmsLeaveUtils from "../../../hrms/public/js/utils/leave_utils.js?raw";
import hrmsPayrollUtils from "../../../hrms/public/js/utils/payroll_utils.js?raw";

for (const plugin of [
	isBetween,
	isSameOrAfter,
	isSameOrBefore,
	customParseFormat,
	relativeTime,
	duration,
	weekday,
])
	dayjs.extend(plugin);

const templates = import.meta.glob("../../../hrms/public/js/templates/*.html", {
	query: "?raw",
	import: "default",
	eager: true,
});

// ---------------------------------------------------------------------------------------
// Shared UI state rendered by CompatDialogs.vue
// ---------------------------------------------------------------------------------------

export const ui = reactive({
	dialogs: [], // Dialog instances
	messages: [], // { id, title, html, indicator, primary }
	alerts: [], // { id, html, indicator }
	frozen: "",
	progress: null,
});

let current = null; // { form, router, frm, handlers }
const permCache = new Map(); // doctype -> { read, write, create, ... } for list screens and frappe.perm
let booted = null;
let seq = 0;

// ---------------------------------------------------------------------------------------
// Recording stubs: unknown APIs never throw, they're logged.
// ---------------------------------------------------------------------------------------

const SKIP = new Set([
	"then",
	"catch",
	"finally",
	"toJSON",
	"constructor",
	"prototype",
	"valueOf",
	"toString",
	"length",
	"$$typeof",
	"nodeType",
]);

let currentList = null; // { list, router } while a list screen is open
const globalHandlers = {}; // frappe.ui.form.on(...) calls made while no form was open

function record(path) {
	const f = current?.form || currentList?.list;
	if (f && !f.unsupported.includes(path)) f.unsupported.push(path);
	if (import.meta.env.DEV) console.warn(`[briskrew compat] unsupported: ${path}`);
}

// Keys these stand-ins never answer: promise checks, and Vue's internal flags (`__v_raw`,
// `__v_isRef`...). Answering those with another stand-in sends Vue round in circles when one of
// these ends up inside reactive state.
const internal = (prop) =>
	typeof prop === "symbol" || SKIP.has(prop) || String(prop).startsWith("__v_");

// Every stand-in, so tooling (the screen audit, an API coverage check) can tell a real desk
// API from a placeholder.
const standIns = new WeakSet();

function stub(path) {
	const fn = function () {
		record(path);
		return stub(`${path}()`);
	};
	const proxy = new Proxy(fn, {
		get(t, prop) {
			// A script counting on a property it sets itself later ((frm.x || 0) + 1) gets 0.
			if (prop === Symbol.toPrimitive) return (hint) => (hint === "number" ? 0 : "");
			if (internal(prop)) return undefined;
			return stub(`${path}.${String(prop)}`);
		},
		set() {
			return true;
		},
	});
	standIns.add(proxy);
	return proxy;
}

// Purely visual desk internals (sidebar images, toolbar navigation...). Scripts poke at
// them for looks only, so they're absorbed without flagging anything as unsupported.
function silent() {
	const fn = function () {
		return silent();
	};
	return new Proxy(fn, {
		get(t, prop) {
			if (internal(prop)) return undefined;
			return silent();
		},
		set() {
			return true;
		},
	});
}

function lenient(obj, path) {
	return new Proxy(obj, {
		get(t, prop, recv) {
			if (typeof prop === "symbol" || prop in t) return Reflect.get(t, prop, recv);
			if (SKIP.has(prop) || String(prop).startsWith("__v_")) return undefined;
			return stub(`${path}.${String(prop)}`);
		},
	});
}

// ---------------------------------------------------------------------------------------
// Helpers every desk script can use as globals
// ---------------------------------------------------------------------------------------

const flt = (v, precision, rounding_method) => {
	let n = parseFloat(typeof v === "string" ? v.replace(/,/g, "") : v);
	if (Number.isNaN(n)) n = 0;
	return precision === undefined || precision === null
		? n
		: _round(n, precision, rounding_method);
};

// Frappe's rounding (number_format.js), so totals match the desk and the server to the paisa.
function _round(num, precision, rounding_method) {
	rounding_method =
		rounding_method || booted?.sysdefaults?.rounding_method || "Banker's Rounding (legacy)";
	const negative = num < 0;
	if (rounding_method === "Banker's Rounding (legacy)") {
		const d = cint(precision);
		const m = Math.pow(10, d);
		const n = +(d ? Math.abs(num) * m : Math.abs(num)).toFixed(8);
		const i = Math.floor(n);
		const f = n - i;
		let r = !precision && f === 0.5 ? (i % 2 === 0 ? i : i + 1) : Math.round(n);
		r = d ? r / m : r;
		return negative ? -r : r;
	}
	if (rounding_method === "Banker's Rounding") {
		if (num === 0) return 0;
		const multiplier = Math.pow(10, cint(precision));
		let n = Math.abs(num) * multiplier;
		const floor = Math.floor(n);
		const decimal = n - floor;
		const epsilon = 2.0 ** (Math.log2(Math.abs(n)) - 52.0);
		const tie = epsilon < 0.5 ? Math.abs(decimal - 0.5) < epsilon : decimal === 0.5;
		n = tie ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(n);
		n = n / multiplier;
		return negative ? -n : n;
	}
	if (rounding_method === "Commercial Rounding") {
		if (num === 0) return 0;
		const multiplier = Math.pow(10, cint(precision));
		const n = num * multiplier;
		let epsilon = 2.0 ** (Math.log2(Math.abs(n)) - 52.0);
		if (epsilon >= 0.25) epsilon = 0;
		return (Math.sign(n) * Math.round(Math.abs(n) + epsilon)) / multiplier;
	}
	throw new Error(`Unknown rounding method ${rounding_method}`);
}

function remainder(numerator, denominator, precision) {
	precision = cint(precision);
	const multiplier = Math.pow(10, precision);
	const r = precision
		? ((numerator * multiplier) % (denominator * multiplier)) / multiplier
		: numerator % denominator;
	return flt(r, precision);
}

// Rounds to the currency's smallest coin (e.g. 0.05), as invoices do with rounding adjustment.
function round_based_on_smallest_currency_fraction(value, currency, precision) {
	const smallest = flt(
		window.frappe?.model?.get_value?.(
			":Currency",
			currency,
			"smallest_currency_fraction_value",
		),
	);
	if (!smallest) return _round(value);
	const rem = remainder(value, smallest, precision);
	return rem > smallest / 2 ? value + smallest - rem : value - rem;
}

// Promises scripts chain jQuery-style (.done, .fail, .always) onto, as on frappe.call's.
function deskPromise(p) {
	p.catch(() => {});
	p.done = (fn) => (p.then(fn), p);
	p.fail = (fn) => (p.catch(fn), p);
	p.always = (fn) => (p.then(fn, fn), p);
	const then = p.then.bind(p);
	p.then = (...a) => deskPromise(then(...a));
	return p;
}
const cint = (v) => {
	const n = parseInt(v, 10);
	return Number.isNaN(n) ? 0 : n;
};
const cstr = (v) => (v === null || v === undefined ? "" : String(v));
const in_list = (list, item) => (list || []).includes(item);
const translate = (text, args, context) => __(text, args, context);
const escapeHtml = (s) =>
	String(s ?? "").replace(
		/[&<>"']/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
	);

// frappe.render_template's micro templates. Port of frappe/public/js/frappe/microtemplate.js
// (Frappe Framework, MIT licence), including its Jinja-style shorthands.
const compiledTemplates = new Map();
function microtemplate(str, data) {
	let fn = compiledTemplates.get(str);
	if (!fn) {
		let t = String(str)
			.replace(/{{/g, "{%=")
			.replace(/}}/g, "%}")
			.replace(/{%\s?if\s?\s?not\s?([^(][^%{]+)\s?%}/g, "{% if (! $1) { %}")
			.replace(/{%\s?if\s?([^(][^%{]+)\s?%}/g, "{% if ($1) { %}")
			.replace(/{%\s?for\s([a-z._]+)\sin\s([a-z._]+)\s?%}/g, (m, item, list) => {
				const i = `_i${Math.random().toString(36).slice(2, 6)}`;
				return `{% for (var ${i}=0; ${i}<${list}.length; ${i}++) { var ${item} = ${list}[${i}]; ${item}._index = ${i}; %}`;
			})
			.replace(/{%\s?endif\s?%}/g, "{% }; %}")
			.replace(/{%\s?else\s?%}/g, "{% } else { %}")
			.replace(/{%\s?endfor\s?%}/g, "{% }; %}");
		const code =
			"var _p=[],print=function(){_p.push.apply(_p,arguments)};with(obj){\n_p.push('" +
			t
				.replace(/[\r\t\n]/g, " ")
				.split("{%")
				.join("\t")
				.replace(/((^|%})[^\t]*)'/g, "$1\r")
				.replace(/\t=(.*?)%}/g, "',$1,'")
				.split("\t")
				.join("');\n")
				.split("%}")
				.join("\n_p.push('")
				.split("\r")
				.join("\\'") +
			"');}return _p.join('');";
		// eslint-disable-next-line no-new-func
		fn = new Function("obj", code);
		compiledTemplates.set(str, fn);
	}
	return fn(data || {});
}

// ---------------------------------------------------------------------------------------
// Server calls with desk semantics (full response, server messages shown)
// ---------------------------------------------------------------------------------------

// Objects and lists go as JSON strings, as the desk's frappe.call sends them: typed server
// methods (v16 checks argument types) expect a string there.
function deskArgs(args) {
	const out = {};
	for (const [k, v] of Object.entries(args || {}))
		out[k] =
			v &&
			typeof v === "object" &&
			(Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype)
				? JSON.stringify(v)
				: v;
	return out;
}

async function rawCall(method, args = {}) {
	const res = await fetch(method.startsWith("/") ? method : `/api/method/${method}`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json; charset=utf-8",
			"X-Frappe-CSRF-Token": window.csrf_token,
		},
		body: JSON.stringify(deskArgs(args)),
	});
	let data = {};
	try {
		data = await res.json();
	} catch {
		data = {};
	}
	const messages = serverMessages(data);
	if (!res.ok) {
		const err = new Error(
			humanError(
				messages.map((m) => m.message).join(" ") || data.exception || `${method} failed`,
			),
		);
		err.messages = messages.map((m) => m.message);
		err.response = data;
		throw err;
	}
	for (const m of messages) msgprint(m);
	return data;
}

function serverMessages(data) {
	try {
		return JSON.parse(data._server_messages || "[]").map((m) => {
			try {
				const o = JSON.parse(m);
				return typeof o === "object" ? o : { message: String(o) };
			} catch {
				return { message: m };
			}
		});
	} catch {
		return [];
	}
}

// Some desk scripts use `async: false` and read the result on the next line.
function syncCall(o) {
	const xhr = new XMLHttpRequest();
	const path = o.doc ? "/api/method/run_doc_method" : `/api/method/${o.method}`;
	const body = o.doc
		? { docs: JSON.stringify(o.doc), method: o.method, args: JSON.stringify(o.args || {}) }
		: o.args || {};
	xhr.open("POST", path, false);
	xhr.setRequestHeader("Accept", "application/json");
	xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
	xhr.setRequestHeader("X-Frappe-CSRF-Token", window.csrf_token);
	xhr.send(JSON.stringify(deskArgs(body)));
	let r = {};
	try {
		r = JSON.parse(xhr.responseText || "{}");
	} catch {
		r = {};
	}
	if (xhr.status >= 400) {
		r.exc = r.exc || true;
		const msgs = serverMessages(r);
		if (o.error) o.error(r);
		else if (!o.silent)
			msgprint({
				message: msgs.map((m) => m.message).join("<br>") || `${o.method} failed`,
				indicator: "red",
				title: "Error",
			});
	} else {
		for (const m of serverMessages(r)) msgprint(m);
		if (r.docs) syncDocs(r.docs);
		if (o.callback) o.callback(r);
	}
	if (o.always) o.always();
	const p = xhr.status >= 400 ? Promise.reject(r) : Promise.resolve(r);
	p.catch(() => {});
	p.done = (fn) => (fn(r), p);
	p.fail = (fn) => (xhr.status >= 400 && fn(r), p);
	return p;
}

function frappeCall(opts, args, callback) {
	if (typeof opts === "string") opts = { method: opts, args, callback };
	const o = { args: {}, ...opts };
	if (o.async === false) return syncCall(o);
	if (o.freeze) ui.frozen = o.freeze_message || "Working…";
	const run = async () => {
		let r;
		try {
			if (o.doc) {
				// Document method: the desk sends the whole (possibly unsaved) doc.
				r = await rawCall("run_doc_method", {
					docs: JSON.stringify(o.doc),
					method: o.method,
					args: JSON.stringify(o.args || {}),
				});
				if (r.docs) syncDocs(r.docs);
			} else {
				r = await rawCall(o.method, o.args);
				if (r.docs) syncDocs(r.docs);
			}
			if (o.callback) {
				// A bug inside the script's own callback is the script's, not the server's:
				// like the desk, log it rather than interrupt the user.
				try {
					await o.callback(r);
				} catch (scriptError) {
					console.error(`[briskrew] ${o.method} callback:`, scriptError);
				}
			}
			return r;
		} catch (e) {
			if (o.error) o.error(e.response || e);
			else if (!o.silent)
				msgprint({
					message: messageOf(e, `${o.method} failed`),
					indicator: "red",
					title: "Error",
				});
			throw e;
		} finally {
			if (o.freeze) ui.frozen = "";
			if (o.always) o.always();
		}
	};
	// Callers using callbacks don't handle rejections; some chain jQuery-style hooks.
	return deskPromise(run());
}

// Put returned docs back where scripts read them: the open form, or the local cache.
function syncDocs(docs) {
	for (const d of [].concat(docs || [])) {
		const f = current?.form;
		if (f && d.doctype === f.doctype && d.name === f.doc?.name) {
			Object.assign(f.doc, d);
			f.dirty = f.dirty || !!d.__unsaved || f.docstatus === 0;
		} else if (d.doctype) {
			localDocs.set(d.name, d);
		}
	}
}

// ---------------------------------------------------------------------------------------
// Messages and dialogs
// ---------------------------------------------------------------------------------------

function msgprint(msg, title) {
	const m = typeof msg === "object" && msg !== null ? msg : { message: msg, title };
	const body = Array.isArray(m.message) ? m.message.join("<br>") : m.message;
	if (!body && !m.title) return;
	const entry = {
		id: ++seq,
		title: m.title || "",
		html: String(body ?? ""),
		indicator: m.indicator || "",
		primary: m.primary_action || null,
		wide: !!m.wide,
	};
	ui.messages.push(entry);
	return {
		hide: () => (ui.messages = ui.messages.filter((x) => x.id !== entry.id)),
		set_title: (t) => (entry.title = t),
		$wrapper: jQuery("<div>"),
	};
}

function frappeThrow(msg, title) {
	const m = typeof msg === "object" && msg !== null ? msg : { message: msg, title };
	msgprint({ ...m, indicator: m.indicator || "red" });
	if (window.frappe) window.frappe.validated = false;
	const e = new Error(String(m.message).replace(/<[^>]+>/g, ""));
	e.fromThrow = true;
	throw e;
}

function showAlert(msg, seconds = 5) {
	const m = typeof msg === "object" && msg !== null ? msg : { message: msg };
	const entry = { id: ++seq, html: String(m.message ?? ""), indicator: m.indicator || "" };
	ui.alerts.push(entry);
	setTimeout(() => (ui.alerts = ui.alerts.filter((x) => x.id !== entry.id)), seconds * 1000);
}

function confirmDialog(message, ifYes, ifNo, title = "Confirm") {
	const d = new Dialog({
		title,
		fields: [
			{
				fieldtype: "HTML",
				fieldname: "msg",
				options: `<p class="text-[14px] leading-relaxed">${message}</p>`,
			},
		],
		primary_action_label: "Yes",
		primary_action: () => {
			d.hide(true);
			ifYes && ifYes();
		},
		secondary_action_label: "No",
		secondary_action: () => {
			d.hide(true);
			ifNo && ifNo();
		},
	});
	d.onhide = () => !d.__answered && ifNo && ifNo();
	d.show();
	return d;
}

export class Dialog {
	constructor(opts = {}) {
		this.id = ++seq;
		this.opts = opts;
		this.title = opts.title || "";
		this.size = opts.size || "small";
		this.primary_action_label =
			opts.primary_action_label || (opts.primary_action ? "Submit" : "");
		this.primary_action = opts.primary_action || null;
		this.secondary_action_label = opts.secondary_action_label || "";
		this.secondary_action = opts.secondary_action || null;
		this.state = reactive({
			fields: [],
			values: {},
			overrides: {},
			disabled: false,
			error: "",
		});
		this.fields = [];
		this.set_fields(opts.fields || []);
		this.$wrapper = jQuery("<div>");
		this.$body = jQuery("<div>");
		this.wrapper = this.$wrapper[0];
		this.body = this.$body[0];
		this.fields_dict = new Proxy(
			{},
			{
				get: (t, name) => {
					if (typeof name === "symbol") return undefined;
					const df = this.state.fields.find((d) => d.fieldname === name);
					if (!df) return undefined;
					return this.fieldHandle(df);
				},
			},
		);
		this.form = this.makeForm();
	}
	set_fields(fields) {
		const flat = [];
		const walk = (list) => {
			for (const df of list) {
				const d = { ...df };
				if (d.fieldtype === "Table" && !d.options) d.options = `__dialog_${d.fieldname}`;
				// Desk dialogs accept Select options as an array too.
				if (Array.isArray(d.options))
					d.options = d.options
						.map((o) => (typeof o === "object" ? o.value : o))
						.join("\n");
				if (d.default !== undefined && this.state.values[d.fieldname] === undefined) {
					this.state.values[d.fieldname] =
						d.fieldtype === "Table" ? [...(d.data || [])] : d.default;
				}
				if (d.fieldtype === "Table" && this.state.values[d.fieldname] === undefined)
					this.state.values[d.fieldname] = [...(d.data || [])];
				if (d.fieldtype === "Check" && this.state.values[d.fieldname] === undefined)
					this.state.values[d.fieldname] = 0;
				flat.push(d);
			}
		};
		walk(fields);
		this.state.fields = flat;
		this.fields = flat;
	}
	df(name) {
		const base = this.state.fields.find((d) => d.fieldname === name);
		return base ? { ...base, ...(this.state.overrides[name] || {}) } : null;
	}
	makeForm() {
		const dlg = this;
		const state = this.state;
		// Implements the subset of the record engine interface Field.vue relies on.
		return reactive({
			get doc() {
				return state.values;
			},
			doctype: "__dialog",
			busy: "",
			isNew: true,
			docstatus: 0,
			fieldsOf(key) {
				const table = state.fields.find((d) => d.options === key);
				return table?.fields || [];
			},
			df: (name, table) =>
				table ? dlg.df(table)?.fields?.find((d) => d.fieldname === name) : dlg.df(name),
			tableDoctype: (tf) => dlg.df(tf)?.options,
			evaluate(expr, row) {
				if (!expr) return true;
				expr = String(expr);
				if (expr.startsWith("eval:")) {
					try {
						// eslint-disable-next-line no-new-func
						return !!new Function("doc", `return (${expr.slice(5)})`)(
							row || state.values,
						);
					} catch {
						return true;
					}
				}
				return !!(row || state.values)[expr];
			},
			visible(df, row) {
				return !!df && !df.hidden && (!df.depends_on || this.evaluate(df.depends_on, row));
			},
			required(df, row) {
				return (
					!!df &&
					(!!df.reqd ||
						(!!df.mandatory_depends_on && this.evaluate(df.mandatory_depends_on, row)))
				);
			},
			readOnly(df, row) {
				return (
					!!df &&
					(!!df.read_only ||
						(!!df.read_only_depends_on &&
							this.evaluate(df.read_only_depends_on, row)) ||
						df.fieldtype === "Read Only")
				);
			},
			linkQuery(df) {
				const q = df.get_query;
				try {
					return (
						(typeof q === "function" ? q() : q) ||
						(df.filters ? { filters: df.filters } : {})
					);
				} catch {
					return {};
				}
			},
			async setValue(fieldname, value, row) {
				const target = row || state.values;
				if (target[fieldname] === value) return;
				target[fieldname] = value;
				const df = row ? null : dlg.df(fieldname);
				if (df?.onchange) {
					try {
						await df.onchange.call(dlg.fieldHandle(df), value);
					} catch (e) {
						if (!e.fromThrow) state.error = e.message;
					}
				}
				if (row) {
					const tableDf = state.fields.find(
						(d) => d.options === row.doctype || d.fieldname === row.parentfield,
					);
					const cdf = tableDf?.fields?.find((d) => d.fieldname === fieldname);
					if (cdf?.onchange) await cdf.onchange.call(dlg.fieldHandle(cdf), value);
				}
			},
			addRow(tableField, values = {}) {
				const rows = (state.values[tableField] ||= []);
				const row = {
					name: localName("row"),
					idx: rows.length + 1,
					parentfield: tableField,
					doctype: dlg.df(tableField)?.options,
					...values,
				};
				rows.push(row);
				return Promise.resolve(row);
			},
			removeRow(tableField, row) {
				const rows = state.values[tableField] || [];
				const i = rows.indexOf(row);
				if (i >= 0) rows.splice(i, 1);
				rows.forEach((r, n) => (r.idx = n + 1));
			},
			trigger(event, fieldname) {
				if (event === "button") {
					const df = dlg.df(fieldname);
					if (df?.click) df.click();
				}
				return Promise.resolve(true);
			},
			upload: () => Promise.resolve(null),
		});
	}
	fieldHandle(df) {
		const dlg = this;
		const el = document.createElement("div");
		return {
			df: new Proxy(df, {
				set(t, prop, value) {
					dlg.set_df_property(df.fieldname, prop, value);
					return true;
				},
				get: (t, prop) => dlg.df(df.fieldname)?.[prop],
			}),
			get value() {
				return dlg.state.values[df.fieldname];
			},
			get_value: () => dlg.state.values[df.fieldname],
			set_value: (v) => dlg.form.setValue(df.fieldname, v),
			refresh: () => {},
			refresh_input: () => {},
			set_focus: () => document.getElementById(`f-${df.fieldname}`)?.focus(),
			$wrapper: jQuery(el),
			$input: jQuery("<input>"),
			wrapper: el,
			grid: {
				get_selected_children: () =>
					(dlg.state.values[df.fieldname] || []).filter((r) => r.__checked),
				refresh: () => {},
				df,
				data: dlg.state.values[df.fieldname] || [],
			},
			set get_query(fn) {
				dlg.set_df_property(df.fieldname, "get_query", fn);
			},
		};
	}
	show() {
		if (!ui.dialogs.includes(this)) ui.dialogs.push(this);
		this.__answered = false;
		if (this.onshow) this.onshow();
		return this;
	}
	hide(answered = false) {
		this.__answered = answered;
		ui.dialogs = ui.dialogs.filter((d) => d !== this);
		if (this.onhide) this.onhide();
	}
	clear() {
		for (const k of Object.keys(this.state.values)) this.state.values[k] = null;
	}
	get_values(ignoreErrors = false) {
		const values = {};
		const missing = [];
		for (const df of this.state.fields) {
			if (
				!df.fieldname ||
				["Section Break", "Column Break", "HTML", "Button", "Heading"].includes(
					df.fieldtype,
				)
			)
				continue;
			const v = this.state.values[df.fieldname];
			const d = this.df(df.fieldname);
			if (
				this.form.required(d) &&
				this.form.visible(d) &&
				(v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length))
			)
				missing.push(d.label || d.fieldname);
			if (v !== undefined && v !== null && v !== "") values[df.fieldname] = v;
		}
		if (missing.length && !ignoreErrors) {
			this.state.error = `Fill in: ${missing.join(", ")}`;
			return null;
		}
		this.state.error = "";
		return values;
	}
	get_value(f) {
		return this.state.values[f];
	}
	set_value(f, v) {
		return this.form.setValue(f, v);
	}
	set_values(obj) {
		return Promise.all(Object.entries(obj || {}).map(([k, v]) => this.set_value(k, v)));
	}
	set_df_property(f, prop, value) {
		this.state.overrides[f] = { ...(this.state.overrides[f] || {}), [prop]: value };
	}
	set_title(t) {
		this.title = t;
	}
	set_primary_action(label, fn) {
		this.primary_action_label = label;
		this.primary_action = fn;
	}
	set_secondary_action(fn) {
		this.secondary_action = fn;
	}
	set_secondary_action_label(label) {
		this.secondary_action_label = label;
	}
	disable_primary_action() {
		this.state.disabled = true;
	}
	enable_primary_action() {
		this.state.disabled = false;
	}
	get_field(f) {
		return this.fields_dict[f];
	}
	refresh() {}
	set_message(m) {
		this.state.error = m;
	}
	clear_message() {
		this.state.error = "";
	}
	get_primary_btn() {
		return jQuery("<button>");
	}
	async runPrimary() {
		const values = this.get_values();
		if (!values || !this.primary_action) return;
		try {
			this.state.disabled = true;
			await this.primary_action(values);
		} catch (e) {
			if (!e.fromThrow) this.state.error = messageOf(e, "Something went wrong");
		} finally {
			this.state.disabled = false;
		}
	}
}

// ---------------------------------------------------------------------------------------
// The `frappe` global
// ---------------------------------------------------------------------------------------

// frappe.ui.form.MultiSelectDialog: ERPNext's "Get Items From" picker (Delivery Note from Sales
// Order, Purchase Receipt from Purchase Order, Stock Entry from Material Request...). Searches
// the source documents the way the desk does (frappe.desk.search.search_widget with the
// setters, the date and the script's get_query), lists them with a tick box, and optionally
// their item rows, then calls the script's action(selected_names, args).
class MultiSelectDialog {
	constructor(opts) {
		Object.assign(this, opts);
		this.page_length = 20;
		this.args = {};
		this.meta = metaFromCache(this.doctype) || { fields: [] };
		this.childDoctype = this.child_fieldname
			? this.meta.fields.find((d) => d.fieldname === this.child_fieldname)?.options
			: null;
		this.make();
	}
	setterFields() {
		if (Array.isArray(this.setters))
			return this.setters.map((df) => ({ ...df, onchange: () => this.refresh() }));
		return Object.entries(this.setters || {}).map(([fieldname, value]) => {
			const base = this.meta.fields.find((d) => d.fieldname === fieldname) || {};
			return {
				fieldname,
				label: base.label || frappeUnscrub(fieldname),
				fieldtype: ["Link", "Select", "Dynamic Link"].includes(base.fieldtype)
					? base.fieldtype
					: "Data",
				options: base.options,
				default: value,
				read_only: (this.read_only_setters || []).includes(fieldname) ? 1 : 0,
				onchange: () => this.refresh(),
			};
		});
	}
	columns() {
		const cols = [...this.setterFields().map((d) => d.fieldname)];
		if (this.date_field) cols.push(this.date_field);
		return cols.slice(0, 4);
	}
	make() {
		const setters = this.setterFields();
		const resultFields = [
			{ fieldname: "select", label: __("Select"), fieldtype: "Check", in_list_view: 1 },
			{
				fieldname: "name",
				label: __(this.doctype),
				fieldtype: "Data",
				read_only: 1,
				in_list_view: 1,
			},
			...this.columns().map((f) => ({
				fieldname: f,
				label: this.meta.fields.find((d) => d.fieldname === f)?.label || frappeUnscrub(f),
				fieldtype: "Data",
				read_only: 1,
				in_list_view: 1,
			})),
		];
		const childFields = this.childDoctype
			? [
					{
						fieldname: "select",
						label: __("Select"),
						fieldtype: "Check",
						in_list_view: 1,
					},
					{
						fieldname: "parent",
						label: __(this.doctype),
						fieldtype: "Data",
						read_only: 1,
						in_list_view: 1,
					},
					...(this.child_columns || []).slice(0, 4).map((f) => ({
						fieldname: f,
						label: frappeUnscrub(f),
						fieldtype: "Data",
						read_only: 1,
						in_list_view: 1,
					})),
			  ]
			: [];
		this.dialog = new Dialog({
			title: __("Select {0}", [__(this.doctype)]),
			size: "large",
			fields: [
				{
					fieldname: "search_term",
					label: __("Search"),
					fieldtype: "Data",
					onchange: () => this.refresh(),
				},
				...setters,
				...(this.date_field
					? [
							{
								fieldname: "__from",
								label: __("From date"),
								fieldtype: "Date",
								onchange: () => this.refresh(),
							},
							{
								fieldname: "__to",
								label: __("To date"),
								fieldtype: "Date",
								onchange: () => this.refresh(),
							},
					  ]
					: []),
				...(this.childDoctype && this.allow_child_item_selection
					? [
							{
								fieldname: "allow_child_item_selection",
								label: __("Select items"),
								fieldtype: "Check",
								onchange: () => this.loadChildren(),
							},
					  ]
					: []),
				{ fieldname: "__sec", fieldtype: "Section Break" },
				{
					fieldname: "results",
					label: __(this.doctype),
					fieldtype: "Table",
					cannot_add_rows: 1,
					cannot_delete_rows: 1,
					fields: resultFields,
					data: [],
					onchange: () => this.loadChildren(),
				},
				...(this.childDoctype
					? [
							{
								fieldname: "child_results",
								label: __("Items"),
								fieldtype: "Table",
								cannot_add_rows: 1,
								cannot_delete_rows: 1,
								fields: childFields,
								data: [],
								depends_on: "eval:doc.allow_child_item_selection",
							},
					  ]
					: []),
				...(this.data_fields || []),
			],
			primary_action_label: this.primary_action_label || __("Get Items"),
			primary_action: () => {
				const v = this.dialog.state.values;
				const picked = (v.results || []).filter((r) => r.select).map((r) => r.name);
				const children = (v.child_results || []).filter((r) => r.select);
				const data = {};
				for (const df of this.data_fields || []) data[df.fieldname] = v[df.fieldname];
				this.action([...new Set([...picked, ...children.map((r) => r.parent)])], {
					...this.args,
					...data,
					filtered_children: children.map((r) => r.name),
				});
			},
		});
		this.dialog.show();
		this.refresh();
	}
	filters() {
		const v = this.dialog.state.values;
		const fromQuery = (this.get_query ? this.get_query()?.filters : null) || {};
		const list = Array.isArray(fromQuery)
			? fromQuery.map((f) => (f.length === 3 ? [this.doctype, ...f] : f))
			: Object.entries(fromQuery).map(([k, val]) =>
					Array.isArray(val)
						? [this.doctype, k, val[0], val[1]]
						: [this.doctype, k, "=", val],
			  );
		const fields = [];
		for (const df of this.setterFields()) {
			const value = v[df.fieldname] ?? undefined;
			this.args[df.fieldname] = value || undefined;
			fields.push(df.fieldname);
			if (value === undefined || value === null || value === "") continue;
			list.push(
				df.fieldtype === "Data"
					? [this.doctype, df.fieldname, "like", `%${value}%`]
					: [this.doctype, df.fieldname, "=", value],
			);
		}
		if (this.date_field && (v.__from || v.__to)) {
			fields.push(this.date_field);
			if (v.__from) list.push([this.doctype, this.date_field, ">=", v.__from]);
			if (v.__to) list.push([this.doctype, this.date_field, "<=", v.__to]);
		} else if (this.date_field) fields.push(this.date_field);
		return [list, fields];
	}
	async refresh() {
		const [filters, filter_fields] = this.filters();
		const seq = (this.seq = (this.seq || 0) + 1);
		const r = await frappeCall({
			method: "frappe.desk.search.search_widget",
			args: {
				doctype: this.doctype,
				txt: this.dialog.state.values.search_term || "",
				filters,
				// A JSON string, as the desk sends it (the server checks the type).
				filter_fields: JSON.stringify(filter_fields),
				page_length: this.page_length + 5,
				query: this.get_query ? this.get_query()?.query || "" : "",
				query_filters_as_dict: true,
				as_dict: 1,
			},
			silent: true,
		}).catch(() => ({ message: [] }));
		if (seq !== this.seq) return;
		const picked = new Set(
			(this.dialog.state.values.results || []).filter((x) => x.select).map((x) => x.name),
		);
		this.dialog.state.values.results = (r.message || [])
			.slice(0, this.page_length)
			.map((d) => ({
				...Object.fromEntries(
					Object.entries(d).map(([k, val]) => [k, val === null ? "" : String(val)]),
				),
				name: d.name,
				select: picked.has(d.name) ? 1 : 0,
				doctype: "__dialog_results",
				__islocal: 1,
			}));
		this.loadChildren();
	}
	async loadChildren() {
		const v = this.dialog.state.values;
		if (!this.childDoctype || !v.allow_child_item_selection) return;
		const parents = (v.results || []).filter((r) => r.select).map((r) => r.name);
		if (!parents.length) {
			v.child_results = [];
			return;
		}
		const r = await frappeCall({
			method: "frappe.client.get_list",
			args: {
				doctype: this.childDoctype,
				filters: [
					["parentfield", "=", this.child_fieldname],
					["parent", "in", parents],
				],
				fields: ["name", "parent", ...(this.child_columns || [])],
				parent: this.doctype,
				limit_page_length: 200,
				order_by: "parent",
			},
			silent: true,
		}).catch(() => ({ message: [] }));
		v.child_results = (r.message || []).map((d) => ({
			...d,
			select: 1,
			doctype: "__dialog_child_results",
			__islocal: 1,
		}));
	}
}

// frappe.DataTable for the tables desk scripts draw into a form (an asset's depreciation
// entries, a ledger preview): a plain briskrew table with the same options.
class DeskDataTable {
	constructor(wrapper, opts = {}) {
		this.wrapper = wrapper?.get ? wrapper.get(0) : wrapper;
		this.options = opts;
		this.style = { setStyle: () => {} };
		this.rowmanager = { getCheckedRows: () => [...this.checked] };
		this.checked = new Set();
		this.refresh(opts.data, opts.columns);
	}
	refresh(data = this.options.data, columns = this.options.columns) {
		this.options.data = data || [];
		this.options.columns = columns || [];
		const cols = this.options.columns.map((c) =>
			typeof c === "string"
				? { name: c, id: c }
				: { ...c, id: c.id || c.fieldname || c.name },
		);
		const cell = (row, c, i) => {
			const raw = Array.isArray(row) ? row[i] : row[c.id] ?? row[c.fieldname];
			return c.format ? c.format(raw, row, c) : escapeHtml(raw ?? "");
		};
		const head = cols
			.map((c) => `<th>${escapeHtml(c.name || c.label || c.id || "")}</th>`)
			.join("");
		const body = this.options.data
			.map(
				(row, r) =>
					`<tr>${
						this.options.checkboxColumn
							? `<td><input type="checkbox" data-row="${r}"></td>`
							: ""
					}${cols.map((c, i) => `<td>${cell(row, c, i)}</td>`).join("")}</tr>`,
			)
			.join("");
		if (!this.wrapper) return;
		this.wrapper.innerHTML = `<div class="bk-dt"><table><thead><tr>${
			this.options.checkboxColumn ? "<th></th>" : ""
		}${head}</tr></thead><tbody>${body}</tbody></table></div>`;
		this.wrapper
			.querySelectorAll("input[data-row]")
			.forEach((el) =>
				el.addEventListener("change", () =>
					el.checked
						? this.checked.add(+el.dataset.row)
						: this.checked.delete(+el.dataset.row),
				),
			);
	}
}

const frappeUnscrub = (s) =>
	String(s || "")
		.replace(/[_-]/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());

function routeTo(args) {
	const router = current?.router;
	const parts = args.flat().filter((x) => x !== undefined && x !== null);
	const options = window.frappe.route_options || null;
	window.frappe.route_options = null;
	const [kind, doctype, name] = parts;
	const query = {};
	if (options)
		for (const [k, v] of Object.entries(options))
			query[k] = Array.isArray(v) ? JSON.stringify(v) : v;
	if (router && kind === "Form" && doctype)
		return router.push({ name: "Form", params: { doctype, name: name || "new" }, query });
	if (router && kind === "List" && doctype)
		return router.push({ name: "List", params: { doctype }, query });
	if (router && typeof kind === "string" && kind.startsWith("/")) return router.push(kind);
	// Anything else (reports, tree views, pages) opens in the classic desk.
	const slug = (s) => String(s).toLowerCase().replace(/ /g, "-");
	const path =
		kind === "query-report"
			? `/app/query-report/${encodeURIComponent(doctype)}`
			: kind === "Tree"
			  ? `/app/${slug(doctype)}/view/tree`
			  : `/app/${parts
						.map((p) => (/^[A-Z]/.test(p) ? slug(p) : encodeURIComponent(p)))
						.join("/")}`;
	const q = new URLSearchParams(query).toString();
	window.location.href = q ? `${path}?${q}` : path;
}

function newLocalDoc(doctype, parent, parentfield) {
	const meta = metaFromCache(doctype);
	const doc = { doctype, name: localName(doctype), __islocal: 1, docstatus: 0 };
	for (const d of meta?.fields || [])
		if (
			d.default !== undefined &&
			d.default !== null &&
			!["Section Break", "Column Break", "Tab Break"].includes(d.fieldtype)
		)
			doc[d.fieldname] = d.default === "Today" ? dayjs().format("YYYY-MM-DD") : d.default;
	if (parent && parentfield) {
		doc.parent = parent.name;
		doc.parenttype = parent.doctype;
		doc.parentfield = parentfield;
		const f = current?.form;
		if (f && parent === f.doc) return f.addRowSync(parentfield, doc);
		(parent[parentfield] ||= []).push(doc);
		doc.idx = parent[parentfield].length;
	} else {
		localDocs.set(doc.name, doc);
	}
	return doc;
}

function findLocal(doctype, name) {
	const f = current?.form;
	if (f?.doc) {
		if (f.doc.doctype === doctype && f.doc.name === name) return f.doc;
		for (const tf of (f.meta?.fields || []).filter(
			(d) => d.fieldtype === "Table" || d.fieldtype === "Table MultiSelect",
		)) {
			const row = (f.doc[tf.fieldname] || []).find((r) => r.name === name);
			if (row) return row;
		}
	}
	return localDocs.get(name) || bootDocs[doctype]?.[name] || null;
}

// Documents installed apps put in the desk's boot (ERPNext's ":Company" and ":Currency"),
// which scripts read from locals (erpnext.get_currency, tree options).
const bootDocs = {};
function loadBootDocs(docs) {
	for (const d of docs || []) if (d?.doctype && d.name) (bootDocs[d.doctype] ||= {})[d.name] = d;
}

// The route before this one, as the desk's frappe.get_prev_route() gives it.
function prevRoute() {
	const back = window.history.state?.back;
	if (!back) return [];
	const parts = String(back).split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
	if (parts[0] === "r" && parts.length >= 3) return ["Form", parts[1], parts[2]];
	if (parts[0] === "r" && parts[1]) return ["List", parts[1]];
	if (parts[0] === "report" && parts[1]) return ["query-report", parts[1]];
	return parts;
}

function modelSetValue(doctype, name, field, value) {
	const f = current?.form;
	const target = findLocal(doctype, name);
	if (!target) return Promise.resolve();
	const pairs = typeof field === "object" ? Object.entries(field) : [[field, value]];
	const isRow = f && target !== f.doc && target.parentfield;
	return Promise.all(
		pairs.map(([k, v]) =>
			f && (target === f.doc || isRow)
				? f.setValue(k, v, isRow ? target : null)
				: ((target[k] = v), null),
		),
	);
}

const datetime = {
	get_today: () => dayjs().format("YYYY-MM-DD"),
	nowdate: () => dayjs().format("YYYY-MM-DD"),
	now_date: (asObj) => (asObj ? new Date() : dayjs().format("YYYY-MM-DD")),
	now_datetime: () => dayjs().format("YYYY-MM-DD HH:mm:ss"),
	now_time: () => dayjs().format("HH:mm:ss"),
	add_days: (d, n) => dayjs(d).add(n, "day").format("YYYY-MM-DD"),
	add_months: (d, n) => dayjs(d).add(n, "month").format("YYYY-MM-DD"),
	get_diff: (a, b) => dayjs(a).startOf("day").diff(dayjs(b).startOf("day"), "day"),
	get_day_diff: (a, b) => dayjs(a).startOf("day").diff(dayjs(b).startOf("day"), "day"),
	get_hour_diff: (a, b) => dayjs(a).diff(dayjs(b), "hour", true),
	get_minute_diff: (a, b) => dayjs(a).diff(dayjs(b), "minute", true),
	str_to_obj: (s) => (s ? dayjs(s).toDate() : null),
	obj_to_str: (d) => (d ? dayjs(d).format("YYYY-MM-DD") : ""),
	obj_to_user: (d) => (d ? dayjs(d).format("DD-MM-YYYY") : ""),
	str_to_user: (s) =>
		s ? dayjs(s).format(String(s).length > 10 ? "DD-MM-YYYY HH:mm" : "DD-MM-YYYY") : "",
	user_to_str: (s) => {
		const m = String(s || "").match(/^(\d{2})-(\d{2})-(\d{4})(.*)$/);
		return m ? `${m[3]}-${m[2]}-${m[1]}${m[4]}` : s;
	},
	user_to_obj: (s) => dayjs(datetime.user_to_str(s)).toDate(),
	month_start: (d) => dayjs(d).startOf("month").format("YYYY-MM-DD"),
	month_end: (d) => dayjs(d).endOf("month").format("YYYY-MM-DD"),
	year_start: (d) => dayjs(d).startOf("year").format("YYYY-MM-DD"),
	year_end: (d) => dayjs(d).endOf("year").format("YYYY-MM-DD"),
	// Ports of frappe/public/js/frappe/utils/datetime.js (MIT).
	global_date_format: (d) => {
		const hasTime = /\d{2}:\d{2}/.test(String(d || ""));
		return d ? dayjs(d).format(hasTime ? "D MMMM YYYY, hh:mm A" : "D MMMM YYYY") : "";
	},
	get_time: (timestamp) => dayjs(timestamp).format("hh:mm A"),
	system_datetime: (asObj = false) =>
		asObj ? new Date() : dayjs().format("YYYY-MM-DD HH:mm:ss"),
	is_timezone_same: () => true,
	is_system_time_zone: () => true,
	get_user_date_fmt: () => "dd-mm-yyyy",
	get_user_time_fmt: () => "HH:mm:ss",
	convert_to_user_tz: (d) => d,
	convert_to_system_tz: (d) => d,
	prettyDate: (d) => dayjs(d).format("D MMM YYYY"),
	comment_when: (d) => dayjs(d).format("D MMM YYYY, HH:mm"),
	get_datetime_as_string: (d) => dayjs(d).format("YYYY-MM-DD HH:mm:ss"),
	now: () => new Date(),
	validate: (s) => dayjs(s).isValid(),
};

function formatValue(value, df = {}, options = {}, doc = null) {
	const t = df.fieldtype;
	if (value === null || value === undefined || value === "") return "";
	if (t === "Currency")
		return formatCurrency(value, (doc && df.options && doc[df.options]) || options.currency);
	if (["Float", "Percent"].includes(t)) return flt(value, df.precision ?? 2).toLocaleString();
	if (t === "Int") return String(cint(value));
	if (t === "Date") return dayjs(value).format("DD-MM-YYYY");
	if (t === "Datetime") return dayjs(value).format("DD-MM-YYYY HH:mm");
	if (t === "Check") return value ? "Yes" : "No";
	return escapeHtml(value);
}

function formatCurrency(value, currency) {
	try {
		return Number(value || 0).toLocaleString(
			undefined,
			currency ? { style: "currency", currency } : { minimumFractionDigits: 2 },
		);
	} catch {
		return flt(value, 2).toFixed(2);
	}
}

// The desk keeps every user's name in boot; here names are fetched once and cached.
const userNames = new Map();
function userFullName(uid) {
	uid = uid || booted?.user;
	if (!uid) return "";
	if (uid === booted?.user) return booted.user_fullname;
	if (!userNames.has(uid)) {
		let name = uid;
		syncCall({
			method: "frappe.client.get_value",
			args: { doctype: "User", filters: { name: uid }, fieldname: "full_name" },
			silent: true,
			callback: (r) => (name = r.message?.full_name || uid),
		});
		userNames.set(uid, name);
	}
	return userNames.get(uid);
}

// frappe.utils.filter_dict, ported from frappe/public/js/frappe/utils/utils.js (MIT): a list or
// {name: doc} of docs, filtered by {field: value} or {field: [operator, value]}.
function filterDict(dict, filters) {
	const list = Array.isArray(dict) ? dict : Object.values(dict || {});
	if (typeof filters === "string") return [dict?.[filters]].filter(Boolean);
	if (!filters) return list;
	return list.filter((d) =>
		Object.entries(filters).every(([key, f]) => {
			if (!Array.isArray(f)) return d[key] == f; // eslint-disable-line eqeqeq
			const [op, val] = f;
			if (op === "in") return [].concat(val).includes(d[key]);
			if (op === "not in") return ![].concat(val).includes(d[key]);
			if (op === "<") return d[key] < val;
			if (op === "<=") return d[key] <= val;
			if (op === ">") return d[key] > val;
			if (op === ">=") return d[key] >= val;
			return true;
		}),
	);
}

function commaSep(list, sep) {
	if (!Array.isArray(list)) return list;
	if (list.length <= 1) return list[0] ?? "";
	return `${list.slice(0, -1).join(", ")}${sep}${list[list.length - 1]}`;
}

// Field names of a doctype matching a test, from the open form's metas.
function fieldnamesOf(doctype, test) {
	const f = current?.form;
	const fields = (f?.doctype === doctype ? f.meta.fields : metaFromCache(doctype)?.fields) || [];
	return fields.filter(test).map((d) => d.fieldname);
}

// Docs of a doctype that the open form knows: the form's own record, its rows, and loaded docs.
function docsOf(doctype) {
	const out = [];
	const doc = current?.form?.doc;
	if (doc?.doctype === doctype) out.push(doc);
	for (const v of Object.values(doc || {}))
		if (Array.isArray(v)) out.push(...v.filter((r) => r?.doctype === doctype));
	for (const d of localDocs.values())
		if (d?.doctype === doctype && !out.includes(d)) out.push(d);
	return out;
}

// Addresses and contacts of a customer, supplier, warehouse... from what the server sends with
// the record (__onload.addr_list / contact_list), as the desk shows them.
function renderAddressAndContact(frm) {
	const onload = frm.doc.__onload || {};
	const card = (title, lines, href) =>
		`<a href="${href}" class="bk-addr-card">${[
			`<strong>${escapeHtml(title)}</strong>`,
			...lines.filter(Boolean).map(escapeHtml),
		].join("<br>")}</a>`;
	const link = (dt, name) => `/flow/r/${encodeURIComponent(dt)}/${encodeURIComponent(name)}`;
	const newLink = (dt) =>
		`<a href="${link(dt, "new")}?link_doctype=${encodeURIComponent(
			frm.doctype,
		)}&link_name=${encodeURIComponent(frm.doc.name)}" class="bk-addr-new">+ ${escapeHtml(
			__("New {0}", [__(dt)]),
		)}</a>`;
	if (frm.fields_dict.address_html && "addr_list" in onload) {
		const html = (onload.addr_list || [])
			.map((a) =>
				card(
					a.address_title || a.name,
					[
						a.address_type,
						a.address_line1,
						a.address_line2,
						[a.city, a.state, a.pincode].filter(Boolean).join(", "),
						a.country,
					],
					link("Address", a.name),
				),
			)
			.join("");
		jQuery(frm.fields_dict.address_html.wrapper).html(
			`<div class="bk-addr-list">${
				html || `<p>${escapeHtml(__("No address yet."))}</p>`
			}${newLink("Address")}</div>`,
		);
	}
	if (frm.fields_dict.contact_html && "contact_list" in onload) {
		const html = (onload.contact_list || [])
			.map((c) =>
				card(
					[c.first_name, c.last_name].filter(Boolean).join(" ") || c.name,
					[c.designation, c.email_id, c.phone || c.mobile_no],
					link("Contact", c.name),
				),
			)
			.join("");
		jQuery(frm.fields_dict.contact_html.wrapper).html(
			`<div class="bk-addr-list">${
				html || `<p>${escapeHtml(__("No contact yet."))}</p>`
			}${newLink("Contact")}</div>`,
		);
	}
}

// frappe.provide("erpnext.stock"): real namespaces, never a stand-in. The lenient stand-ins
// answer any name, so ask whether the namespace exists rather than whether it's truthy.
function provide(path) {
	let obj = window;
	for (const part of path.split(".")) {
		if (!(part in obj) || obj[part] === undefined || obj[part] === null) obj[part] = {};
		obj = obj[part];
	}
	return obj;
}

function buildFrappe() {
	const b = booted || {};
	const roles = b.roles || [];
	const frappe = {
		provide,
		user_defaults: b.defaults || {},
		DataTable: DeskDataTable,
		// Display formatters scripts register per doctype (ERPNext: "Item: Item Name").
		form: { link_formatters: {}, formatters: {} },
		route_hooks: {},
		msgprint_dialog: { hide_on_page_refresh: false, hide: () => {} },
		dynamic_link: {},
		contacts: lenient(
			{
				render_address_and_contact: renderAddressAndContact,
				clear_address_and_contact: (frm) => {
					for (const f of ["address_html", "contact_html"])
						if (frm.fields_dict[f]) jQuery(frm.fields_dict[f].wrapper).empty();
				},
			},
			"frappe.contacts",
		),
		call: frappeCall,
		xcall: (method, args) => frappeCall({ method, args, silent: true }).then((r) => r.message),
		msgprint,
		throw: frappeThrow,
		show_alert: showAlert,
		confirm: confirmDialog,
		warn: (title, message, proceed, label) =>
			confirmDialog(message, proceed, null, title || label),
		prompt(fields, callback, title, primaryLabel) {
			const list =
				typeof fields === "string"
					? [{ label: fields, fieldname: "value", fieldtype: "Data", reqd: 1 }]
					: [].concat(fields);
			const d = new Dialog({
				title: title || "Enter value",
				fields: list,
				primary_action_label: primaryLabel || "Submit",
				primary_action: (values) => {
					d.hide(true);
					callback && callback(values);
				},
			});
			d.show();
			return d;
		},
		show_progress(title, count, total, description) {
			ui.progress = { title, count, total, description };
		},
		hide_progress() {
			ui.progress = null;
		},
		set_route: (...args) => routeTo(args),
		route_options: null,
		new_doc(doctype, opts) {
			const values = { ...(window.frappe.route_options || {}), ...(opts || {}) };
			window.frappe.route_options = null;
			const doc = newLocalDoc(doctype);
			Object.assign(doc, values);
			return current?.router?.push({ name: "Form", params: { doctype, name: doc.name } });
		},
		get_doc: (doctype, name) => findLocal(doctype, name),
		get_meta: (doctype) => metaFromCache(doctype),
		// Each task gets the previous one's result, as in the desk.
		run_serially: (tasks) =>
			tasks.reduce((result, task) => (task ? result.then(task) : result), Promise.resolve()),
		render_template: (name, data) =>
			microtemplate(window.frappe.templates[name] ?? name, data),
		templates: {},
		scrub: (s) =>
			String(s || "")
				.toLowerCase()
				.replace(/[ -]/g, "_"),
		unscrub: (s) =>
			String(s || "")
				.replace(/_/g, " ")
				.replace(/\b\w/g, (c) => c.toUpperCase()),
		format: formatValue,
		session: { user: b.user, user_fullname: b.user_fullname, user_email: b.user_email },
		user: lenient(
			{
				name: b.user,
				has_role: (r) => [].concat(r).some((x) => roles.includes(x)),
				full_name: userFullName,
				image: () => null,
				abbr: (u) => String(userFullName(u) || "").slice(0, 1),
			},
			"frappe.user",
		),
		user_roles: roles,
		boot: lenient(
			{
				// What installed apps add to the desk's boot (ERPNext's settings, party types...).
				...(b.desk || {}),
				user: { name: b.user, roles, ...(b.desk?.user_perms || {}) },
				docs: b.desk?.docs || [],
				sysdefaults: b.sysdefaults || {},
				sysdefaults_currency: b.sysdefaults?.currency,
			},
			"frappe.boot",
		),
		defaults: lenient(
			{
				get_default: (k) => (b.defaults || {})[k] ?? (b.sysdefaults || {})[k] ?? null,
				// Keys are stored lower-case ("company"); scripts ask for "Company".
				get_user_default: (k) =>
					(b.defaults || {})[k] ?? (b.defaults || {})[String(k).toLowerCase()] ?? null,
				get_user_defaults: (k) =>
					[].concat(
						(b.defaults || {})[k] ?? (b.defaults || {})[String(k).toLowerCase()] ?? [],
					),
				get_global_default: (k) => (b.sysdefaults || {})[k] ?? null,
				// { Company: [{ doc, applicable_for, is_default }...] }, as the desk loads them
				get_user_permissions: () => b.desk?.user_permissions || {},
			},
			"frappe.defaults",
		),
		validated: true,
		datetime: lenient(datetime, "frappe.datetime"),
		utils: lenient(
			{
				escape_html: escapeHtml,
				get_form_link: (dt, dn, html, label) => {
					const href = `/flow/r/${encodeURIComponent(dt)}/${encodeURIComponent(dn)}`;
					return html ? `<a href="${href}">${escapeHtml(label || dn)}</a>` : href;
				},
				get_url_to_form: (dt, dn) =>
					`/flow/r/${encodeURIComponent(dt)}/${encodeURIComponent(dn)}`,
				debounce: (fn, wait = 200) => {
					let t;
					return (...a) => {
						clearTimeout(t);
						t = setTimeout(() => fn(...a), wait);
					};
				},
				sum: (list) => (list || []).reduce((a, x) => a + flt(x), 0),
				unique: (list) => [...new Set(list || [])],
				is_json: (s) => {
					try {
						JSON.parse(s);
						return true;
					} catch {
						return false;
					}
				},
				icon: () => "",
				filter_dict: filterDict,
				comma_or: (list) => commaSep(list, ` ${__("or")} `),
				comma_and: (list) => commaSep(list, ` ${__("and")} `),
				comma_sep: commaSep,
				html2text: (html) =>
					new DOMParser().parseFromString(String(html ?? ""), "text/html").body
						.textContent,
				guess_colour: () => "blue",
				bind_actions_with_object: (wrapper, object) =>
					jQuery(wrapper)
						.find("[data-action]")
						.each((i, el) =>
							jQuery(el).on("click", (e) => object[el.dataset.action]?.(e, el)),
						),
				get_random: (n = 8) =>
					Math.random()
						.toString(36)
						.slice(2, 2 + n),
				play_sound: () => {},
				copy_to_clipboard: (s) => navigator.clipboard?.writeText(s),
				format_currency: formatCurrency,
			},
			"frappe.utils",
		),
		model: lenient(
			{
				// Field-type lists from frappe/model/model.js (MIT).
				no_value_type: [
					"Section Break",
					"Column Break",
					"Tab Break",
					"Attachment Gallery",
					"HTML",
					"Table",
					"Table MultiSelect",
					"Button",
					"Image",
					"Fold",
					"Heading",
				],
				layout_fields: ["Section Break", "Column Break", "Tab Break", "Fold"],
				table_fields: ["Table", "Table MultiSelect"],
				numeric_fieldtypes: ["Int", "Float", "Currency", "Percent", "Duration"],
				html_fieldtypes: [
					"Text Editor",
					"Text",
					"Small Text",
					"Long Text",
					"HTML Editor",
					"Markdown Editor",
					"Code",
				],
				std_fields_list: [
					"name",
					"owner",
					"creation",
					"modified",
					"modified_by",
					"_user_tags",
					"_assign",
					"_liked_by",
					"docstatus",
					"idx",
				],
				child_table_field_list: ["parent", "parenttype", "parentfield"],
				is_value_type(fieldtype) {
					if (fieldtype && typeof fieldtype === "object")
						fieldtype = fieldtype.fieldtype;
					return !this.no_value_type.includes(fieldtype);
				},
				is_numeric_field(fieldtype) {
					if (fieldtype && typeof fieldtype === "object")
						fieldtype = fieldtype.fieldtype;
					return this.numeric_fieldtypes.includes(fieldtype);
				},
				is_non_std_field(fieldname) {
					return ![...this.std_fields_list, ...this.child_table_field_list].includes(
						fieldname,
					);
				},
				set_value: modelSetValue,
				// As in the desk: with a callback it asks the server, otherwise it reads only what
				// is loaded locally (":Currency" lookups and the like).
				get_value: (doctype, filters, fieldname, cb) => {
					if (cb)
						return frappeCall({
							method: "frappe.client.get_value",
							args: { doctype, filters, fieldname },
							callback: (r) => cb(r.message),
						});
					const local =
						typeof filters === "string"
							? findLocal(doctype, filters)
							: Object.values(bootDocs[doctype] || {}).find((d) =>
									Object.entries(filters || {}).every(([k, v]) => d[k] === v),
							  );
					return local ? local[fieldname] : null;
				},
				get_doc: (doctype, name) => findLocal(doctype, name),
				get_new_doc: (doctype, parent, parentfield) =>
					newLocalDoc(doctype, parent, parentfield),
				add_child: (doc, doctype, parentfield) => {
					// add_child(doc, parentfield) is also accepted by the desk.
					if (!parentfield) {
						parentfield = doctype;
						doctype = current?.form?.tableDoctype(parentfield);
					}
					return newLocalDoc(doctype, doc, parentfield);
				},
				clear_table: (doc, field) => {
					doc[field] = [];
					if (current?.form) current.form.dirty = true;
				},
				sync: (docs) => {
					syncDocs(docs);
					return [].concat(docs || []);
				},
				with_doctype: (dt, cb) => getMeta(dt).then(() => cb && cb()),
				with_doc: async (dt, dn, cb) => {
					const local = findLocal(dt, dn);
					if (local) {
						cb && cb(dn, { docs: [local] });
						return local;
					}
					const r = await rawCall("frappe.client.get", { doctype: dt, name: dn });
					localDocs.set(dn, r.message);
					cb && cb(dn, { docs: [r.message] });
					return r.message;
				},
				open_mapped_doc: async (opts) => {
					const frm = opts.frm || window.cur_frm;
					const r = await frappeCall({
						method: opts.method,
						args: {
							source_name: opts.source_name || frm.doc.name,
							args: opts.args,
							selected_children: opts.selected_children,
						},
						freeze: true,
					});
					const doc = r.message;
					if (!doc) return;
					doc.name = localName(doc.doctype);
					doc.__islocal = 1;
					localDocs.set(doc.name, doc);
					current?.router?.push({
						name: "Form",
						params: { doctype: doc.doctype, name: doc.name },
					});
				},
				can_create: () => true,
				can_read: () => true,
				can_write: () => true,
				has_workflow: (dt) => !!metaFromCache(dt)?.__workflow_docs?.length,
				is_submittable: (dt) => !!metaFromCache(dt)?.is_submittable,
				validate_missing: (doc, field) => {
					if (!doc[field])
						frappeThrow(
							`${
								metaFromCache(doc.doctype)?.fields?.find(
									(d) => d.fieldname === field,
								)?.label || field
							} is required`,
						);
				},
				// Ports of frappe/public/js/frappe/model/model.js (MIT).
				round_floats_in(doc, fieldnames) {
					if (!doc) return;
					fieldnames ||= fieldnamesOf(doc.doctype, (d) =>
						["Currency", "Float"].includes(d.fieldtype),
					);
					for (const f of fieldnames) doc[f] = flt(doc[f], window.precision(f, doc));
				},
				get_list: (doctype, filters) => filterDict(docsOf(doctype), filters),
				unscrub: (s) =>
					String(s || "")
						.replace(/[_-]/g, " ")
						.replace(/\b\w/g, (c) => c.toUpperCase()),
				remove_from_locals: (doctype, name) => localDocs.delete(name),
				copy_doc(doc, from_amend, parent_doc, parentfield) {
					const copy = newLocalDoc(doc.doctype, parent_doc, parentfield);
					const skip = [
						"name",
						"owner",
						"creation",
						"modified",
						"modified_by",
						"docstatus",
					];
					for (const [k, v] of Object.entries(doc)) {
						if (skip.includes(k) || k.startsWith("__")) continue;
						copy[k] = Array.isArray(v)
							? v.map((row) => {
									const r = { ...row, name: localName(row.doctype) };
									r.__islocal = 1;
									r.parent = copy.name;
									return r;
							  })
							: v;
					}
					if (from_amend) copy.amended_from = doc.name;
					return copy;
				},
				make_new_doc_and_get_name: (doctype) => newLocalDoc(doctype).name,
				trigger: (fieldname, value, doc) =>
					current?.form &&
					dispatch(
						current.form,
						doc?.doctype || current.form.doctype,
						fieldname,
						doc?.doctype,
						doc?.name,
					),
				core_doctypes_list: [
					"DocType",
					"DocField",
					"DocPerm",
					"User",
					"Role",
					"Has Role",
					"Page",
					"Module Def",
					"Print Format",
					"Report",
					"Customize Form",
					"Customize Form Field",
					"Property Setter",
					"Custom Field",
					"Client Script",
				],
				scrub: (s) =>
					String(s || "")
						.toLowerCase()
						.replace(/[ -]/g, "_"),
				docinfo: {},
				get_children: (doc, field) => doc?.[field] || [],
				user_settings: {},
			},
			"frappe.model",
		),
		meta: lenient(
			{
				get_docfield: (dt, fieldname) => {
					const f = current?.form;
					if (f?.doctype === dt) return f.df(fieldname);
					const table = f?.meta?.fields.find(
						(d) =>
							d.options === dt &&
							(d.fieldtype === "Table" || d.fieldtype === "Table MultiSelect"),
					);
					if (table) return f.df(fieldname, table.fieldname);
					return (
						metaFromCache(dt)?.fields.find((d) => d.fieldname === fieldname) || null
					);
				},
				has_field: (dt, fieldname) =>
					!!metaFromCache(dt)?.fields.some((d) => d.fieldname === fieldname),
				get_label: (dt, fieldname) =>
					metaFromCache(dt)?.fields.find((d) => d.fieldname === fieldname)?.label ||
					fieldname,
				get_field_currency: (df, doc) =>
					(doc && df?.options && doc[df.options]) || booted?.sysdefaults?.currency,
				get_field_precision: (df) => df?.precision ?? 2,
				// { doctype: { fieldname: docfield } } for every loaded doctype, as in the desk
				// (scripts tweak print_hide and the like on these).
				docfield_map: new Proxy(
					{},
					{
						get(t, dt) {
							if (typeof dt === "symbol") return undefined;
							if (!t[dt]) {
								const meta = metaFromCache(dt);
								if (!meta) return undefined;
								t[dt] = Object.fromEntries(
									meta.fields.map((d) => [d.fieldname, d]),
								);
							}
							return t[dt];
						},
					},
				),
				get_docfields: (dt, name, filters) =>
					filterDict(metaFromCache(dt)?.fields || [], filters),
				get_fieldnames: (dt, name, filters) =>
					filterDict(metaFromCache(dt)?.fields || [], filters).map((d) => d.fieldname),
				get_translated_label: (dt, fieldname) =>
					__(
						metaFromCache(dt)?.fields.find((d) => d.fieldname === fieldname)?.label ||
							fieldname,
					),
				get_parentfield: (parent_dt, child_dt) =>
					metaFromCache(parent_dt)?.fields.find(
						(d) =>
							["Table", "Table MultiSelect"].includes(d.fieldtype) &&
							d.options === child_dt,
					)?.fieldname,
			},
			"frappe.meta",
		),
		db: lenient(
			{
				get_value: (doctype, filters, fieldname, cb, parent) =>
					frappeCall({
						method: "frappe.client.get_value",
						args: { doctype, filters, fieldname, parent },
						silent: true,
					}).then((r) => {
						cb && cb(r.message);
						return r;
					}),
				get_single_value: (doctype, field) =>
					frappeCall({
						method: "frappe.client.get_single_value",
						args: { doctype, field },
						silent: true,
					}).then((r) => r.message),
				get_doc: (doctype, name, filters) =>
					frappeCall({
						method: "frappe.client.get",
						args: { doctype, name, filters },
						silent: true,
					}).then((r) => r.message),
				get_list: (doctype, args = {}) =>
					frappeCall({
						method: "frappe.client.get_list",
						args: {
							doctype,
							fields: args.fields,
							filters: args.filters,
							order_by: args.order_by,
							limit_page_length: args.limit ?? 20,
						},
						silent: true,
					}).then((r) => r.message),
				exists: (doctype, name) =>
					frappeCall({
						method: "frappe.client.get_count",
						args: { doctype, filters: { name } },
						silent: true,
					}).then((r) => !!r.message),
				count: (doctype, args = {}) =>
					frappeCall({
						method: "frappe.client.get_count",
						args: { doctype, filters: args.filters },
						silent: true,
					}).then((r) => r.message),
				set_value: (doctype, name, fieldname, value) =>
					frappeCall({
						method: "frappe.client.set_value",
						args: { doctype, name, fieldname, value },
					}),
				insert: (doc) =>
					frappeCall({ method: "frappe.client.insert", args: { doc } }).then(
						(r) => r.message,
					),
				delete_doc: (doctype, name) =>
					frappeCall({ method: "frappe.client.delete", args: { doctype, name } }),
				get_link_options: (doctype, txt = "", filters = {}, page_length = 0) =>
					frappeCall({
						method: "frappe.desk.search.search_link",
						args: { doctype, txt, filters, page_length },
						silent: true,
					}).then((r) => r.message),
			},
			"frappe.db",
		),
		ui: lenient(
			{
				form: lenient(
					{
						// Handlers registered while no form is open (ERPNext's bundle does this on
						// app_ready) apply to every later form of that type, as in the desk.
						on: (doctype, handlers, fn) => {
							const h = typeof handlers === "string" ? { [handlers]: fn } : handlers;
							if (!current) (globalHandlers[doctype] ||= []).push(h);
							else (current.handlers[doctype] ||= []).push(h);
						},
						Controller: class {
							constructor(opts) {
								Object.assign(this, opts);
							}
						},
						MultiSelectDialog,
						trigger: (doctype, fieldname) =>
							current?.frm?.script_manager.trigger(fieldname, doctype),
						is_saving: false,
						// Base classes ERPNext's desk bundle extends when it loads (phone and quick
						// entry controls). Their desk-only rendering is not used in briskrew.
						ControlData: class {
							constructor(opts) {
								Object.assign(this, opts);
							}
						},
						QuickEntryForm: class {
							constructor(doctype, after_insert) {
								this.doctype = doctype;
								this.after_insert = after_insert;
							}
						},
						qz_connect: () => {},
						set_controller: (doctype, Klass) => {
							if (!current || doctype !== current.form.doctype) return;
							window.extend_cscript(
								current.frm.cscript,
								new Klass({ frm: current.frm }),
							);
						},
					},
					"frappe.ui.form",
				),
				Dialog,
				hide_open_dialog: () => ui.dialogs.at(-1)?.hide(),
				toolbar: { clear_cache: () => window.location.reload() },
				open_dialogs: [],
			},
			"frappe.ui",
		),
		dom: lenient(
			{
				freeze: (msg) => (ui.frozen = msg || "Working…"),
				unfreeze: () => (ui.frozen = ""),
				set_style: () => {},
				eval: () => {},
			},
			"frappe.dom",
		),
		perm: lenient(
			{
				has_perm: (doctype, level, ptype = "read") => {
					if (current?.form?.doctype === doctype && current.form.perms)
						return !!current.form.perms[ptype];
					return !!(permCache.get(doctype) || {})[ptype];
				},
				get_perm: (doctype) => [permCache.get(doctype) || {}],
			},
			"frappe.perm",
		),
		realtime: {
			on: () => {},
			off: () => {},
			emit: () => {},
			doc_subscribe: () => {},
			doc_unsubscribe: () => {},
		},
		tour: {},
		listview_settings: {},
		treeview_settings: {},
		views: lenient({ calendar: {}, ListView: class {}, KanbanView: class {} }, "frappe.views"),
		query_reports: {},
		// Loads the app's built desk bundles (e.g. performance.bundle.js) the way the desk does;
		// stylesheets are skipped, briskrew styles the result itself.
		require: (assets, cb) => {
			const p = Promise.all(
				[]
					.concat(assets)
					.filter((a) => !/\.css$/.test(a))
					.map(loadDeskAsset),
			)
				.then(() => cb && cb())
				.catch((e) =>
					record(`frappe.require(${[].concat(assets).join(", ")}): ${e.message}`),
				);
			return p;
		},
		get_route: () => ["Form", current?.form?.doctype, current?.form?.doc?.name],
		get_prev_route: prevRoute,
		get_route_str: () => `Form/${current?.form?.doctype}/${current?.form?.doc?.name}`,
		flags: {},
		help: { help_links: {}, youtube_id: {} },
		search: { utils: {} },
		ready: (fn) => fn && fn(),
		after_ajax: (fn) => fn && setTimeout(fn, 0),
		is_mobile: () => window.innerWidth < 768,
		is_large_screen: () => window.innerWidth > 1200,
		get_abbr: (s) =>
			String(s || "")
				.split(" ")
				.map((w) => w[0])
				.join("")
				.slice(0, 2)
				.toUpperCase(),
		ellipsis: (s, n) => (String(s || "").length > n ? `${String(s).slice(0, n)}…` : s),
		timeout: (s) => new Promise((r) => setTimeout(r, s * 1000)),
		sys_defaults: b.sysdefaults || {},
	};
	return lenient(frappe, "frappe");
}

function buildErpnext() {
	const erpnext = {
		// Same as ERPNext: show the naming series only while the record is new.
		toggle_naming_series: () => {
			const frm = current?.frm;
			if (frm && frm.meta.fields.some((d) => d.fieldname === "naming_series"))
				frm.toggle_display("naming_series", !!frm.doc.__islocal);
		},
		get_currency: (company) =>
			booted?.companies?.[company]?.currency || booted?.sysdefaults?.currency,
		queries: lenient(
			{
				employee: () => ({ query: "erpnext.controllers.queries.employee_query" }),
				company: () => ({ query: "erpnext.controllers.queries.company_query" }),
			},
			"erpnext.queries",
		),
		accounts: lenient(
			{
				dimensions: {
					// Accounting dimension fields (cost center, project, custom ones) filtered by company.
					setup_dimension_filters: async (frm, doctype) => {
						try {
							const r = await rawCall(
								"erpnext.accounts.doctype.accounting_dimension.accounting_dimension.get_dimensions",
							);
							const dims = (r.message?.[0] || [])
								.map((d) => d.fieldname)
								.concat(["cost_center", "project"]);
							for (const dim of dims) {
								if (!frm.meta.fields.some((d) => d.fieldname === dim)) continue;
								frm.set_query(dim, () => ({
									filters: frm.doc.company ? { company: frm.doc.company } : {},
								}));
							}
						} catch {
							/* ERPNext without accounting dimensions */
						}
					},
					update_dimension: () => {},
				},
			},
			"erpnext.accounts",
		),
		utils: lenient(
			{
				get_fiscal_year: (d) => booted?.defaults?.fiscal_year,
				add_dimensions: () => {},
				// Tree screens offer the companies and default to the user's own.
				get_tree_options: (key) =>
					key === "company" ? Object.keys(booted?.companies || {}) : [],
				get_tree_default: (key) => booted?.defaults?.[key] || "",
			},
			"erpnext.utils",
		),
		setup: lenient({ utils: {} }, "erpnext.setup"),
		hr: {},
	};
	return lenient(erpnext, "erpnext");
}

// ---------------------------------------------------------------------------------------
// frm: the per-form object scripts receive
// ---------------------------------------------------------------------------------------

function fieldHandle(form, fieldname, table = "") {
	const el = document.createElement("div");
	const handle = {
		get df() {
			const df = form.df(fieldname, table);
			return df
				? new Proxy(df, {
						set(t, prop, value) {
							form.overrides[`${table}|${fieldname}`] = {
								...(form.overrides[`${table}|${fieldname}`] || {}),
								[prop]: value,
							};
							return true;
						},
				  })
				: null;
		},
		get value() {
			return form.doc?.[fieldname];
		},
		get_value: () => form.doc?.[fieldname],
		set_value: (v) => form.setValue(fieldname, v),
		refresh: () => {},
		refresh_input: () => {},
		set_focus: () => document.getElementById(`f-${fieldname}`)?.focus(),
		toggle_label: () => {},
		// Autocomplete fields: frm.fields_dict.x.set_data(["a", "b"])
		set_data: (data) =>
			(form.overrides[`${table}|${fieldname}`] = {
				...(form.overrides[`${table}|${fieldname}`] || {}),
				options: []
					.concat(data || [])
					.map((d) => (typeof d === "object" ? d.value : d))
					.join("\n"),
			}),
		set_description: (d) =>
			(form.overrides[`${table}|${fieldname}`] = {
				...(form.overrides[`${table}|${fieldname}`] || {}),
				description: d,
			}),
		set_input: (v) => form.setValue(fieldname, v),
		// HTML fields: frm.get_field("help").html("<p>…</p>")
		html: (content) => htmlWrapper(form, fieldname, el).html(content),
		// Table fields: frm.fields_dict.items.get_field("Batch No") is the column's fieldname
		// (matched by fieldname or label), if the rows have one.
		get_field: (field) => {
			const want = String(field || "").toLowerCase();
			const dt = form.tableDoctype(fieldname);
			const hit = (dt ? form.fieldsOf(dt) : []).find(
				(d) =>
					!NO_VALUE.has(d.fieldtype) &&
					(d.fieldname.toLowerCase() === want ||
						String(d.label || "").toLowerCase() === want ||
						String(__(d.label || "")).toLowerCase() === want),
			);
			return hit?.fieldname;
		},
		// Geolocation fields: the desk's map; briskrew shows coordinates, so this keeps the view
		// a script sets and reports the drawn point (or the default centre) as the centre.
		get map() {
			return (mapShims[`${table}|${fieldname}`] ||= geoMap(form, fieldname));
		},
		get $wrapper() {
			// HTML fields: whatever a script writes here is shown in the field.
			return htmlWrapper(form, fieldname, el);
		},
		$input: jQuery("<input>"),
		// A script holding the raw element (e.g. $(frm.fields_dict.x.wrapper)) changes it directly,
		// so an HTML field shows that element itself rather than a copy of its markup.
		get wrapper() {
			const key = `${table}|${fieldname}`;
			// Sections and tabs are jQuery objects in the desk (scripts .find() inside them).
			if (BREAKS.has(form.df(fieldname, table)?.fieldtype)) return jQuery(el);
			// Keep it in the document from the start: scripts bind handlers with page-wide
			// selectors right after rendering, before the field moves it into place.
			if (!el.isConnected) detachedHolder().appendChild(el);
			if (
				form.df(fieldname, table)?.fieldtype === "HTML" &&
				form.overrides[key]?.__el !== el
			)
				form.overrides[key] = { ...(form.overrides[key] || {}), __el: markRaw(el) };
			return el;
		},
		set get_query(fn) {
			form.queries[`${table}|${fieldname}`] = fn;
		},
		get get_query() {
			return form.queries[`${table}|${fieldname}`];
		},
		grid: gridHandle(form, fieldname),
		// The field's layout row: scripts show or hide the whole field with it.
		get row() {
			const $w = jQuery(el);
			$w.toggle = (show) => {
				const key = `${table}|${fieldname}`;
				form.overrides[key] = {
					...(form.overrides[key] || {}),
					hidden: show === false ? 1 : 0,
				};
				return $w;
			};
			return { wrapper: $w };
		},
		frm: current?.frm,
	};
	return handle;
}

const BREAKS = new Set(["Section Break", "Tab Break", "Column Break"]);
const NO_VALUE = new Set([
	"Section Break",
	"Column Break",
	"Tab Break",
	"HTML",
	"Table",
	"Table MultiSelect",
	"Button",
	"Image",
	"Fold",
	"Heading",
]);
const mapShims = {};

function geoMap(form, fieldname) {
	let view = null;
	const point = () => {
		try {
			const v = form.doc?.[fieldname];
			const geo = typeof v === "string" ? JSON.parse(v) : v;
			const c = geo?.features?.[0]?.geometry?.coordinates;
			if (Array.isArray(c) && typeof c[0] === "number") return { lat: c[1], lng: c[0] };
		} catch {
			// not GeoJSON
		}
		return null;
	};
	const noop = function () {
		return map;
	};
	const map = {
		setView: (center, zoom) => {
			view = {
				lat: Number(center[0] ?? center.lat),
				lng: Number(center[1] ?? center.lng),
				zoom,
			};
			return map;
		},
		getCenter: () => {
			if (view) return { lat: view.lat, lng: view.lng };
			const p = point();
			if (p) return p;
			const center = window.frappe?.utils?.map_defaults?.center;
			const [lat, lng] = Array.isArray(center) ? center : [19.08, 72.8961];
			return { lat, lng };
		},
		getZoom: () => view?.zoom ?? 13,
		fitBounds: noop,
		flyTo: noop,
		panTo: noop,
		invalidateSize: noop,
		on: noop,
		off: noop,
		addLayer: noop,
		removeLayer: noop,
	};
	return map;
}

function detachedHolder() {
	let holder = document.getElementById("briskrew-detached");
	if (!holder) {
		holder = document.createElement("div");
		holder.id = "briskrew-detached";
		holder.hidden = true;
		document.body.appendChild(holder);
	}
	return holder;
}

function htmlWrapper(form, fieldname, el) {
	const $el = jQuery(el);
	const sync = () =>
		(form.overrides[`|${fieldname}`] = {
			...(form.overrides[`|${fieldname}`] || {}),
			__html: el.innerHTML,
		});
	for (const m of ["html", "append", "prepend", "empty", "text"]) {
		const orig = $el[m].bind($el);
		$el[m] = (...a) => {
			const r = orig(...a);
			if (a.length || m === "empty") sync();
			return r;
		};
	}
	return $el;
}

function gridHandle(form, tableField) {
	const set = (field, prop, value) => {
		form.overrides[`${tableField}|${field}`] = {
			...(form.overrides[`${tableField}|${field}`] || {}),
			[prop]: value,
		};
	};
	const setTable = (prop, value) => {
		form.overrides[`|${tableField}`] = {
			...(form.overrides[`|${tableField}`] || {}),
			[prop]: value,
		};
	};
	return lenient(
		{
			// Always a holder, as in the desk (scripts set get_query on columns that may not exist).
			get_field: (field) => ({
				get df() {
					return form.df(field, tableField);
				},
				set get_query(fn) {
					form.queries[`${tableField}|${field}`] = fn;
				},
				get get_query() {
					return form.queries[`${tableField}|${field}`];
				},
			}),
			// The row type's fields, with what scripts changed applied.
			get docfields() {
				const dt = form.tableDoctype(tableField);
				return dt ? form.fieldsOf(dt).map((d) => form.df(d.fieldname, tableField)) : [];
			},
			// "Add multiple": pick several of what the link field points to, one row each.
			set_multiple_add: (link, qty) => setTable("multiple_add", { link, qty: qty || null }),
			update_docfield_property: set,
			toggle_display: (field, show) => set(field, "hidden", show ? 0 : 1),
			toggle_reqd: (field, reqd) => set(field, "reqd", reqd ? 1 : 0),
			toggle_enable: (field, enable) => set(field, "read_only", enable ? 0 : 1),
			set_column_disp: (fields, show) =>
				[].concat(fields).forEach((f) => set(f, "hidden", show ? 0 : 1)),
			set cannot_add_rows(v) {
				setTable("cannot_add_rows", v ? 1 : 0);
			},
			set cannot_delete_rows(v) {
				setTable("cannot_delete_rows", v ? 1 : 0);
			},
			add_new_row: () => form.addRowSync(tableField),
			get_selected: () => [],
			get_selected_children: () => [],
			refresh: () => {},
			reset_grid: () => {},
			wrapper: jQuery("<div>"),
			get data() {
				return form.doc?.[tableField] || [];
			},
			get grid_rows() {
				return (form.doc?.[tableField] || []).map((doc) => ({
					doc,
					toggle_view: () => {},
					refresh_field: () => {},
				}));
			},
			get df() {
				return form.df(tableField);
			},
		},
		`frm.fields_dict.${tableField}.grid`,
	);
}

function makeFrm(form) {
	const setProp = (field, prop, value, table = "") => {
		const key = `${table}|${field}`;
		form.overrides[key] = { ...(form.overrides[key] || {}), [prop]: value };
	};
	const fieldsDict = new Proxy(
		{},
		{
			get(t, name) {
				if (typeof name === "symbol") return undefined;
				if (!form.df(name)) return undefined;
				return (t[name] ||= fieldHandle(form, name));
			},
			has: (t, name) => !!form.df(name),
		},
	);
	const addButton = (label, fn, group = "", primary = false) => {
		const exists = form.buttons.find(
			(b) => b.label === label && (b.group || "") === (group || ""),
		);
		if (exists) exists.action = fn;
		else form.buttons.push({ label, action: fn, group: group || "", primary });
		const $b = jQuery("<button>");
		$b.addClass = () => $b;
		return $b;
	};

	const frm = {
		get doc() {
			return form.doc;
		},
		get doctype() {
			return form.doctype;
		},
		get docname() {
			return form.doc?.name;
		},
		get meta() {
			return form.meta;
		},
		get perm() {
			return [form.perms || { read: 1, write: 1 }];
		},
		fields_dict: fieldsDict,
		get fields() {
			return form.meta.fields.map((df) => fieldsDict[df.fieldname]).filter(Boolean);
		},
		events: {},
		cscript: {},
		custom_make_buttons: {},
		make_methods: {},
		ignore_doctypes_on_cancel_all: [],
		selected_doc: null,
		is_new: () => form.isNew,
		is_dirty: () => form.dirty,
		dirty: () => {
			form.dirty = true;
		},
		has_perm: (ptype) => !!(form.perms || {})[ptype],
		get_field: (f) => fieldsDict[f],
		get_docfield: (table, field) => (field ? form.df(field, table) : form.df(table)),
		set_value(field, value, ifMissing) {
			if (typeof field === "object")
				return Promise.all(Object.entries(field).map(([k, v]) => frm.set_value(k, v)));
			if (ifMissing && form.doc[field]) return Promise.resolve();
			const df = form.df(field);
			if (
				df &&
				(df.fieldtype === "Table" || df.fieldtype === "Table MultiSelect") &&
				Array.isArray(value)
			) {
				form.doc[field] = [];
				for (const v of value) form.addRowSync(field, { ...v });
				return form.trigger("change", field);
			}
			return form.setValue(field, value);
		},
		set_query(field, table, fn) {
			if (typeof table === "function" || (typeof table === "object" && table !== null)) {
				form.queries[`|${field}`] = table;
			} else {
				form.queries[`${table || ""}|${field}`] = fn;
			}
		},
		add_fetch: (link, source, target, table) =>
			form.extraFetches.push({ link, source, target, table: table || "" }),
		set_df_property: (field, prop, value, docname, table) =>
			setProp(field, prop, value, table || ""),
		toggle_display: (fields, show) =>
			[].concat(fields).forEach((f) => setProp(f, "hidden", show ? 0 : 1)),
		toggle_reqd: (fields, reqd) =>
			[].concat(fields).forEach((f) => setProp(f, "reqd", reqd ? 1 : 0)),
		toggle_enable: (fields, enable) =>
			[].concat(fields).forEach((f) => setProp(f, "read_only", enable ? 0 : 1)),
		set_currency_labels(fields, currency, parentfield) {
			for (const f of [].concat(fields)) {
				const df = form.df(f, parentfield || "");
				if (!df) continue;
				const label = String(df.__baseLabel || df.label).replace(/ \([A-Z]{3}\)$/, "");
				setProp(
					f,
					"label",
					currency ? `${label} (${currency})` : label,
					parentfield || "",
				);
				setProp(f, "__baseLabel", label, parentfield || "");
			}
		},
		refresh_field: () => {},
		refresh_fields: () => {},
		refresh: () => runRefresh(form),
		reload_doc: () => form.reloadDoc().then(() => runRefresh(form)),
		async save(action, callback) {
			const map = {
				Submit: form.submit,
				Cancel: form.cancel,
				Update: form.save,
				Save: form.save,
			};
			const ok = await (map[action] || form.save)();
			if (ok && callback) callback();
			return ok;
		},
		savesubmit: () => form.submit(),
		savecancel: () => form.cancel(),
		amend_doc: () =>
			current?.router?.push({
				name: "Form",
				params: { doctype: form.doctype, name: "new" },
				query: { from: "amend" },
			}),
		copy_doc: () => record("frm.copy_doc"),
		print_doc: () => window.open(form.printUrl(), "_blank"),
		email_doc: () => record("frm.email_doc (use the classic desk to email)"),
		// An old-style icon class in place of a group ("fa fa-money") is ignored, as in the desk.
		add_custom_button: (label, fn, group) =>
			addButton(label, fn, group && String(group).includes("fa fa-") ? "" : group),
		remove_custom_button: (label, group) =>
			(form.buttons = form.buttons.filter(
				(b) => !(b.label === label && (b.group || "") === (group || "")),
			)),
		clear_custom_buttons: () => (form.buttons = []),
		change_custom_button_type: (label, group, type) => {
			const b = form.buttons.find(
				(x) => x.label === label && (x.group || "") === (group || ""),
			);
			if (b) b.primary = type === "primary";
		},
		set_intro: (text, color) =>
			(form.intro = text
				? { text, color: color === true ? "blue" : color || "blue" }
				: null),
		scroll_to_field: (f) => {
			const el = document.getElementById(`f-${f}`);
			el?.scrollIntoView({ behavior: "smooth", block: "center" });
			el?.focus();
		},
		add_child: (field, values = {}) => form.addRowSync(field, values),
		clear_table: (field) => {
			form.doc[field] = [];
			form.dirty = true;
		},
		trigger: (event, cdt, cdn) =>
			dispatch(form, cdt && cdt !== form.doctype ? cdt : form.doctype, event, cdt, cdn),
		call(opts, args, callback) {
			if (typeof opts === "string") opts = { method: opts, args, callback };
			const isDocMethod = !opts.method.includes(".");
			return frappeCall({ ...opts, doc: isDocMethod ? form.doc : undefined }).then((r) => {
				if (isDocMethod && r.docs) runRefresh(form);
				return r;
			});
		},
		validate_form_action: () => true,
		set_indicator_formatter: () => {},
		get_selected: () => ({}),
		// Scripts hide the standard Save/Submit when the document runs its own flow (e.g. Payroll Entry).
		enable_save: () => (form.saveDisabled = false),
		disable_save: () => (form.saveDisabled = true),
		disable_form: () => {},
		toggle_comments: () => {},
		add_web_link: () => {},
		set_read_only: () => {},
		script_manager: lenient(
			{
				trigger: (event, cdt, cdn) => dispatch(form, cdt || form.doctype, event, cdt, cdn),
				// cur_frm.script_manager.make(erpnext.stock.LandedCostVoucher)
				make: (Klass) => window.extend_cscript(frm.cscript, new Klass({ frm })),
				has_handler: (event) =>
					(current?.handlers[form.doctype] || []).some(
						(h) => typeof h[event] === "function",
					),
				has_handlers: (event, doctype) =>
					(current?.handlers[doctype || form.doctype] || []).some(
						(h) => typeof h[event] === "function",
					) || typeof frm.cscript[event] === "function",
				// A new row takes these values from the first row (the desk's own helper).
				copy_from_first_row: (parentfield, row, fieldnames) => {
					const rows = form.doc[parentfield] || [];
					if (rows.length === 1 || rows[0] === row || rows[0]?.name === row?.name)
						return;
					for (const f of [].concat(fieldnames))
						modelSetValue(row.doctype, row.name, f, rows[0][f]);
				},
				setup: () => {},
				log_error: (caller, e) => console.error(`[briskrew] ${caller}:`, e),
			},
			"frm.script_manager",
		),
		page: lenient(
			{
				set_indicator: (label, color) => (form.indicator = { label, color }),
				clear_indicator: () => (form.indicator = null),
				set_primary_action: (label, fn) => addButton(label, fn, "", true),
				set_secondary_action: (label, fn) => addButton(label, fn),
				add_menu_item: (label, fn) => addButton(label, fn, "More actions"),
				add_action_item: (label, fn) => addButton(label, fn, "Actions"),
				add_inner_button: (label, fn, group) => addButton(label, fn, group),
				remove_inner_button: (label, group) =>
					(form.buttons = form.buttons.filter(
						(b) => !(b.label === label && (b.group || "") === (group || "")),
					)),
				set_inner_btn_group_as_primary: (group) =>
					form.buttons.forEach((b) => b.group === group && (b.primary = true)),
				clear_primary_action: () => (form.saveDisabled = true),
				clear_secondary_action: () => {},
				clear_menu: () => {},
				clear_actions_menu: () => {},
				set_title: () => {},
				btn_primary: jQuery("<button>"),
				btn_secondary: jQuery("<button>"),
				wrapper: jQuery("<div>"),
				main: jQuery("<div>"),
			},
			"frm.page",
		),
		dashboard: lenient(
			{
				set_headline: (html, color) => (form.headline = html),
				set_headline_alert: (html) => (form.headline = html),
				clear_headline: () => (form.headline = null),
				add_indicator: (label, color) =>
					form.dashboard.push({ label: String(label).replace(/<[^>]+>/g, ""), color }),
				clear_comment: () => {},
				add_comment: (text, color) => (form.intro = { text, color: color || "blue" }),
				show: () => {},
				hide: () => {},
				refresh: () => {},
				reset: () => (form.dashboard = []),
				add_section: (html, title) => {
					const others = form.sections.filter((x) => x.title !== (title || ""));
					form.sections = [...others, { title: title || "", html }];
					return jQuery("<div>");
				},
				add_progress: (title, percent) =>
					form.dashboard.push({
						label: `${title}: ${Math.round(percent)}%`,
						color: "blue",
					}),
				// frm.dashboard.render_graph({ title, data: { labels, datasets }, type })
				render_graph: (args) =>
					(form.chart = args?.data?.labels?.length
						? markRaw({
								title: args.title || "",
								data: args.data,
								type: args.type || "line",
						  })
						: null),
				set_badge_count: () => {},
				stats_area: jQuery("<div>"),
				wrapper: jQuery("<div>"),
			},
			"frm.dashboard",
		),
		timeline: silent(),
		sidebar: silent(),
		layout: silent(),
		wrapper: document.createElement("div"),
		$wrapper: jQuery("<div>"),
		toolbar: silent(),
		states: silent(),
		attachments: silent(),
	};
	return lenient(frm, "frm");
}

// ---------------------------------------------------------------------------------------
// Event dispatch, desk order
// ---------------------------------------------------------------------------------------

async function dispatch(form, doctype, event, cdt, cdn, { legacy = true } = {}) {
	const list = current?.handlers[doctype] || [];
	const frm = current.frm;
	for (const handlers of list) {
		const fn = handlers[event];
		if (typeof fn !== "function") continue;
		try {
			await fn.call(handlers, frm, cdt || doctype, cdn || form.doc?.name);
		} catch (e) {
			if (e.fromThrow) return false;
			form.error = `${event}: ${e.message}`;
			if (import.meta.env.DEV || window.__briskrewDebug) console.error(e);
		}
	}
	// Legacy style: cur_frm.cscript.<event>(doc, cdt, cdn) and controller classes.
	// As in the desk they run for row events too (a controller's item_code(doc, cdt, cdn)).
	const cs = legacy ? frm.cscript : null;
	for (const name of [event, `custom_${event}`]) {
		if (!cs || typeof cs[name] !== "function") continue;
		try {
			await cs[name].call(cs, form.doc, cdt || doctype, cdn || form.doc?.name);
		} catch (e) {
			if (e.fromThrow) return false;
			form.error = `${event}: ${e.message}`;
			if (import.meta.env.DEV || window.__briskrewDebug) console.error(e);
		}
	}
	return true;
}

let refreshing = false;
async function runRefresh(form) {
	if (refreshing) return;
	refreshing = true;
	try {
		form.buttons = [];
		form.intro = null;
		form.headline = null;
		form.dashboard = [];
		form.sections = [];
		form.indicator = null;
		form.chart = null;
		form.saveDisabled = false;
		await dispatch(form, form.doctype, "refresh");
		await dispatch(form, form.doctype, "onload_post_render");
	} finally {
		refreshing = false;
	}
}

// ---------------------------------------------------------------------------------------
// Runtime install (once) and per-form attach
// ---------------------------------------------------------------------------------------

let assetMap = null;
const loadedAssets = {};
function loadDeskAsset(name) {
	if (loadedAssets[name]) return loadedAssets[name];
	loadedAssets[name] = (async () => {
		let src = name;
		if (!name.startsWith("/") && !/^https?:/.test(name)) {
			assetMap ||= await fetch("/assets/assets.json").then((r) => (r.ok ? r.json() : {}));
			src = assetMap[name];
			if (!src) throw new Error(`${name} isn't built on this site`);
		}
		await new Promise((resolve, reject) => {
			const css = src.endsWith(".css");
			const el = document.createElement(css ? "link" : "script");
			if (css) {
				el.rel = "stylesheet";
				el.href = src;
			} else el.src = src;
			el.onload = resolve;
			el.onerror = () => reject(new Error(`couldn't load ${name}`));
			document.head.appendChild(el);
		});
	})();
	return loadedAssets[name];
}
// Built desk bundles (scripts or stylesheets) for screens that reuse them, such as maps.
export { loadDeskAsset };

// Runs once; screens opened while it's loading wait for the same promise.
let installing = null;
function install() {
	installing ||= doInstall();
	return installing;
}

async function doInstall() {
	const { call } = await import("frappe-ui");
	booted = await call("hrms.briskrew.api.boot").catch(() => ({}));
	window.jQuery = window.$ = jQuery;
	// Bootstrap's jQuery plugins, which desk scripts call for looks only.
	for (const plugin of ["tooltip", "popover", "dropdown", "collapse"])
		jQuery.fn[plugin] ||= function () {
			return this;
		};
	window.moment = Object.assign((...a) => dayjs(...a), dayjs, { duration: dayjs.duration });
	window.__ = translate;
	window.flt = flt;
	window._round = _round;
	window.remainder = remainder;
	window.round_based_on_smallest_currency_fraction = round_based_on_smallest_currency_fraction;
	window.cint = cint;
	window.cstr = cstr;
	window.in_list = in_list;
	window.has_common = (a, b) => [].concat(a || []).some((x) => [].concat(b || []).includes(x));
	// precision(fieldname, doc): decimals for a field, as the desk computes them.
	window.precision = (fieldname, doc) => {
		const dt = doc?.doctype || current?.form?.doctype;
		const df =
			current?.form?.df(fieldname, doc?.parentfield || "") ||
			metaFromCache(dt)?.fields.find((d) => d.fieldname === fieldname);
		if (df?.precision) return cint(df.precision);
		const sys = booted?.sysdefaults || {};
		if (df?.fieldtype === "Currency")
			return cint(sys.currency_precision || sys.number_format?.split(".")[1]?.length || 2);
		return cint(sys.float_precision || 3);
	};
	window.format_currency = formatCurrency;
	loadBootDocs(booted?.desk?.docs);
	window.frappe = buildFrappe();
	window.erpnext = buildErpnext();
	window.__briskrewIsStandIn = (v) => standIns.has(v);
	window.locals = new Proxy(
		{},
		{
			get: (t, doctype) =>
				new Proxy(
					{},
					{
						get: (x, name) =>
							typeof name === "symbol" ? undefined : findLocal(doctype, name),
						// Iterating locals[":Company"] lists the boot's documents of that type.
						ownKeys: () => Object.keys(bootDocs[doctype] || {}),
						getOwnPropertyDescriptor: (x, name) =>
							bootDocs[doctype]?.[name]
								? {
										value: bootDocs[doctype][name],
										enumerable: true,
										configurable: true,
								  }
								: undefined,
					},
				),
		},
	);
	window.extend_cscript = (cscript, controller) => {
		Object.assign(cscript, controller);
		// As in the desk: the controller's class methods (inherited ones too) become handlers.
		if (cscript && controller)
			Object.setPrototypeOf(cscript, Object.getPrototypeOf(controller));
		return cscript;
	};
	window.set_field_options = (field, options) =>
		current?.frm.set_df_property(field, "options", options);
	window.refresh_field = () => {};
	window.hide_field = (fields) => current?.frm.toggle_display(fields, false);
	window.unhide_field = (fields) => current?.frm.toggle_display(fields, true);

	for (const [path, html] of Object.entries(templates)) {
		const name = path.split("/").pop().replace(".html", "");
		window.frappe.templates[name] = html;
	}
	// ERPNext's own desk code (transaction and stock controllers, serial/batch selector,
	// queries...), the same bundle the desk loads, so its forms run their real logic.
	if ((booted?.installed_apps || []).includes("erpnext")) {
		try {
			await loadDeskAsset("erpnext.bundle.js");
		} catch (e) {
			console.warn("[briskrew compat] couldn't load ERPNext's desk bundle:", e);
		}
	}
	jQuery(document).trigger("app_ready");

	// Frappe HR's shared desk helpers (hrms.*), loaded from their original source.
	for (const [label, src] of [
		["hrms utils", hrmsUtils],
		["hrms leave utils", hrmsLeaveUtils],
		["hrms payroll utils", hrmsPayrollUtils],
	]) {
		try {
			// eslint-disable-next-line no-new-func
			new Function(src)();
		} catch (e) {
			console.warn(`[briskrew compat] couldn't load ${label}:`, e);
		}
	}
}

function runScript(code, label) {
	if (!code || !code.trim()) return;
	try {
		// eslint-disable-next-line no-new-func
		new Function(`${code}\n//# sourceURL=briskrew/${label}.js`)();
	} catch (e) {
		record(`${label}: ${e.message}`);
	}
}

export async function attachFormScript(form, router) {
	await install();
	const handlers = {};
	for (const [dt, hs] of Object.entries(globalHandlers)) handlers[dt] = [...hs];
	current = { form, router, handlers, frm: null };
	current.frm = makeFrm(form);
	window.cur_frm = current.frm;

	// Child table metas for grid scripts.
	for (const tf of form.meta.fields.filter(
		(d) => d.fieldtype === "Table" || d.fieldtype === "Table MultiSelect",
	))
		await getMeta(tf.options).catch(() => {});

	Object.assign(window.frappe.templates, form.meta.__templates || {});
	runScript(form.meta.__js, `${form.doctype}`);
	runScript(form.meta.__custom_js, `${form.doctype} (client script)`);

	// frm.events: the parent doctype's handlers merged, as scripts call frm.events.x(frm).
	for (const h of handlers[form.doctype] || []) Object.assign(current.frm.events, h);

	// Engine events -> desk events.
	form.on("change", (fieldname, row) =>
		row
			? dispatch(form, row.doctype, fieldname, row.doctype, row.name)
			: dispatch(form, form.doctype, fieldname),
	);
	form.on("row_add", (table, row) =>
		Promise.all([
			dispatch(form, row.doctype, `${table}_add`, row.doctype, row.name),
			// The controller's own items_add runs once, as in the desk.
			dispatch(form, form.doctype, `${table}_add`, row.doctype, row.name, { legacy: false }),
		]),
	);
	form.on("row_remove", (table, row) =>
		dispatch(form, form.doctype, `${table}_remove`, row.doctype, row.name),
	);
	form.on("button", (fieldname, row) =>
		row
			? dispatch(form, row.doctype, fieldname, row.doctype, row.name)
			: dispatch(form, form.doctype, fieldname),
	);
	for (const ev of ["validate", "before_save", "before_submit", "before_cancel"]) {
		form.on(ev, async () => {
			window.frappe.validated = true;
			const ok = await dispatch(form, form.doctype, ev);
			return ok !== false && window.frappe.validated !== false;
		});
	}
	for (const ev of ["after_save", "on_submit", "after_cancel"])
		form.on(ev, () => dispatch(form, form.doctype, ev));
	form.on("refresh", () => runRefresh(form));

	addBriskrewRules(form);

	await dispatch(form, form.doctype, "setup");
	await dispatch(form, form.doctype, "onload");
	await runRefresh(form);
}

// briskrew's own rules on top of the desk scripts.
const APPROVER_FIELD = {
	"Leave Application": "leave_approver",
	"Expense Claim": "expense_approver",
	"Shift Request": "approver",
};
function addBriskrewRules(form) {
	if (form.doctype === "Payroll Entry") {
		// Runs through the same refresh as the desk script, so it survives button resets.
		(current.handlers["Payroll Entry"] ||= []).push({
			refresh(frm) {
				if (!frm.is_new() && frm.doc.salary_slips_created)
					frm.add_custom_button("Review vs previous", () =>
						current.router.push({
							name: "PayrollReview",
							params: { name: frm.doc.name },
						}),
					);
			},
		});
	}
	const field = APPROVER_FIELD[form.doctype];
	if (!field) return;
	// Default approver = the employee's approver, else their team lead / manager.
	form.on("change", async (fieldname, row) => {
		if (row || fieldname !== "employee" || !form.doc.employee || form.doc[field]) return;
		try {
			const approver = await window.frappe.xcall(
				"hrms.briskrew.approvers.get_request_approver",
				{
					doctype: form.doctype,
					employee: form.doc.employee,
				},
			);
			if (approver && !form.doc[field]) await form.setValue(field, approver);
		} catch {
			/* the server fills it on save */
		}
	});
}

export function detachFormScript(form) {
	if (current?.form === form) {
		current = null;
		window.cur_frm = null;
	}
}

// ---------------------------------------------------------------------------------------
// List screens: run the doctype's list script (meta.__list_js, frappe.listview_settings)
// ---------------------------------------------------------------------------------------

export async function loadPerms(doctype) {
	if (!permCache.has(doctype)) {
		const { call } = await import("frappe-ui");
		permCache.set(
			doctype,
			await call("hrms.briskrew.api.doctype_perms", { doctype }).catch(() => ({})),
		);
	}
	return permCache.get(doctype);
}

// `list` is the reactive state of DocList.vue; this fills in its script-driven parts.
export async function attachListScript(list, router) {
	await install();
	currentList = { list, router };
	delete window.frappe.listview_settings[list.doctype];
	runListScript(list.meta.__list_js, `${list.doctype} list`);
	runListScript(list.meta.__custom_list_js, `${list.doctype} list (client script)`);
	const settings = window.frappe.listview_settings[list.doctype] || {};
	list.settings = settings;
	list.addFields = [].concat(settings.add_fields || []);

	const addButton = (label, action, group = "") => {
		const existing = list.buttons.find((b) => b.label === label && b.group === group);
		if (existing) existing.action = action;
		else list.buttons.push({ label, action, group });
		return jQuery("<button>");
	};
	list.listview = lenient(
		{
			doctype: list.doctype,
			get meta() {
				return list.meta;
			},
			get data() {
				return list.rows;
			},
			get_checked_items: (onlyNames) => {
				const rows = list.rows.filter((r) => list.selected.includes(r.name));
				return onlyNames ? rows.map((r) => r.name) : rows;
			},
			clear_checked_items: () => (list.selected = []),
			call_for_selected_items: (method, args = {}) =>
				window.frappe
					.call({ method, args: { ...args, names: list.selected }, freeze: true })
					.then(() => list.reload()),
			refresh: () => list.reload(),
			filter_area: lenient(
				{
					add: (filters) => list.addFilters(filters),
					clear: () => list.clearFilters(),
					get: () => list.filterTuples(),
				},
				"listview.filter_area",
			),
			get filters() {
				return list.filterTuples();
			},
			page: lenient(
				{
					add_inner_button: (label, fn, group) => addButton(label, fn, group || ""),
					add_action_item: (label, fn) => addButton(label, fn, "Actions"),
					add_menu_item: (label, fn) => addButton(label, fn, "Menu"),
					// A named dropdown; items join it through add_custom_menu_item.
					add_custom_button_group: (label) =>
						Object.assign(jQuery("<div>"), { briskrewGroup: label }),
					add_custom_menu_item: (group, label, fn) =>
						addButton(label, fn, group?.briskrewGroup || "Menu"),
					set_primary_action: (label, fn) =>
						(list.primaryAction = { label, action: fn }),
					clear_primary_action: () => (list.primaryAction = null),
					remove_inner_button: (label, group) =>
						(list.buttons = list.buttons.filter(
							(b) => !(b.label === label && b.group === (group || "")),
						)),
					clear_inner_toolbar: () => (list.buttons = []),
					set_title: () => {},
					wrapper: jQuery("<div>"),
				},
				"listview.page",
			),
			$result: jQuery("<div>"),
			wrapper: jQuery("<div>"),
		},
		"listview",
	);

	if (settings.primary_action)
		list.primaryAction = {
			label: `New ${list.doctype}`,
			action: () => settings.primary_action(),
		};
	try {
		if (settings.onload) await settings.onload(list.listview);
	} catch (e) {
		record(`${list.doctype} list onload: ${e.message}`);
	}
}

function runListScript(code, label) {
	if (!code || !code.trim()) return;
	try {
		// eslint-disable-next-line no-new-func
		new Function(`${code}\n//# sourceURL=briskrew/${label}.js`)();
	} catch (e) {
		record(`${label}: ${e.message}`);
	}
}

// A row's status from the list script's get_indicator: [label, color, filter].
export function listIndicator(list, doc) {
	const s = list.settings || {};
	if (typeof s.get_indicator === "function") {
		try {
			const r = s.get_indicator(doc);
			if (r) return { label: r[0], color: r[1] };
		} catch {
			/* fall back to the status field */
		}
	}
	return null;
}

export function detachListScript(list) {
	if (currentList?.list === list) currentList = null;
}

// ---------------------------------------------------------------------------------------
// Reports: run a query/script report's JS (frappe.query_reports[name]) for its filters,
// defaults, formatter and onload, against the report screen's reactive state.
// ---------------------------------------------------------------------------------------

export async function attachReportScript(report) {
	await install();
	const { call } = await import("frappe-ui");
	const res = await call("frappe.desk.query_report.get_script", { report_name: report.name });
	report.htmlFormat = res?.html_format || "";
	delete window.frappe.query_reports[report.name];

	const filterHandle = (fieldname) => {
		const raw = report.filters.find((f) => f.fieldname === fieldname);
		if (!raw) return null;
		// Writes to df (options, hidden, reqd...) must reach the rendered filter.
		const df = report.dlg ? report.dlg.fieldHandle(raw).df : raw;
		return {
			df,
			get value() {
				return report.values[fieldname];
			},
			get_value: () => report.values[fieldname],
			set_value: (v) => report.setValue(fieldname, v),
			set_input: (v) => report.setValue(fieldname, v),
			refresh: () => {},
			toggle: (show) => (df.hidden = show ? 0 : 1),
			toggle_display: (show) => (df.hidden = show ? 0 : 1),
			$wrapper: jQuery("<div>"),
		};
	};
	window.frappe.query_report = lenient(
		{
			report_name: report.name,
			get filters() {
				return report.filters.map((f) => filterHandle(f.fieldname));
			},
			get_filter: filterHandle,
			get_filter_value: (f) => report.values[f],
			get_filter_values: () => ({ ...report.values }),
			get_values: () => ({ ...report.values }),
			set_filter_value: (f, v) => {
				if (typeof f === "object")
					return Promise.all(Object.entries(f).map(([k, x]) => report.setValue(k, x)));
				return report.setValue(f, v);
			},
			refresh: () => report.run(),
			get data() {
				return report.rows;
			},
			get columns() {
				return report.columns;
			},
			page: lenient(
				{
					// Returns the button, jQuery-style: .addClass("btn-primary") makes it primary.
					add_inner_button: (label, fn, group) => {
						const b = { label, action: fn, group: group || "", primary: false };
						report.buttons.push(b);
						const $b = jQuery("<button>");
						$b.addClass = (cls) => {
							if (String(cls).includes("btn-primary"))
								report.buttons = report.buttons.map((x) =>
									x === b ? { ...x, primary: true } : x,
								);
							return $b;
						};
						return $b;
					},
					set_title: () => {},
				},
				"frappe.query_report.page",
			),
			// The desk's DataTable: scripts read the ticked rows.
			datatable: lenient(
				{
					rowmanager: { getCheckedRows: () => [...(report.checked || [])] },
					refresh: () => {},
					style: { setStyle: () => {} },
				},
				"frappe.query_report.datatable",
			),
			chart: silent(),
			toggle_nothing_to_show: () => {},
			toggle_message: () => {},
		},
		"frappe.query_report",
	);

	try {
		// eslint-disable-next-line no-new-func
		new Function(`${res?.script || ""}\n//# sourceURL=briskrew/report-${report.name}.js`)();
	} catch (e) {
		report.unsupported.push(`report script: ${e.message}`);
	}
	// A saved ("custom") report runs its reference report's script, with its own saved filters.
	const reference = res?.custom_report_name;
	report.reference = reference && reference !== report.name ? reference : null;
	const settings =
		window.frappe.query_reports[report.name] ||
		(report.reference && window.frappe.query_reports[report.reference]) ||
		{};
	report.settings = settings;
	report.filters = (settings.filters || []).map((f) => ({
		...f,
		options: Array.isArray(f.options)
			? f.options.map((o) => (typeof o === "object" ? o.value : o)).join("\n")
			: f.options,
	}));
	for (const f of report.filters) {
		let d = typeof f.default === "function" ? f.default() : f.default;
		if (d === undefined) d = f.fieldtype === "Check" ? 0 : null;
		report.values[f.fieldname] = d;
		// Report filters use on_change(query_report); the dialog form calls onchange().
		if (f.on_change && !f.onchange) f.onchange = () => f.on_change(window.frappe.query_report);
	}
	if (report.reference) {
		const saved = await call("frappe.client.get_value", {
			doctype: "Report",
			filters: { name: report.name },
			fieldname: "json",
		}).catch(() => null);
		try {
			Object.assign(report.values, JSON.parse(saved?.json || "{}").filters || {});
		} catch {
			/* no saved filters */
		}
	}
	// A dialog-style form so filters render with the same field controls as records.
	const dlg = new Dialog({ fields: report.filters });
	Object.assign(dlg.state.values, report.values);
	report.values = dlg.state.values;
	report.form = dlg.form;
	report.dlg = dlg;
	if (settings.onload) {
		try {
			await settings.onload(window.frappe.query_report);
		} catch (e) {
			report.unsupported.push(`report onload: ${e.message}`);
		}
	}
	return settings;
}

// Cell HTML, through the report's own formatter when it has one.
export function reportCell(report, value, column, row) {
	const def = (v, col, opts, data) => formatValue(v, col || {}, opts || {}, data);
	const fmt = report.settings?.formatter;
	if (typeof fmt === "function") {
		try {
			return fmt(value, null, column, row, def);
		} catch {
			/* fall through */
		}
	}
	return def(value, column, {}, row);
}

// The desk's calendar for a record type (its *_calendar.js): which fields hold the dates and
// title, and the server method that returns events. Null when the type has no calendar.
export async function calendarSettings(meta) {
	if (!meta?.__calendar_js) return null;
	await install();
	const views = window.frappe.views;
	views.calendar ||= {};
	delete views.calendar[meta.name];
	runScript(meta.__calendar_js, `${meta.name} calendar`);
	return views.calendar[meta.name] || null;
}

// The desk's tree settings for a record type (its *_tree.js): the method that returns child
// nodes, the filters above the tree, and whether to look up the root first.
export async function treeSettings(meta) {
	if (!meta?.is_tree) return null;
	await install();
	window.frappe.treeview_settings ||= {};
	delete window.frappe.treeview_settings[meta.name];
	runScript(meta.__tree_js, `${meta.name} tree`);
	return window.frappe.treeview_settings[meta.name] || {};
}
