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
