# trace-weave Implementation

## Phase 1: Project Setup
- [x] package.json with subpath exports
- [x] tsconfig.json (ESM, strict)
- [x] tsup.config.ts (multi-entry)
- [x] vitest.config.ts
- [x] biome.json
- [x] Directory structure

## Phase 2: Core Types (`src/core/`)
- [x] verdict.ts
- [x] ids.ts
- [x] meta.ts
- [x] values.ts
- [x] formula-expr.ts
- [x] formula-node.ts
- [x] formula-document.ts
- [x] runtime.ts

## Phase 3: Builder API (`src/builder/`)
- [x] factory.ts

## Phase 4: Compiler (`src/compiler/`)
- [x] hash.ts
- [x] compile.ts
- [x] prepare.ts
- [x] validate.ts
- [x] printer.ts

## Phase 5: Online Monitor (`src/monitor/`)
- [x] types.ts
- [x] env.ts
- [x] schedule.ts
- [x] recompute.ts (incremental — kept for future optimization)
- [x] materialize.ts
- [x] sweep.ts
- [x] evaluate-step.ts (incremental — kept for future optimization)
- [x] create.ts
- [x] finalize.ts
- [x] report.ts
- [x] evaluate.ts (direct recursive evaluator — primary)
- [x] run-oracle.ts

## Phase 6: Pattern API (`src/patterns/`)
- [x] patterns.ts
- [x] scoped.ts

## Phase 7: fast-check Integration (`src/fast-check/`)
- [x] trace-arbitrary.ts
- [x] command-adapter.ts
- [x] properties.ts

## Phase 8: vitest Matchers (`src/vitest/`)
- [x] matchers.ts
- [x] setup.ts

## Phase 9: AI Module (`src/ai/`)
- [x] schema.ts
- [x] metadata.ts
- [x] format-report.ts

## Phase 10: Documentation (`docs/`)
- [x] getting-started.md
- [x] patterns.md
- [x] formulas.md
- [x] monitor.md
- [x] capture.md
- [x] fast-check.md
- [x] vitest.md
- [x] ai-integration.md
- [x] api-reference.md

## Phase 11: Testing
- [x] Unit tests per module (verdict, builder, hash, compile, validate, printer)
- [x] End-of-trace semantics (next→violated, weakNext→satisfied, etc.)
- [x] Bounded operator tests
- [x] Pattern integration tests
- [x] Property-based meta-tests (duality, idempotence, boolean simplification)

## Verification
- [x] `npx tsc --noEmit` — clean
- [x] `npx vitest run` — 112 tests, all passing
- [x] `npx tsup` — builds without errors
- [x] `npx biome check .` — lint clean
- [x] Codex critical review of evaluate.ts — bugs fixed

## Review Notes
- Direct recursive evaluator used for correctness (evaluate.ts)
- Incremental DAG evaluator code kept for future optimization
- Codex identified: falsy event check, withinSteps bounds, past operator edge cases, missing validation → all fixed
- withinMs: implemented with `MonitorRuntime.timestamp` and monotonic timestamp validation

## Next Tasks (Prioritized)

### P0: Correctness Confidence for Public APIs
- [x] Add online monitor parity tests: compare `createMonitor` + `evaluateStep` + `finalize` against `runOracle` on the same traces.
- [x] Add direct tests for currently untested public modules: `src/ai/*`, `src/fast-check/*`, and `src/vitest/*`.
- [x] Add regression tests for `capture` / `when` value-correlation flows in both batch and online evaluation.

### P1: Close Public API Gaps
- [x] Decide the status of `withinMs`: either implement timestamp-based evaluation or explicitly mark it experimental / unsupported in the exported API.
- [x] If `withinMs` stays public, add runtime shape requirements for timestamps and full test coverage for success, timeout, and end-of-trace cases.
- [x] Document limitations of the incremental monitor more explicitly if batch evaluation remains the correctness baseline.

### P1: Release Readiness
- [x] Add CI for `npm test`, `npm run build`, and `npm run lint`.
- [x] Add `typecheck` script (`tsc --noEmit`) and run it in CI.
- [x] Validate the publish artifact with `npm pack` and a smoke-test consumer import.

### P2: Developer Experience
- [ ] Add executable examples covering `patterns`, `fast-check`, `vitest`, and AI report formatting.
- [ ] Expand API docs with “recommended entrypoint” guidance: `runOracle` for correctness, online monitor for incremental use.
- [ ] Consider benchmark tasks to measure the direct evaluator against the retained incremental code.
