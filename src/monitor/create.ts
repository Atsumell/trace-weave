import type { CompiledFormula } from "../compiler/prepare.js";
import type { MonitorRuntime } from "../core/runtime.js";
import type { InternalMonitorState, MonitorState } from "./types.js";
import { assertWithinMsRuntimeSupport } from "./unsupported.js";

export function createMonitor<TEvent>(
	compiled: CompiledFormula,
	runtime: MonitorRuntime<TEvent>,
): MonitorState<TEvent> {
	assertWithinMsRuntimeSupport(compiled.document, runtime);

	const state: InternalMonitorState<TEvent> = {
		compiled,
		runtime,
		step: 0,
		trace: [],
		currentVerdict: "pending",
		finalized: false,
		finalVerdict: null,
		finalReport: null,
	};

	return state;
}
