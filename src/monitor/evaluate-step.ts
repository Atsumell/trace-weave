import type { Verdict } from "../core/verdict.js";
import { evaluateObservedPrefix } from "./evaluate-prefix.js";
import type { MonitorState } from "./types.js";

export function evaluateStep<TEvent>(state: MonitorState<TEvent>, event: TEvent): Verdict {
	if (state.finalized) {
		throw new Error("Cannot evaluate step on a finalized monitor");
	}

	state.trace.push(event);
	state.step++;

	const verdict = evaluateObservedPrefix(state.compiled.document, state.runtime, state.trace);
	const rootAct = state.activations.get(state.rootActivationId);
	if (rootAct) {
		rootAct.verdict = verdict;
	}
	return verdict;
}
