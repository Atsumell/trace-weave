import { print } from "../compiler/printer.js";
import type { Verdict } from "../core/verdict.js";
import { buildCounterexampleReport } from "./diagnostics.js";
import { evaluateFormula } from "./evaluate.js";
import type { InternalMonitorState, MonitorState } from "./types.js";

export function finalize<TEvent>(state: MonitorState<TEvent>, lastEvent: TEvent): Verdict {
	if (state.finalized) {
		return getFinalizedVerdict(state);
	}

	if (state.trace.length === 0) {
		state.trace.push(lastEvent);
	}

	return finalizeObservedTrace(state);
}

export function finalizeEmpty<TEvent>(state: MonitorState<TEvent>): Verdict {
	if (state.finalized) {
		return getFinalizedVerdict(state);
	}

	if (state.trace.length > 0) {
		throw new Error("Cannot finalize a non-empty monitor with finalizeEmpty(); use finalize()");
	}

	return finalizeObservedTrace(state);
}

function getFinalizedVerdict<TEvent>(state: MonitorState<TEvent>): Verdict {
	const internalState = state as InternalMonitorState<TEvent>;
	return internalState.finalVerdict ?? state.currentVerdict;
}

function finalizeObservedTrace<TEvent>(state: MonitorState<TEvent>): Verdict {
	const internalState = state as InternalMonitorState<TEvent>;
	state.finalized = true;

	const verdict = evaluateFormula(state.compiled.document, state.runtime, state.trace);
	state.currentVerdict = verdict;
	internalState.finalVerdict = verdict;
	internalState.finalReport =
		verdict === "violated"
			? (buildCounterexampleReport(state.compiled.document, state.runtime, state.trace) ?? {
					verdict: "violated",
					failurePath: [],
					traceSlice: state.trace.map((event, i) => ({ step: i + 1, event })),
					summary: `Formula violated: ${print(state.compiled.document)}`,
				})
			: null;

	return verdict;
}
