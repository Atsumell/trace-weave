import type { ActivationId, NodeId } from "../core/ids.js";
import type { MonitorState, ScheduledObligation } from "./types.js";

export function scheduleNext<TEvent>(
	state: MonitorState<TEvent>,
	nodeId: NodeId,
	activationId: ActivationId,
): void {
	state.scheduled.push({
		step: state.step + 1,
		nodeId,
		activationId,
	});
}

export function materializeDueObligations<TEvent>(state: MonitorState<TEvent>): void {
	const due: ScheduledObligation[] = [];
	const remaining: ScheduledObligation[] = [];

	for (const ob of state.scheduled) {
		if (ob.step <= state.step) {
			due.push(ob);
		} else {
			remaining.push(ob);
		}
	}

	state.scheduled.length = 0;
	state.scheduled.push(...remaining);

	for (const ob of due) {
		state.dirtyQueue.push({ nodeId: ob.nodeId, activationId: ob.activationId });
	}
}
