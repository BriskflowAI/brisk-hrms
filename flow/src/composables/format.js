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
