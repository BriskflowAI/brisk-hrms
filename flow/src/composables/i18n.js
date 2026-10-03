import { reactive, ref } from "vue";

// Frappe's translations for the user's language, the same catalogue the desk uses (apps plus
// the site's own Translation records). English needs nothing loaded.
const messages = reactive({});
export const lang = ref("en");
const RTL = ["ar", "he", "fa", "ur", "ps", "ku", "dv", "yi"];

export async function loadTranslations(code) {
	lang.value = code || "en";
	const base = lang.value.split("-")[0];
	document.documentElement.lang = lang.value;
	document.documentElement.dir = RTL.includes(base) ? "rtl" : "ltr";
	if (base === "en") return;
	try {
		const res = await fetch(
			`/api/method/frappe.translate.get_boot_translations?lang=${encodeURIComponent(lang.value)}`,
		);
		Object.assign(messages, (await res.json()).message || {});
	} catch {
		/* stay in English */
	}
}

// __("Leave {0}", [name]) — the desk's translate function, with "{0}" placeholders.
export function __(text, args, context) {
	let s = String(text ?? "");
	s = (context && messages[`${s}:${context}`]) || messages[s] || s;
	if (args) for (const [i, a] of [].concat(args).entries()) s = s.replaceAll(`{${i}}`, a ?? "");
	return s;
}
