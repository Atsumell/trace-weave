import type { CaptureName, PredicateId, SelectorId } from "./ids.js";
import type { FormulaMeta } from "./meta.js";
import type { ValueExprArg } from "./values.js";

// --- Leaf nodes ---

export interface LiteralExpr {
	readonly kind: "literal";
	readonly value: boolean;
	readonly meta?: FormulaMeta;
}

export interface PredicateExpr {
	readonly kind: "predicate";
	readonly predicateId: PredicateId;
	readonly args?: readonly ValueExprArg[];
	readonly meta?: FormulaMeta;
}

export interface WhenExpr {
	readonly kind: "when";
	readonly captureName: CaptureName;
	readonly selectorId: SelectorId;
	readonly child: FormulaExpr;
	readonly meta?: FormulaMeta;
}

export interface CaptureExpr {
	readonly kind: "capture";
	readonly captureName: CaptureName;
	readonly selectorId: SelectorId;
	readonly child: FormulaExpr;
	readonly meta?: FormulaMeta;
}

// --- Boolean operators ---

export interface NotExpr {
	readonly kind: "not";
	readonly child: FormulaExpr;
	readonly meta?: FormulaMeta;
}

export interface AndExpr {
	readonly kind: "and";
	readonly children: readonly FormulaExpr[];
	readonly meta?: FormulaMeta;
}

export interface OrExpr {
	readonly kind: "or";
	readonly children: readonly FormulaExpr[];
	readonly meta?: FormulaMeta;
}

export interface ImpliesExpr {
	readonly kind: "implies";
	readonly left: FormulaExpr;
	readonly right: FormulaExpr;
	readonly meta?: FormulaMeta;
}

// --- Future temporal operators ---

export interface AlwaysExpr {
	readonly kind: "always";
	readonly child: FormulaExpr;
	readonly meta?: FormulaMeta;
}

export interface EventuallyExpr {
	readonly kind: "eventually";
	readonly child: FormulaExpr;
	readonly meta?: FormulaMeta;
}

export interface NextExpr {
	readonly kind: "next";
	readonly child: FormulaExpr;
	readonly meta?: FormulaMeta;
}

export interface WeakNextExpr {
	readonly kind: "weakNext";
	readonly child: FormulaExpr;
	readonly meta?: FormulaMeta;
}

export interface UntilExpr {
	readonly kind: "until";
	readonly left: FormulaExpr;
	readonly right: FormulaExpr;
	readonly meta?: FormulaMeta;
}

export interface ReleaseExpr {
	readonly kind: "release";
	readonly left: FormulaExpr;
	readonly right: FormulaExpr;
	readonly meta?: FormulaMeta;
}

// --- Past temporal operators ---

export interface OnceExpr {
	readonly kind: "once";
	readonly child: FormulaExpr;
	readonly meta?: FormulaMeta;
}

export interface HistoricallyExpr {
	readonly kind: "historically";
	readonly child: FormulaExpr;
	readonly meta?: FormulaMeta;
}

export interface SinceExpr {
	readonly kind: "since";
	readonly left: FormulaExpr;
	readonly right: FormulaExpr;
	readonly meta?: FormulaMeta;
}

// --- Bounded operators ---

export interface WithinStepsExpr {
	readonly kind: "withinSteps";
	readonly steps: number;
	readonly child: FormulaExpr;
	readonly meta?: FormulaMeta;
}

export interface WithinMsExpr {
	readonly kind: "withinMs";
	readonly ms: number;
	readonly child: FormulaExpr;
	readonly meta?: FormulaMeta;
}

export type FormulaExpr =
	| LiteralExpr
	| PredicateExpr
	| WhenExpr
	| CaptureExpr
	| NotExpr
	| AndExpr
	| OrExpr
	| ImpliesExpr
	| AlwaysExpr
	| EventuallyExpr
	| NextExpr
	| WeakNextExpr
	| UntilExpr
	| ReleaseExpr
	| OnceExpr
	| HistoricallyExpr
	| SinceExpr
	| WithinStepsExpr
	| WithinMsExpr;
