import type { CompiledFormula } from "../compiler/prepare.js";
import type { MonitorRuntime } from "../core/runtime.js";
import { createRootEnv, resetEnvCounter } from "./env.js";
import { ensureActivation, materializeTreeActivations } from "./materialize.js";
import type { MonitorState } from "./types.js";
import { assertWithinMsRuntimeSupport } from "./unsupported.js";

export function createMonitor<TEvent>(
	compiled: CompiledFormula,
	runtime: MonitorRuntime<TEvent>,
): MonitorState<TEvent> {
	assertWithinMsRuntimeSupport(compiled.document, runtime);
	resetEnvCounter();

	const state: MonitorState<TEvent> = {
		compiled,
		runtime,
		step: 0,
		trace: [],
		envs: new Map(),
		activations: new Map(),
		nodeActivations: new Map(),
		scheduled: [],
		dirtyQueue: [],
		rootActivationId: null as never,
		finalized: false,
		finalVerdict: null,
		finalReport: null,
	};

	const rootEnvId = createRootEnv(state);
	materializeTreeActivations(state, compiled.document.root, rootEnvId);
	const rootActId = ensureActivation(state, compiled.document.root, rootEnvId);
	state.rootActivationId = rootActId;

	// Mark all activations as dirty for initial sweep
	for (const [nodeId, acts] of state.nodeActivations) {
		for (const aid of acts) {
			state.dirtyQueue.push({ nodeId, activationId: aid });
		}
	}

	return state;
}
