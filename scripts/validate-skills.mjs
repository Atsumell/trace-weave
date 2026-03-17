import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function parseFrontmatter(markdown) {
	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		return {};
	}

	const result = {};
	for (const line of match[1].split(/\r?\n/)) {
		const frontmatterMatch = line.match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.+)$/);
		if (!frontmatterMatch) {
			continue;
		}

		const [, key, rawValue] = frontmatterMatch;
		result[key] = rawValue.replace(/^['"]|['"]$/g, "");
	}

	return result;
}

async function pathExists(targetPath) {
	try {
		await stat(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function getSkillDirectories(skillsRoot) {
	if (!(await pathExists(skillsRoot))) {
		return [];
	}

	const entries = await readdir(skillsRoot, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(skillsRoot, entry.name));
}

export async function validateSkills(repoRoot = process.cwd()) {
	const errors = [];
	const skillsRoot = path.join(repoRoot, "skills");
	const skillDirectories = await getSkillDirectories(skillsRoot);

	if (skillDirectories.length === 0) {
		return [`No skill directories found under ${skillsRoot}`];
	}

	for (const skillDir of skillDirectories) {
		const label = path.relative(repoRoot, skillDir);
		const skillMarkdownPath = path.join(skillDir, "SKILL.md");
		const skillJsonPath = path.join(skillDir, "skill.json");

		if (!(await pathExists(skillMarkdownPath))) {
			errors.push(`${label}: missing SKILL.md`);
			continue;
		}

		if (!(await pathExists(skillJsonPath))) {
			errors.push(`${label}: missing skill.json`);
			continue;
		}

		const skillMarkdown = await readFile(skillMarkdownPath, "utf8");
		const frontmatter = parseFrontmatter(skillMarkdown);
		const skillConfig = JSON.parse(await readFile(skillJsonPath, "utf8"));

		if (typeof frontmatter.name !== "string" || frontmatter.name.length === 0) {
			errors.push(`${label}: SKILL.md frontmatter must include a non-empty name`);
		}

		if (typeof frontmatter.description !== "string" || frontmatter.description.length === 0) {
			errors.push(`${label}: SKILL.md frontmatter must include a non-empty description`);
		}

		if (frontmatter.name !== skillConfig.name) {
			errors.push(`${label}: SKILL.md name must match skill.json name`);
		}

		for (const field of [
			"name",
			"version",
			"entry",
			"targetAgents",
			"traceWeaveCompatibility",
			"language",
			"companionDocs",
			"references",
		]) {
			if (!(field in skillConfig)) {
				errors.push(`${label}: skill.json is missing "${field}"`);
			}
		}

		const entryPath = path.join(skillDir, skillConfig.entry ?? "");
		if (!(await pathExists(entryPath))) {
			errors.push(`${label}: entry file does not exist: ${skillConfig.entry}`);
		}

		if (!Array.isArray(skillConfig.targetAgents) || skillConfig.targetAgents.length === 0) {
			errors.push(`${label}: targetAgents must be a non-empty array`);
		}

		if (skillConfig.language !== "en") {
			errors.push(`${label}: language must be "en"`);
		}

		if (!Array.isArray(skillConfig.references) || skillConfig.references.length === 0) {
			errors.push(`${label}: references must be a non-empty array`);
		} else {
			for (const reference of skillConfig.references) {
				const referencePath = path.join(skillDir, reference);
				if (!(await pathExists(referencePath))) {
					errors.push(`${label}: missing reference file ${reference}`);
				}
			}
		}

		if (!Array.isArray(skillConfig.companionDocs) || skillConfig.companionDocs.length === 0) {
			errors.push(`${label}: companionDocs must be a non-empty array`);
		} else {
			for (const companion of skillConfig.companionDocs) {
				if (typeof companion?.locale !== "string" || companion.locale.length === 0) {
					errors.push(`${label}: each companion doc must include a locale`);
					continue;
				}
				if (typeof companion?.path !== "string" || companion.path.length === 0) {
					errors.push(`${label}: each companion doc must include a path`);
					continue;
				}

				const companionPath = path.resolve(skillDir, companion.path);
				if (!(await pathExists(companionPath))) {
					errors.push(`${label}: companion doc does not exist: ${companion.path}`);
				}
			}
		}

		const linkedReferences = [...skillMarkdown.matchAll(/\((references\/[^)#]+)\)/g)].map(
			(match) => match[1],
		);
		for (const linkedReference of linkedReferences) {
			const linkedReferencePath = path.join(skillDir, linkedReference);
			if (!(await pathExists(linkedReferencePath))) {
				errors.push(`${label}: linked reference does not exist: ${linkedReference}`);
			}
		}
	}

	return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const errors = await validateSkills();
	if (errors.length > 0) {
		for (const error of errors) {
			console.error(error);
		}
		process.exitCode = 1;
	} else {
		console.log("Skill validation passed.");
	}
}
