import * as fc from "fast-check";

export interface TraceConfig<TEvent> {
	readonly eventArbitrary: fc.Arbitrary<TEvent>;
	readonly minLength?: number;
	readonly maxLength?: number;
}

export function traceArbitrary<TEvent>(config: TraceConfig<TEvent>): fc.Arbitrary<TEvent[]> {
	return fc.array(config.eventArbitrary, {
		minLength: config.minLength ?? 1,
		maxLength: config.maxLength ?? 50,
	});
}
