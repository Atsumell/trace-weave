# trace-weave Lessons Learned

## Monitor Design
- **Incremental DAG evaluator failed for LTLf**: `succOr` eagerly resolved pending verdicts, causing always/eventually to terminate early. Direct recursive evaluator on the complete trace is correct by construction.
- **Keep incremental code for future**: The DAG evaluator could be optimized later, but correctness must come first.

## LTLf Semantics
- **Falsy event trap**: Never use `!event` to check trace bounds. TEvent can be 0, false, "", null. Always use `pos >= len`.
- **withinSteps is exclusive**: `withinSteps(n, p)` checks [pos, pos+n), NOT [pos, pos+n].
- **Empty trace edge cases**: `always(p)` on empty = satisfied (vacuous), `eventually(p)` on empty = violated (no witness).
- **Past operators need bounds**: `once`, `historically`, `since` must handle `pos >= len` explicitly.

## Codex Collaboration
- Codex review caught 5 real bugs in evaluate.ts that tests didn't cover (falsy event, past operator bounds, missing validation).
- Architecture consultation upfront (activation model, sweep approach) was valuable even though we pivoted to a simpler evaluator.

## Testing
- Property-based tests (duality, idempotence) are effective for verifying LTLf laws across random traces.
- 112 tests total: unit + integration + property-based provides good coverage.

## TypeScript/Tooling
- `structuredClone` not available in all TS lib targets — use `JSON.parse(JSON.stringify(...))`.
- vitest module augmentation: use `CustomMatchers<R>`, not `Assertion<T>` (changed in recent vitest versions).
- Biome: disable `noNonNullAssertion` and `noExplicitAny` for pragmatic TS development.
