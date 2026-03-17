import * as fc from "fast-check";

export interface TraceEvent<TModel> {
	readonly type: string;
	readonly payload?: unknown;
	readonly modelBefore?: TModel;
	readonly modelAfter?: TModel;
}

export interface CommandAdapterConfig<TModel extends object, TReal> {
	readonly commands: fc.Arbitrary<fc.Command<TModel, TReal>>[];
	readonly initialModel: () => TModel;
	readonly initialReal: () => TReal;
}

export function commandAdapter<TModel extends object, TReal>(
	config: CommandAdapterConfig<TModel, TReal>,
): fc.Arbitrary<TraceEvent<TModel>[]> {
	return fc.commands(config.commands).map((cmds) => {
		const events: TraceEvent<TModel>[] = [];
		const model = config.initialModel();
		const real = config.initialReal();

		for (const cmd of cmds) {
			if (cmd.check(model)) {
				const modelBefore = JSON.parse(JSON.stringify(model)) as TModel;
				cmd.run(model, real);
				const modelAfter = JSON.parse(JSON.stringify(model)) as TModel;

				events.push({
					type: cmd.toString(),
					modelBefore,
					modelAfter,
				});
			}
		}

		return events;
	});
}
