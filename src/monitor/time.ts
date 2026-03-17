import type { FormulaDocument } from "../core/formula-document.js";
import type { MonitorRuntime } from "../core/runtime.js";
import {
	WITHIN_MS_NON_MONOTONIC_MESSAGE,
	WITHIN_MS_TIMESTAMP_MESSAGE,
	assertWithinMsRuntimeSupport,
	usesWithinMs,
} from "./unsupported.js";

export function getTimestamp<TEvent>(runtime: MonitorRuntime<TEvent>, event: TEvent): number {
	const timestamp = runtime.timestamp?.(event);
	if (timestamp === undefined || !Number.isFinite(timestamp)) {
		throw new Error(WITHIN_MS_TIMESTAMP_MESSAGE);
	}
	return timestamp;
}

export function assertTimeSupportForTrace<TEvent>(
	doc: FormulaDocument,
	runtime: MonitorRuntime<TEvent>,
	trace: readonly TEvent[],
): void {
	if (!usesWithinMs(doc)) return;
	assertWithinMsRuntimeSupport(doc, runtime);

	let previous = Number.NEGATIVE_INFINITY;
	for (const event of trace) {
		const current = getTimestamp(runtime, event);
		if (current < previous) {
			throw new Error(WITHIN_MS_NON_MONOTONIC_MESSAGE);
		}
		previous = current;
	}
}
