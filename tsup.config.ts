import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		"core/index": "src/core/index.ts",
		"builder/index": "src/builder/index.ts",
		"compiler/index": "src/compiler/index.ts",
		"monitor/index": "src/monitor/index.ts",
		"patterns/index": "src/patterns/index.ts",
		"fast-check/index": "src/fast-check/index.ts",
		"vitest/index": "src/vitest/index.ts",
		"ai/index": "src/ai/index.ts",
	},
	format: ["esm"],
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: true,
});
