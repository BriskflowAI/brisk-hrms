import frappe


def get_context(context):
	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()  # nosempgrep
	context = frappe._dict()
	context.csrf_token = csrf_token
	# Where Frappe's realtime server listens, the way the desk finds it: the same origin behind a
	# proxy, or its own port when running under `bench start`.
	context.site_name = frappe.local.site
	context.socketio_port = frappe.conf.socketio_port or 9000
	context.dev_server = int(bool(frappe._dev_server))
	return context
