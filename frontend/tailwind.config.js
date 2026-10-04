import frappeUIPreset from "frappe-ui/src/tailwind/preset"
export default {
	presets: [frappeUIPreset],
	content: [
		"./index.html",
		"./src/**/*.{vue,js,ts,jsx,tsx}",
		"./node_modules/frappe-ui/src/components/**/*.{vue,js,ts,jsx,tsx}",
		"../node_modules/frappe-ui/src/components/**/*.{vue,js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			// briskrew's cool blue-greys and cobalt in place of the default grey and blue
			colors: {
				gray: {
					50: "#F7F8FC",
					100: "#F2F4F9",
					200: "#E5E9F2",
					300: "#D5DBE8",
					400: "#9AA3C7",
					500: "#5A6384",
					600: "#4A5274",
					700: "#394264",
					800: "#1F2750",
					900: "#0E1433",
				},
				blue: {
					50: "#F0F2FF",
					100: "#E2E6FF",
					200: "#C9D0FD",
					300: "#A9B4F7",
					400: "#6E7DEE",
					500: "#2B3FE0",
					600: "#2433C0",
					700: "#1D2A9E",
					800: "#16207A",
					900: "#0E1433",
				},
				lime: "#C9F24B",
			},
			fontFamily: {
				sans: ["Geist", "system-ui", "sans-serif"],
				display: ["Geist", "system-ui", "sans-serif"],
			},
			screens: {
				standalone: {
					raw: "(display-mode: standalone)",
				},
			},
			padding: {
				"safe-top": "env(safe-area-inset-top)",
				"safe-right": "env(safe-area-inset-right)",
				"safe-bottom": "env(safe-area-inset-bottom)",
				"safe-left": "env(safe-area-inset-left)",
			},
		},
	},
	plugins: [],
}
