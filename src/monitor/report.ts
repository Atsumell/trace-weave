import type { FormulaNode } from "../core/formula-node.js";
import type { ActivationId, NodeId } from "../core/ids.js";
import type { Verdict } from "../core/verdict.js";
import type { CounterexampleReport, MonitorState, ObligationSnapshot } from "./types.js";

export function buildReport<TEvent>(
	state: MonitorState<TEvent>,
	trace: readonly TEvent[],
): CounterexampleReport | null {
	if (state.finalized) {
		return state.finalReport;
	}

	const rootAct = state.activations.get(state.rootActivationId);
	if (!rootAct || rootAct.verdict !== "violated") return null;

	const failurePath: ObligationSnapshot[] = [];
	collectFailurePath(state, rootAct.nodeId, rootAct.id, failurePath);

	const traceSlice = trace.map((event, i) => ({ step: i + 1, event }));

	const summary = buildSummary(state, failurePath);

	return {
		verdict: "violated",
		failurePath,
		traceSlice,
		summary,
	};
}

function collectFailurePath<TEvent>(
	state: MonitorState<TEvent>,
	nodeId: NodeId,
	activationId: ActivationId,
	path: ObligationSnapshot[],
): void {
	const activation = state.activations.get(activationId);
	if (!activation) return;

	path.push({
		nodeId: activation.nodeId,
		activationId: activation.id,
		verdict: activation.verdict,
		step: activation.startStep,
	});

	const node = state.compiled.document.nodes[nodeId];
	if (!node) return;

	// Recurse into violated children
	const childIds = getChildNodeIds(node);
	for (const childId of childIds) {
		const childActs = state.nodeActivations.get(childId);
		if (childActs) {
			for (const caid of childActs) {
				const childAct = state.activations.get(caid);
				if (childAct && childAct.verdict === "violated" && childAct.envId === activation.envId) {
					collectFailurePath(state, childId, caid, path);
					break;
				}
			}
		}
	}
}

function getChildNodeIds(node: FormulaNode): NodeId[] {
	switch (node.kind) {
		case "literal":
		case "predicate":
			return [];
		case "not":
		case "always":
		case "eventually":
		case "next":
		case "weakNext":
		case "once":
		case "historically":
		case "withinSteps":
		case "withinMs":
		case "when":
		case "capture":
			return [node.child];
		case "and":
		case "or":
			return [...node.children];
		case "implies":
		case "until":
		case "release":
		case "since":
			return [node.left, node.right];
	}
}

function buildSummary<TEvent>(
	state: MonitorState<TEvent>,
	failurePath: readonly ObligationSnapshot[],
): string {
	const parts: string[] = ["Formula violated."];

	for (const snap of failurePath) {
		const node = state.compiled.document.nodes[snap.nodeId];
		if (node) {
			const provenance = state.compiled.document.provenance?.[snap.nodeId];
			const label = provenance?.meta?.humanLabel ?? node.kind;
			parts.push(`  ${label} at step ${snap.step}: ${snap.verdict}`);
		}
	}

	return parts.join("\n");
}
