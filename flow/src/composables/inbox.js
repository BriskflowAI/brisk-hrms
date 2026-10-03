import { ref } from "vue";
import { call } from "frappe-ui";

const M = "hrms.briskrew.inbox";

// Shared so the rail badge and the Inbox screen show the same number.
export const inboxCount = ref(null);

export async function fetchInbox() {
	const res = await call(`${M}.get_inbox`);
	inboxCount.value = res.items.length;
	return res;
}

export const fetchContext = (doctype, name) => call(`${M}.get_context`, { doctype, name });

export const decide = (doctype, name, action, reason) =>
	call(`${M}.decide`, { doctype, name, action, reason: reason || null });

export const approveClear = (items) =>
	call(`${M}.approve_clear`, { items: items.map(({ doctype, name }) => ({ doctype, name })) });

export const addComment = (doctype, name, text) =>
	call(`${M}.add_comment`, { doctype, name, text });
