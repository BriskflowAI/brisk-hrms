// "⌘" on Apple devices, "Ctrl" elsewhere, for shortcut hints.
export const modKey = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
	? "⌘"
	: "Ctrl ";
