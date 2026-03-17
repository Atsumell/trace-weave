---
name: trace-weave-test-author
description: Generate trace-weave tests from temporal requirements over event traces, using patterns first and runOracle by default.
---

# trace-weave Test Author

Use this skill when the task is to turn a temporal requirement into tests for `trace-weave`.

## Workflow

1. Restate the requirement in trace terms: event types, ordering rule, value correlation, and time or step bounds.
2. Choose the smallest abstraction that fits:
   - Start with `trace-weave/patterns`
   - Drop to raw builder operators only if no pattern fits
   - Use `capture` and `when` for value correlation
   - Use `withinSteps` or `withinMs` for deadlines
3. Default to `runOracle` for one-shot tests.
4. Use the online monitor only when the requirement is explicitly incremental or streaming. Finalize with `finalize` or `finalizeEmpty`.
5. Build the runtime from the event shape:
   - predicates for event classification
   - selectors only when the formula reads values
   - timestamp only when `withinMs` is used
6. Prefer Vitest-style tests unless the repository uses another runner.
7. When diagnostics matter, surface `report` or `formatReport` output.

## Output Rules

- Prefer `patterns` over hand-built formulas.
- Emit one satisfied trace and one violated trace when adding new tests.
- Keep formula explanations short and name the temporal rule in plain language.
- Do not choose the online monitor for ordinary unit tests.

## References

- [Pattern selection](references/pattern-selection.md)
- [Runtime contracts](references/runtime-contracts.md)
- [Test templates](references/test-templates.md)
- [Diagnostics](references/diagnostics.md)
