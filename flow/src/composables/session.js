function cookie(name) {
	const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
	return hit ? decodeURIComponent(hit.split("=").slice(1).join("=")) : "";
}

export function useSession() {
	return {
		user: cookie("user_id"),
		fullName: cookie("full_name") || cookie("user_id"),
	};
}

// Frappe's own logout, then its sign-in page.
export async function logout() {
	try {
		await fetch("/api/method/logout", {
			method: "POST",
			headers: { "X-Frappe-CSRF-Token": window.csrf_token || "" },
		});
	} finally {
		window.location.href = "/login";
	}
}
