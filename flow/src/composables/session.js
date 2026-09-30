function cookie(name) {
	const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
	return hit ? decodeURIComponent(hit.split("=").slice(1).join("=")) : "";
}

export function useSession() {
	if (window.__briskrewDemoUser)
		return {
			user: window.__briskrewDemoUser.user,
			fullName: window.__briskrewDemoUser.full_name,
		};
	return {
		user: cookie("user_id"),
		fullName: cookie("full_name") || cookie("user_id"),
	};
}
