import { io } from "socket.io-client";
import { ref } from "vue";

// Frappe's realtime server, joined the way the desk joins it, so saved records, list changes and
// notifications reach briskrew the moment they happen. Screens keep a slow check as a fallback for
// when the server can't be reached (some proxies and codespaces don't forward its port).
export const connected = ref(false);
let socket = null;
const rooms = new Map(); // "doc:Type:name" | "doctype:Type" -> subscriber count

function host() {
	const { protocol, hostname, origin } = window.location;
	const site =
		window.site_name && !window.site_name.startsWith("{{") ? window.site_name : hostname;
	if (window.dev_server) {
		const port = /^\d+$/.test(window.socketio_port || "") ? window.socketio_port : "9000";
		return `${protocol}//${hostname}:${port}/${site}`;
	}
	return `${origin}/${site}`;
}

function connect() {
	if (socket) return socket;
	try {
		socket = io(host(), {
			withCredentials: true,
			secure: window.location.protocol === "https:",
			reconnectionAttempts: 5,
		});
	} catch {
		socket = null;
		return null;
	}
	socket.on("connect", () => {
		connected.value = true;
		// Rooms are per connection; join them again after a reconnect.
		for (const key of rooms.keys()) join(key);
	});
	socket.on("disconnect", () => (connected.value = false));
	socket.on("connect_error", () => (connected.value = false));
	return socket;
}

function join(key) {
	const [kind, doctype, ...rest] = key.split(":");
	if (kind === "doc") socket?.emit("doc_subscribe", doctype, rest.join(":"));
	else socket?.emit("doctype_subscribe", doctype);
}
function leave(key) {
	const [kind, doctype, ...rest] = key.split(":");
	if (kind === "doc") socket?.emit("doc_unsubscribe", doctype, rest.join(":"));
	else socket?.emit("doctype_unsubscribe", doctype);
}
function hold(key) {
	rooms.set(key, (rooms.get(key) || 0) + 1);
	if (rooms.get(key) === 1 && socket?.connected) join(key);
}
function release(key) {
	const n = (rooms.get(key) || 1) - 1;
	if (n > 0) rooms.set(key, n);
	else {
		rooms.delete(key);
		leave(key);
	}
}

// Calls `fn(data)` when this record is saved by anyone. Returns a function that stops it.
export function onDocUpdate(doctype, name, fn) {
	const s = connect();
	if (!s) return () => {};
	const key = `doc:${doctype}:${name}`;
	const handler = (d) => d?.doctype === doctype && d?.name === name && fn(d);
	s.on("doc_update", handler);
	hold(key);
	return () => {
		s.off("doc_update", handler);
		release(key);
	};
}

// Calls `fn(data)` when any record of this type is created, changed or deleted.
export function onListUpdate(doctype, fn) {
	const s = connect();
	if (!s) return () => {};
	const key = `doctype:${doctype}`;
	const handler = (d) => d?.doctype === doctype && fn(d);
	s.on("list_update", handler);
	hold(key);
	return () => {
		s.off("list_update", handler);
		release(key);
	};
}

// Calls `fn()` when the signed-in user gets a notification.
export function onNotification(fn) {
	const s = connect();
	if (!s) return () => {};
	s.on("notification", fn);
	return () => s.off("notification", fn);
}
