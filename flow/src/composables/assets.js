// Shared bits of the asset register and asset page.

// Colour of an asset's status chip.
export function assetStatusTone(status) {
	if (["Draft", "Work In Progress"].includes(status)) return "bg-warn-tint text-warn";
	if (["In Maintenance", "Out of Order", "Issue"].includes(status))
		return "bg-neg-tint text-neg";
	if (["Sold", "Scrapped", "Fully Depreciated", "Capitalized"].includes(status))
		return "bg-line-2 text-ink-2";
	return "bg-pos-tint text-pos";
}

// Whether a date is today or past.
export function isDue(date) {
	if (!date) return false;
	const d = new Date(String(date).slice(0, 10) + "T00:00:00");
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return d <= today;
}
