# trace-weave

Japanese version: [README.ja.md](./README.ja.md)

Finite-trace temporal test oracle framework based on LTLf for TypeScript.

`trace-weave` lets you describe temporal properties over event traces and verify them against finite executions. It is designed for cases where single-step assertions are too weak, such as request/response ordering, bounded eventuality, and value correlation across events.

Runnable repository examples live in [examples/README.md](./examples/README.md). The full guide map is in [docs/README.md](./docs/README.md).
The AI-agent install guide is in [docs/skills.md](./docs/skills.md).

## Requirements

- Node.js 20 or later
- ESM-only package

## Node Support Policy

- `trace-weave` `0.x` supports Node.js 20 or later.
- Node.js 20 support remains in place through the upstream Node.js 20 end-of-life date, April 30, 2026.
- After April 30, 2026, a later release may raise the minimum supported version to Node.js 22 or later. Any such change will be called out in the release notes.

## Installation

```bash
npm install trace-weave
```

Optional peer dependencies:

```bash
npm install fast-check vitest
```

## Quick Example

```ts
import { predicate, always, implies, eventually } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import { runOracle } from "trace-weave/monitor";

type AppEvent = { type: string };

const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");

const formula = always(
  implies(predicate(isRequest), eventually(predicate(isResponse))),
);

const result = runOracle(
  formula,
  {
    predicates: {
      [isRequest]: (event) => event.type === "request",
      [isResponse]: (event) => event.type === "response",
    },
    selectors: {},
  },
  [{ type: "request" }, { type: "response" }],
);

console.log(result.verdict); // "satisfied"
```

## Modules

- `trace-weave/core`: IDs, types, verdict algebra, runtime interfaces
- `trace-weave/builder`: temporal formula builders
- `trace-weave/compiler`: compile, validate, and print formula documents
- `trace-weave/monitor`: batch and online evaluation
- `trace-weave/patterns`: higher-level temporal patterns
- `trace-weave/fast-check`: property-based testing helpers
- `trace-weave/vitest`: custom matchers
- `trace-weave/ai`: report formatting and AI-oriented helpers

## Development

```bash
npm run lint
npm run skills:validate
npm run typecheck
npm test
npm run build
npm run pack:smoke
```

## Documentation

- [Docs Index](./docs/README.md)
- [Getting Started](./docs/getting-started.md)
- [Examples](./examples/README.md)
- [AI Skill](./docs/skills.md)
- [Formulas](./docs/formulas.md)
- [Monitor](./docs/monitor.md)
- [Patterns](./docs/patterns.md)
- [Capture](./docs/capture.md)
- [fast-check Integration](./docs/fast-check.md)
- [Vitest Integration](./docs/vitest.md)
- [AI Integration](./docs/ai-integration.md)
- [API Reference](./docs/api-reference.md)

## License

MIT
