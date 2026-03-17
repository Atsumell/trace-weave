# AI Skill

Japanese version: [skills.ja.md](./skills.ja.md)

`trace-weave` ships an installable skill for AI coding agents that need to turn temporal requirements into tests.

## What It Does

The canonical skill is:

- `skills/trace-weave-test-author/`

It guides the agent to:

- choose `patterns` before raw builder operators
- default to `runOracle` for one-shot tests
- use `capture` and `when` for value correlation
- use the online monitor only for incremental or streaming scenarios
- surface `report` and `formatReport` when diagnostics are useful

## Install with Existing Installers

The primary install path is an existing cross-agent installer:

```bash
npx skills add https://github.com/Atsumell/trace-weave/tree/main/skills/trace-weave-test-author -a codex -a claude-code -y
```

In a project checkout, this installer places the skill under `./.agents/skills/` and links the target agents to that shared copy.

Add `-g` for a global install:

```bash
npx skills add https://github.com/Atsumell/trace-weave/tree/main/skills/trace-weave-test-author -a codex -a claude-code -g -y
```

From a local checkout, you can validate the same flow without GitHub:

```bash
npx skills add ./skills/trace-weave-test-author -a codex -a claude-code -y
```

## Codex Built-In Installer

Inside Codex, you can also install from the GitHub skill directory:

```text
$skill-installer install https://github.com/Atsumell/trace-weave/tree/main/skills/trace-weave-test-author
```

Restart Codex after installation so the skill is reloaded.

## Manual Install

Project-local install:

```bash
mkdir -p .codex/skills/trace-weave-test-author .claude/skills/trace-weave-test-author
cp -R skills/trace-weave-test-author/. .codex/skills/trace-weave-test-author/
cp -R skills/trace-weave-test-author/. .claude/skills/trace-weave-test-author/
```

Global install:

```bash
mkdir -p ~/.codex/skills/trace-weave-test-author ~/.claude/skills/trace-weave-test-author
cp -R skills/trace-weave-test-author/. ~/.codex/skills/trace-weave-test-author/
cp -R skills/trace-weave-test-author/. ~/.claude/skills/trace-weave-test-author/
```

## Versioning and Validation

Skill metadata lives in `skills/trace-weave-test-author/skill.json`.

- `version`: skill version
- `traceWeaveCompatibility`: supported package range
- `targetAgents`: currently `codex` and `claude-code`
- `language`: canonical skill language
- `companionDocs`: localized install documentation

Validate the skill before release:

```bash
npm run skills:validate
```

This checks required files, metadata, frontmatter, and referenced documentation.
