// Shared chart helpers. Series colours: cobalt, orange, aqua (validated together against the card
// surface #FDFDFF; aqua is under 3:1, so every chart also has a legend and a table view).
export const PALETTE = ["#2B3FE0", "#EB6834", "#1BAF7A"];

// Round axis ticks: 0 and three or four clean steps up to just above the max.
// Whole-number data (counts) gets whole-number steps.
export function niceTicks(max, count = 4, integer = false) {
	if (!max || max <= 0) return [0, 1];
	const raw = max / count;
	const mag = 10 ** Math.floor(Math.log10(raw));
	let step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
	if (integer) step = Math.max(1, Math.ceil(step));
	const ticks = [];
	for (let v = 0; v < max + step * 0.999; v += step) ticks.push(+v.toFixed(10));
	return ticks;
}

// 1,284 · 12.9K · 4.2M
export function compact(v) {
	const n = Number(v || 0);
	const abs = Math.abs(n);
	if (abs >= 1e7) return `${(n / 1e6).toFixed(0)}M`;
	if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
	if (abs >= 1e4) return `${(n / 1e3).toFixed(0)}K`;
	if (abs >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
	return Number.isInteger(n)
		? n.toLocaleString()
		: n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
