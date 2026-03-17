import type { CaptureName, EnvId } from "../core/ids.js";
import { envId } from "../core/ids.js";
import type { JsonValue } from "../core/values.js";
import type { EnvFrame, MonitorState } from "./types.js";

let envCounter = 0;

export function freshEnvId(): EnvId {
	return envId(`env_${++envCounter}`);
}

export function resetEnvCounter(): void {
	envCounter = 0;
}

export function createRootEnv<TEvent>(state: MonitorState<TEvent>): EnvId {
	const id = freshEnvId();
	const frame: EnvFrame = { id, parent: null, bindings: {} };
	state.envs.set(id, frame);
	return id;
}

export function allocChildEnv<TEvent>(
	state: MonitorState<TEvent>,
	parentId: EnvId,
	name: CaptureName,
	value: JsonValue,
): EnvId {
	const id = freshEnvId();
	const frame: EnvFrame = {
		id,
		parent: parentId,
		bindings: { [name as string]: value },
	};
	state.envs.set(id, frame);
	return id;
}

export function resolveCapture<TEvent>(
	state: MonitorState<TEvent>,
	envIdVal: EnvId,
	name: CaptureName,
): JsonValue | undefined {
	let current: EnvId | null = envIdVal;
	while (current !== null) {
		const frame = state.envs.get(current);
		if (!frame) return undefined;
		const key = name as string;
		if (Object.hasOwn(frame.bindings, key)) {
			return frame.bindings[key];
		}
		current = frame.parent;
	}
	return undefined;
}
