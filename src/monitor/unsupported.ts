import type { FormulaDocument } from "../core/formula-document.js";
import type { MonitorRuntime } from "../core/runtime.js";

export const WITHIN_MS_RUNTIME_MESSAGE =
	"withinMs requires MonitorRuntime.timestamp to be defined and return event timestamps in milliseconds.";

export const WITHIN_MS_TIMESTAMP_MESSAGE =
	"MonitorRuntime.timestamp must return a finite number of milliseconds for every event.";

export const WITHIN_MS_NON_MONOTONIC_MESSAGE =
	"MonitorRuntime.timestamp must be non-decreasing across the trace when using withinMs.";

export function usesWithinMs(doc: FormulaDocument): boolean {
	for (const node of Object.values(doc.nodes)) {
		if (node.kind === "withinMs") {
			return true;
		}
	}
	return false;
}

export function assertWithinMsRuntimeSupport<TEvent>(
	doc: FormulaDocument,
	runtime: MonitorRuntime<TEvent>,
): void {
	if (usesWithinMs(doc) && !runtime.timestamp) {
		throw new Error(WITHIN_MS_RUNTIME_MESSAGE);
	}
}
