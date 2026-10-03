import frappeUIPreset from "frappe-ui/src/tailwind/preset";

// Design tokens for the "Cobalt & Lime" direction. Keep in sync with the design canvas.
export default {
	presets: [frappeUIPreset],
	content: [
		"./index.html",
		"./src/**/*.{vue,js,ts,jsx,tsx}",
		"./node_modules/frappe-ui/src/components/**/*.{vue,js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			colors: {
				paper: "#F2F4F9",
				side: "#E7EBF4",
				surf: "#FDFDFF",
				ink: { DEFAULT: "#0E1433", 2: "#394264", nav: "#1F2750", navtext: "#9AA3C7" },
				mut: "#5A6384",
				line: { DEFAULT: "#D5DBE8", 2: "#E5E9F2" },
				acc: { DEFAULT: "#2B3FE0", tint: "#E2E6FF", hover: "#1C2BA8" },
				lime: "#C9F24B",
				pos: { DEFAULT: "#16794A", tint: "#DAF3E5" },
				neg: { DEFAULT: "#C0262D", tint: "#FCE0E1" },
				warn: { DEFAULT: "#8A5700", tint: "#FFEFC4" },
			},
			fontFamily: {
				// Geist, bundled with the app (no Google Fonts request).
				display: ["'Geist Variable'", "system-ui", "sans-serif"],
				body: ["'Geist Variable'", "system-ui", "sans-serif"],
			},
		},
	},
	plugins: [],
};
