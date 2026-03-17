# Examples

Japanese version: [README.ja.md](./README.ja.md)

These examples are meant to be run from the repository checkout.

## Prerequisites

Install dependencies and build the package once so the subpath exports resolve from `dist/`:

```bash
npm install
npm run build
```

## Core Flows

```bash
node examples/basic-oracle.mjs
node examples/online-monitor.mjs
node examples/patterns.mjs
node examples/capture-correlation.mjs
```

- `basic-oracle.mjs`: one-shot verification with `runOracle`
- `online-monitor.mjs`: incremental monitoring with `evaluateStep`, `finalize`, and `finalizeEmpty`
- `patterns.mjs`: common pattern helpers such as `response`, `boundedResponse`, and `between`
- `capture-correlation.mjs`: value correlation with `capture` and `when`

## Integrations

```bash
node examples/fast-check-response.mjs
npx vitest run --config examples/vitest.config.mjs
node examples/ai-report.mjs
```

- `fast-check-response.mjs`: `traceProperty` with a passing property and an expected failing sample
- `vitest-response.test.mjs`: `toSatisfy` and `toViolate` matchers
- `ai-report.mjs`: `formatReport` output for a violation

For conceptual background, start with [Getting Started](../docs/getting-started.md) and then jump to the matching guide in [Docs Index](../docs/README.md).
