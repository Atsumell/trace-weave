import { buildCounterexampleReport } from "./diagnostics.js";
import type { CounterexampleReport, InternalMonitorState, MonitorState } from "./types.js";

export function buildReport<TEvent>(
	state: MonitorState<TEvent>,
	trace: readonly TEvent[],
): CounterexampleReport | null {
	if (state.finalized) {
		return (state as InternalMonitorState<TEvent>).finalReport;
	}

	if (state.currentVerdict !== "violated") {
		return null;
	}

	return buildCounterexampleReport(state.compiled.document, state.runtime, trace);
}
