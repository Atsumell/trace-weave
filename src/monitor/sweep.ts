import type { ActivationId, NodeId } from "../core/ids.js";
import { recompute } from "./recompute.js";
import type { MonitorState } from "./types.js";

export function sweep<TEvent>(
	state: MonitorState<TEvent>,
	event: TEvent,
	isTraceEnd: boolean,
): void {
	// Process dirty queue in topo order (leaves first)
	// We may get new dirty entries during sweep (e.g., from capture creating child activations)
	// so we loop until stable

	let iterations = 0;
	const maxIterations = state.compiled.topoOrder.length * state.activations.size + 100;

	while (state.dirtyQueue.length > 0) {
		if (++iterations > maxIterations) {
			throw new Error("Monitor sweep exceeded maximum iterations — possible infinite loop");
		}

		// Sort dirty by topo order (leaves first)
		const topoIndex = new Map<NodeId, number>();
		for (let i = 0; i < state.compiled.topoOrder.length; i++) {
			topoIndex.set(state.compiled.topoOrder[i]!, i);
		}

		const batch = [...state.dirtyQueue];
		state.dirtyQueue.length = 0;

		batch.sort((a, b) => {
			const ai = topoIndex.get(a.nodeId) ?? 0;
			const bi = topoIndex.get(b.nodeId) ?? 0;
			return ai - bi;
		});

		// Deduplicate
		const seen = new Set<string>();
		const dedupedBatch = batch.filter((entry) => {
			const key = `${entry.nodeId}:${entry.activationId}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});

		for (const entry of dedupedBatch) {
			const activation = state.activations.get(entry.activationId);
			if (!activation) continue;

			const oldVerdict = activation.verdict;
			const newVerdict = recompute(state, activation, event, isTraceEnd);

			if (newVerdict !== oldVerdict) {
				activation.verdict = newVerdict;
				// Mark parents as dirty
				const parentNodeIds = state.compiled.parents[activation.nodeId];
				if (parentNodeIds) {
					for (const parentNodeId of parentNodeIds) {
						const parentActivations = state.nodeActivations.get(parentNodeId);
						if (parentActivations) {
							for (const pAid of parentActivations) {
								state.dirtyQueue.push({ nodeId: parentNodeId, activationId: pAid });
							}
						}
					}
				}
			}
		}
	}
}
