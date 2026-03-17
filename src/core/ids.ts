declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type NodeId = Brand<string, "NodeId">;
export type PredicateId = Brand<string, "PredicateId">;
export type SelectorId = Brand<string, "SelectorId">;
export type CaptureName = Brand<string, "CaptureName">;
export type ActivationId = Brand<string, "ActivationId">;
export type EnvId = Brand<string, "EnvId">;

export function nodeId(s: string): NodeId {
	return s as NodeId;
}

export function predicateId(s: string): PredicateId {
	return s as PredicateId;
}

export function selectorId(s: string): SelectorId {
	return s as SelectorId;
}

export function captureName(s: string): CaptureName {
	return s as CaptureName;
}

export function activationId(s: string): ActivationId {
	return s as ActivationId;
}

export function envId(s: string): EnvId {
	return s as EnvId;
}
