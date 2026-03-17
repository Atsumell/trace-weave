import type { CaptureName, NodeId, PredicateId, SelectorId } from "./ids.js";
import type { ValueExprArg } from "./values.js";

// --- Leaf nodes ---

export interface LiteralNode {
	readonly kind: "literal";
	readonly value: boolean;
}

export interface PredicateNode {
	readonly kind: "predicate";
	readonly predicateId: PredicateId;
	readonly args?: readonly ValueExprArg[];
}

export interface WhenNode {
	readonly kind: "when";
	readonly captureName: CaptureName;
	readonly selectorId: SelectorId;
	readonly child: NodeId;
}

export interface CaptureNode {
	readonly kind: "capture";
	readonly captureName: CaptureName;
	readonly selectorId: SelectorId;
	readonly child: NodeId;
}

// --- Boolean operators ---

export interface NotNode {
	readonly kind: "not";
	readonly child: NodeId;
}

export interface AndNode {
	readonly kind: "and";
	readonly children: readonly NodeId[];
}

export interface OrNode {
	readonly kind: "or";
	readonly children: readonly NodeId[];
}

export interface ImpliesNode {
	readonly kind: "implies";
	readonly left: NodeId;
	readonly right: NodeId;
}

// --- Future temporal operators ---

export interface AlwaysNode {
	readonly kind: "always";
	readonly child: NodeId;
}

export interface EventuallyNode {
	readonly kind: "eventually";
	readonly child: NodeId;
}

export interface NextNode {
	readonly kind: "next";
	readonly child: NodeId;
}

export interface WeakNextNode {
	readonly kind: "weakNext";
	readonly child: NodeId;
}

export interface UntilNode {
	readonly kind: "until";
	readonly left: NodeId;
	readonly right: NodeId;
}

export interface ReleaseNode {
	readonly kind: "release";
	readonly left: NodeId;
	readonly right: NodeId;
}

// --- Past temporal operators ---

export interface OnceNode {
	readonly kind: "once";
	readonly child: NodeId;
}

export interface HistoricallyNode {
	readonly kind: "historically";
	readonly child: NodeId;
}

export interface SinceNode {
	readonly kind: "since";
	readonly left: NodeId;
	readonly right: NodeId;
}

// --- Bounded operators ---

export interface WithinStepsNode {
	readonly kind: "withinSteps";
	readonly steps: number;
	readonly child: NodeId;
}

export interface WithinMsNode {
	readonly kind: "withinMs";
	readonly ms: number;
	readonly child: NodeId;
}

export type FormulaNode =
	| LiteralNode
	| PredicateNode
	| WhenNode
	| CaptureNode
	| NotNode
	| AndNode
	| OrNode
	| ImpliesNode
	| AlwaysNode
	| EventuallyNode
	| NextNode
	| WeakNextNode
	| UntilNode
	| ReleaseNode
	| OnceNode
	| HistoricallyNode
	| SinceNode
	| WithinStepsNode
	| WithinMsNode;
