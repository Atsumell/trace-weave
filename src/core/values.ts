import type { SelectorId } from "./ids.js";

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| readonly JsonValue[]
	| { readonly [key: string]: JsonValue };

export type ValueExprArg =
	| { readonly kind: "currentSelector"; readonly selectorId: SelectorId }
	| { readonly kind: "literal"; readonly value: JsonValue };

export function current(selectorId: SelectorId): ValueExprArg {
	return { kind: "currentSelector", selectorId };
}

export function value(v: JsonValue): ValueExprArg {
	return { kind: "literal", value: v };
}
