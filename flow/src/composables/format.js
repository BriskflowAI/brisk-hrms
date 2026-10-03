// Department names carry the company abbreviation ("Design - BFD"); people don't need to see it.
export const dept = (name) => String(name || "").replace(/ - [^-]+$/, "");
