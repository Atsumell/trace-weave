# trace-weave

Finite-trace temporal test oracle framework based on LTLf for TypeScript.

`trace-weave` lets you describe temporal properties over event traces and verify them against finite executions. It is designed for cases where single-step assertions are too weak, such as request/response ordering, bounded eventuality, and value correlation across events.

## Requirements

- Node.js 20 or later
- ESM-only package

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
npm run typecheck
npm test
npm run build
npm run pack:smoke
```

## Documentation

- `docs/getting-started.md`
- `docs/formulas.md`
- `docs/monitor.md`
- `docs/api-reference.md`

## License

MIT
