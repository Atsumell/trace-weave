# Examples

English version: [README.md](./README.md)

この examples は、リポジトリを clone した状態からそのまま実行する想定です。

## 事前準備

subpath export が `dist/` を向くため、最初に依存を入れて一度 build します。

```bash
npm install
npm run build
```

## コア機能

```bash
node examples/basic-oracle.mjs
node examples/online-monitor.mjs
node examples/patterns.mjs
node examples/capture-correlation.mjs
```

- `basic-oracle.mjs`: `runOracle` による one-shot verification
- `online-monitor.mjs`: `evaluateStep`、`finalize`、`finalizeEmpty`
- `patterns.mjs`: `response`、`boundedResponse`、`between`
- `capture-correlation.mjs`: `capture` と `when` による値相関

## 連携機能

```bash
node examples/fast-check-response.mjs
npx vitest run --config examples/vitest.config.mjs
node examples/ai-report.mjs
```

- `fast-check-response.mjs`: `traceProperty` の成功ケースと失敗サンプル
- `vitest-response.test.mjs`: `toSatisfy` と `toViolate`
- `ai-report.mjs`: violation report の整形

背景説明は [Getting Started 日本語版](../docs/getting-started.ja.md) と [Docs Index 日本語版](../docs/README.ja.md) を参照してください。
