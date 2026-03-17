import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const tempRoot = mkdtempSync(path.join(tmpdir(), "trace-weave-pack-"));

const tarballName = execFileSync("npm", ["pack", "--pack-destination", tempRoot], {
	cwd: repoRoot,
	encoding: "utf8",
})
	.trim()
	.split("\n")
	.at(-1);

if (!tarballName) {
	throw new Error("npm pack did not return a tarball name");
}

execFileSync("tar", ["-xzf", path.join(tempRoot, tarballName), "-C", tempRoot], { cwd: repoRoot });

const packedDir = path.join(tempRoot, "package");

function createConsumer(name, dependencies = []) {
	const consumerDir = path.join(tempRoot, name);
	const consumerNodeModules = path.join(consumerDir, "node_modules");

	mkdirSync(consumerNodeModules, { recursive: true });
	cpSync(packedDir, path.join(consumerNodeModules, "trace-weave"), { recursive: true });

	for (const dependency of dependencies) {
		const dependencyPath = path.join(repoRoot, "node_modules", dependency);
		if (existsSync(dependencyPath)) {
			symlinkSync(dependencyPath, path.join(consumerNodeModules, dependency), "dir");
		}
	}

	return consumerDir;
}

const baselineConsumerDir = createConsumer("consumer-baseline");

writeFileSync(
	path.join(baselineConsumerDir, "check.mjs"),
	[
		"const [core, builder, compiler, monitor, patterns, ai] = await Promise.all([",
		'\timport("trace-weave/core"),',
		'\timport("trace-weave/builder"),',
		'\timport("trace-weave/compiler"),',
		'\timport("trace-weave/monitor"),',
		'\timport("trace-weave/patterns"),',
		'\timport("trace-weave/ai"),',
		"]);",
		'if (typeof core.predicateId !== "function") throw new Error("core export missing");',
		'if (typeof builder.always !== "function") throw new Error("builder export missing");',
		'if (typeof compiler.compile !== "function") throw new Error("compiler export missing");',
		'if (typeof monitor.runOracle !== "function") throw new Error("monitor export missing");',
		'if (typeof monitor.finalizeEmpty !== "function") throw new Error("monitor finalizeEmpty export missing");',
		'if (typeof patterns.response !== "function") throw new Error("patterns export missing");',
		'if (typeof ai.formatReport !== "function") throw new Error("ai export missing");',
		'const isOk = core.predicateId("isOk");',
		"const formula = builder.always(builder.predicate(isOk));",
		"const compiled = compiler.prepare(compiler.compile(formula));",
		'const runtime = { predicates: { [isOk]: (event) => event.type === "ok" }, selectors: {} };',
		"const emptyMonitor = monitor.createMonitor(compiled, runtime);",
		'if (monitor.finalizeEmpty(emptyMonitor) !== "satisfied") throw new Error("monitor finalizeEmpty execution failed");',
		'console.log("baseline import smoke passed");',
		"",
	].join("\n"),
);

execFileSync("node", ["check.mjs"], {
	cwd: baselineConsumerDir,
	stdio: "inherit",
});

const optionalConsumerDir = createConsumer("consumer-optional", ["fast-check", "vitest"]);

writeFileSync(
	path.join(optionalConsumerDir, "check.mjs"),
	[
		'const [fastCheck] = await Promise.all([import("trace-weave/fast-check")]);',
		'if (typeof fastCheck.traceProperty !== "function") throw new Error("fast-check export missing");',
		'console.log("optional import smoke passed");',
		"",
	].join("\n"),
);

writeFileSync(
	path.join(optionalConsumerDir, "vitest-smoke.test.mjs"),
	[
		'import { describe, expect, it } from "vitest";',
		'import { installMatchers } from "trace-weave/vitest";',
		'import { always, predicate } from "trace-weave/builder";',
		'import { predicateId } from "trace-weave/core";',
		"",
		"installMatchers();",
		"",
		'const isOk = predicateId("isOk");',
		"const runtime = {",
		"\tpredicates: {",
		'\t\t[isOk]: (event) => event.type === "ok",',
		"\t},",
		"\tselectors: {},",
		"};",
		"const formula = always(predicate(isOk));",
		"",
		'describe("packed vitest export", () => {',
		'\tit("extends expect", () => {',
		'\t\texpect([{ type: "ok" }]).toSatisfy(formula, runtime);',
		"\t});",
		"});",
		"",
	].join("\n"),
);

execFileSync("node", ["check.mjs"], {
	cwd: optionalConsumerDir,
	stdio: "inherit",
});

execFileSync(
	"node",
	[path.join(repoRoot, "node_modules", "vitest", "vitest.mjs"), "run", "vitest-smoke.test.mjs"],
	{
		cwd: optionalConsumerDir,
		stdio: "inherit",
	},
);
