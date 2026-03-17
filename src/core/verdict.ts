export type Verdict = "satisfied" | "violated" | "pending";

export function notV(v: Verdict): Verdict {
	switch (v) {
		case "satisfied":
			return "violated";
		case "violated":
			return "satisfied";
		case "pending":
			return "pending";
	}
}

export function andV(a: Verdict, b: Verdict): Verdict {
	if (a === "violated" || b === "violated") return "violated";
	if (a === "pending" || b === "pending") return "pending";
	return "satisfied";
}

export function orV(a: Verdict, b: Verdict): Verdict {
	if (a === "satisfied" || b === "satisfied") return "satisfied";
	if (a === "pending" || b === "pending") return "pending";
	return "violated";
}

export function impliesV(a: Verdict, b: Verdict): Verdict {
	return orV(notV(a), b);
}
