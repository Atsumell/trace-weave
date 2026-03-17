import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateSkills } from "../../scripts/validate-skills.mjs";

const tempDirectories = [];

async function createTempRepo() {
	const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "trace-weave-skill-"));
	tempDirectories.push(tempDirectory);
	return tempDirectory;
}

afterEach(async () => {
	await Promise.all(
		tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe("validateSkills", () => {
	it("accepts the repository skills", async () => {
		await expect(validateSkills(process.cwd())).resolves.toEqual([]);
	});

	it("reports missing references and companion docs", async () => {
		const repoRoot = await createTempRepo();
		const skillRoot = path.join(repoRoot, "skills", "demo-skill");
		const referencesRoot = path.join(skillRoot, "references");

		await mkdir(referencesRoot, { recursive: true });
		await writeFile(
			path.join(skillRoot, "SKILL.md"),
			`---
name: demo-skill
description: Demo skill
---

# Demo Skill

[Missing reference](references/missing.md)
`,
		);
		await writeFile(
			path.join(skillRoot, "skill.json"),
			JSON.stringify(
				{
					name: "demo-skill",
					version: "0.1.0",
					entry: "SKILL.md",
					targetAgents: ["codex"],
					traceWeaveCompatibility: "^0.1.0",
					language: "en",
					companionDocs: [{ locale: "ja", path: "../../docs/missing.ja.md" }],
					references: ["references/missing.md"],
				},
				null,
				2,
			),
		);

		const errors = await validateSkills(repoRoot);
		expect(errors).toContain("skills/demo-skill: missing reference file references/missing.md");
		expect(errors).toContain(
			"skills/demo-skill: companion doc does not exist: ../../docs/missing.ja.md",
		);
		expect(errors).toContain(
			"skills/demo-skill: linked reference does not exist: references/missing.md",
		);
	});
});
