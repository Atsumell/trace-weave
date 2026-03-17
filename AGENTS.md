# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the published TypeScript modules: `core`, `builder`, `compiler`, `monitor`, `patterns`, `fast-check`, `vitest`, and `ai`. Keep public entrypoints in each module’s `index.ts`. `tests/` mirrors the source layout with Vitest specs such as `tests/compiler/compile.test.ts`. `docs/` holds user-facing package documentation, and `tasks/` stores lightweight project notes like [`tasks/todo.md`](/Users/rizumita/Workspace/Atsumell/trace-weave/tasks/todo.md). `dist/` is generated output from `tsup`; do not hand-edit it.

## Build, Test, and Development Commands
Use Node.js 20+.

- `npm run build`: bundle all exported modules to `dist/` with declaration files.
- `npm test`: run the full Vitest suite once.
- `npm run test:watch`: run tests in watch mode during development.
- `npm run lint`: run Biome checks across the repository.
- `npm run lint:fix`: apply safe Biome fixes.
- `npm run format`: format source, tests, and docs with Biome.

## Coding Style & Naming Conventions
This repository uses strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Follow the existing module pattern: kebab-case file names (`format-report.ts`, `run-oracle.ts`), named exports, and small focused files. Biome is the formatter and linter; indentation is tabs and the target line width is 100. Prefer explicit types at public boundaries and keep generated artifacts out of manual edits.

## Testing Guidelines
Vitest discovers `tests/**/*.test.ts`. Add new tests beside the matching module area, for example `tests/monitor/*.test.ts` for `src/monitor/*`. Cover both nominal behavior and edge cases for temporal logic evaluation, compilation, and report generation. Run `npm test` before opening a PR; use `npm run test:watch` when iterating on failures.

## Commit & Pull Request Guidelines
Git history is not available in this workspace snapshot, so no repository-specific commit convention could be verified. Use short, imperative commit subjects and keep each commit focused, for example `compiler: validate duplicate ids`. PRs should explain the behavioral change, list affected modules, mention test coverage, and link the related issue or task. Include doc updates in `docs/` when public APIs or workflows change.

## Contributor Notes
Treat `dist/` as build output. When adding a new public surface, update `package.json` exports, `tsup.config.ts` entries, tests, and the relevant document in `docs/`.
