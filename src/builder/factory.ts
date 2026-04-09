import type {
	AlwaysExpr,
	AndExpr,
	CaptureExpr,
	CaptureName,
	EventuallyExpr,
	FormulaExpr,
	FormulaMeta,
	HistoricallyExpr,
	ImpliesExpr,
	LiteralExpr,
	NextExpr,
	NotExpr,
	OnceExpr,
	OrExpr,
	PredicateExpr,
	PredicateId,
	ReleaseExpr,
	SelectorId,
	SinceExpr,
	UntilExpr,
	ValueExprArg,
	WeakNextExpr,
	WhenExpr,
	WithinMsExpr,
	WithinStepsExpr,
} from "../core/index.js";

export function toExpr(v: boolean | FormulaExpr): FormulaExpr {
	if (typeof v === "boolean") return literal(v);
	return v;
}

export function annotate(expr: FormulaExpr, meta: FormulaMeta): FormulaExpr {
	return { ...expr, meta } as FormulaExpr;
}

// --- Leaf nodes ---

export function literal(value: boolean): LiteralExpr {
	return { kind: "literal", value };
}

/**
 * Point assertion at the current trace position.
 *
 * When used as the root formula, this checks only position 0 of the trace.
 * Wrap it with `eventually(...)` to ask whether the predicate appears anywhere
 * in the trace, or with `always(...)` to require it at every position.
 */
export function predicate(
	predicateId: PredicateId,
	...args: readonly ValueExprArg[]
): PredicateExpr {
	return args.length > 0
		? { kind: "predicate", predicateId, args }
		: { kind: "predicate", predicateId };
}

export function when(
	captureName: CaptureName,
	selectorId: SelectorId,
	child: boolean | FormulaExpr,
): WhenExpr {
	return { kind: "when", captureName, selectorId, child: toExpr(child) };
}

export function capture(
	captureName: CaptureName,
	selectorId: SelectorId,
	child: boolean | FormulaExpr,
): CaptureExpr {
	return { kind: "capture", captureName, selectorId, child: toExpr(child) };
}

// --- Boolean operators ---

export function not(child: boolean | FormulaExpr): NotExpr {
	return { kind: "not", child: toExpr(child) };
}

export function and(...children: readonly (boolean | FormulaExpr)[]): AndExpr {
	return { kind: "and", children: children.map(toExpr) };
}

export function or(...children: readonly (boolean | FormulaExpr)[]): OrExpr {
	return { kind: "or", children: children.map(toExpr) };
}

export function implies(left: boolean | FormulaExpr, right: boolean | FormulaExpr): ImpliesExpr {
	return { kind: "implies", left: toExpr(left), right: toExpr(right) };
}

// --- Future temporal operators ---

export function always(child: boolean | FormulaExpr): AlwaysExpr {
	return { kind: "always", child: toExpr(child) };
}

export function eventually(child: boolean | FormulaExpr): EventuallyExpr {
	return { kind: "eventually", child: toExpr(child) };
}

export function next(child: boolean | FormulaExpr): NextExpr {
	return { kind: "next", child: toExpr(child) };
}

export function weakNext(child: boolean | FormulaExpr): WeakNextExpr {
	return { kind: "weakNext", child: toExpr(child) };
}

export function until(left: boolean | FormulaExpr, right: boolean | FormulaExpr): UntilExpr {
	return { kind: "until", left: toExpr(left), right: toExpr(right) };
}

export function release(left: boolean | FormulaExpr, right: boolean | FormulaExpr): ReleaseExpr {
	return { kind: "release", left: toExpr(left), right: toExpr(right) };
}

// --- Past temporal operators ---

export function once(child: boolean | FormulaExpr): OnceExpr {
	return { kind: "once", child: toExpr(child) };
}

export function historically(child: boolean | FormulaExpr): HistoricallyExpr {
	return { kind: "historically", child: toExpr(child) };
}

export function since(left: boolean | FormulaExpr, right: boolean | FormulaExpr): SinceExpr {
	return { kind: "since", left: toExpr(left), right: toExpr(right) };
}

// --- Bounded operators ---

export function withinSteps(steps: number, child: boolean | FormulaExpr): WithinStepsExpr {
	return { kind: "withinSteps", steps, child: toExpr(child) };
}

export function withinMs(ms: number, child: boolean | FormulaExpr): WithinMsExpr {
	return { kind: "withinMs", ms, child: toExpr(child) };
}
