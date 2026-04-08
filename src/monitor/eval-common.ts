import type { NodeId } from "../core/ids.js";
import type { MonitorRuntime } from "../core/runtime.js";
import type { JsonValue, ValueExprArg } from "../core/values.js";

export type EvalEnv = Map<string, JsonValue>;

export function envKey(env: EvalEnv): string {
	const entries = [...env.entries()].sort(([left], [right]) => left.localeCompare(right));
	return JSON.stringify(entries);
}

export function cacheKey(nodeId: NodeId, pos: number, env: EvalEnv): string {
	return `${nodeId}:${pos}:${envKey(env)}`;
}

export function resolveArg<TEvent>(
	arg: ValueExprArg,
	event: TEvent,
	runtime: MonitorRuntime<TEvent>,
): JsonValue {
	if (arg.kind === "literal") {
		return arg.value;
	}

	const selectorFn = runtime.selectors[arg.selectorId];
	if (!selectorFn) {
		return null;
	}

	return selectorFn(event);
}

export function jsonEqual(a: JsonValue, b: JsonValue): boolean {
	if (a === b) {
		return true;
	}

	if (a === null || b === null) {
		return a === b;
	}

	if (typeof a !== typeof b) {
		return false;
	}

	if (typeof a !== "object") {
		return a === b;
	}

	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) {
			return false;
		}

		return a.every((value, index) => jsonEqual(value, b[index]!));
	}

	if (Array.isArray(b)) {
		return false;
	}

	const aObject = a as Record<string, JsonValue>;
	const bObject = b as Record<string, JsonValue>;
	const aKeys = Object.keys(aObject).sort();
	const bKeys = Object.keys(bObject).sort();
	if (aKeys.length !== bKeys.length) {
		return false;
	}

	return aKeys.every(
		(key, index) => key === bKeys[index] && jsonEqual(aObject[key]!, bObject[key]!),
	);
}
