import { buildCounterexampleReport } from "./diagnostics.js";
import type { CounterexampleReport, MonitorState } from "./types.js";

export function buildReport<TEvent>(
	state: MonitorState<TEvent>,
	trace: readonly TEvent[],
): CounterexampleReport | null {
	if (state.finalized) {
		return state.finalReport;
	}

	const rootAct = state.activations.get(state.rootActivationId);
	if (!rootAct || rootAct.verdict !== "violated") {
		return null;
	}

	return buildCounterexampleReport(state.compiled.document, state.runtime, trace);
}
