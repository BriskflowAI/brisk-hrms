// Department names carry the company abbreviation ("Design - BFD"); people don't need to see it.
export const dept = (name) => String(name || "").replace(/ - [^-]+$/, "");

// "just now", "5 min ago", "3 h ago", "2 d ago", then the date.
export function ago(when) {
	if (!when) return "";
	const d = new Date(String(when).replace(" ", "T"));
	const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
	if (s < 60) return "just now";
	if (s < 3600) return `${Math.floor(s / 60)} min ago`;
	if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
	if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
	return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Plain text from the small bits of HTML Frappe puts in subjects and messages.
export function plainText(html) {
	if (!html) return "";
	return new DOMParser().parseFromString(String(html), "text/html").body.textContent.trim();
}

// An amount in a currency ("₹1,20,000.00"), or a plain number when the currency is unknown.
export function money(n, currency, digits = 2) {
	try {
		return Number(n || 0).toLocaleString(
			undefined,
			currency
				? { style: "currency", currency, maximumFractionDigits: digits }
				: { minimumFractionDigits: digits, maximumFractionDigits: digits },
		);
	} catch {
		return Number(n || 0).toFixed(digits);
	}
}

// A quantity without trailing zeros ("12", "2.5").
export const qty = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

// "7 Oct 2026"
export const day = (d) =>
	d
		? new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString(undefined, {
				day: "numeric",
				month: "short",
				year: "numeric",
		  })
		: "";
