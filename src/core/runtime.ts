import type { PredicateId, SelectorId } from "./ids.js";
import type { JsonValue } from "./values.js";

export interface MonitorRuntime<TEvent> {
	readonly predicates: Readonly<
		Record<PredicateId, (event: TEvent, args: readonly JsonValue[]) => boolean>
	>;
	readonly selectors: Readonly<Record<SelectorId, (event: TEvent) => JsonValue>>;
	readonly timestamp?: (event: TEvent) => number;
}
