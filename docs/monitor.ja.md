# Monitor and Evaluation

English version: [monitor.md](./monitor.md)

`@atsumell/trace-weave/monitor` は、有限長トレースに対する評価器です。正しさ重視なら `runOracle`、増分連携が必要なら online monitor を使います。

実行可能な example: [../examples/basic-oracle.mjs](../examples/basic-oracle.mjs), [../examples/online-monitor.mjs](../examples/online-monitor.mjs)

```typescript
import {
  evaluateFormula, runOracle,
  createMonitor, evaluateStep, finalize, finalizeEmpty, buildReport,
} from "@atsumell/trace-weave/monitor";
```

## Verdict の 3 値

| Verdict       | 意味 |
|---------------|------|
| `"satisfied"` | 現在の有限 trace に対して式が成立している |
| `"violated"`  | 現在の有限 trace に対して式が不成立である |
| `"pending"`   | 現時点では確定できず、追加イベントが必要 |

## Batch Evaluation

`evaluateFormula` は compile 済み `FormulaDocument`、`MonitorRuntime`、完全な trace を受け取り、式木全体を再帰的に評価します。最も単純で、完全な trace がある場合の基本 API です。

`withinMs` を使う場合は `MonitorRuntime.timestamp` が必要です。返す値は有限で、trace に沿って非減少でなければなりません。

## runOracle

`runOracle` は最も使いやすい入口です。未 compile の `FormulaExpr` を受け取り、compile と評価をまとめて行って以下を返します。

```typescript
interface OracleRunResult {
  readonly verdict: Verdict;
  readonly steps: number;
  readonly report: CounterexampleReport | null;
}
```

`verdict === "violated"` のときは `report` に failure path、trace slice、summary が入ります。テストコードからは通常この API を使うのが自然です。

### Root Position Semantics

batch 評価は root node の position `0` から始まります。したがって bare predicate や non-temporal な部分式は、常に「現在位置だけ」に対する主張です。

```typescript
runOracle(predicate(isError), runtime, trace);
// trace[0] だけを確認する

runOracle(eventually(predicate(isError)), runtime, trace);
// どこかの position で isError が成り立つかを確認する
```

## Online Monitoring

streaming や長寿命プロセス向けに、増分評価 API もあります。

```typescript
import { compile, prepare } from "@atsumell/trace-weave/compiler";
import { createMonitor, evaluateStep, finalize, finalizeEmpty } from "@atsumell/trace-weave/monitor";

const compiled = prepare(compile(formula));
const monitor = createMonitor(compiled, runtime);
```

### evaluateStep

`evaluateStep` は観測済み prefix に対する verdict を返します。`always`、`eventually`、`until`、`weakNext` などの future operator は、証拠が揃うか trace が閉じるまで `"pending"` のまま残ることがあります。

`MonitorState` は online API 用の opaque handle として扱ってください。安定して参照してよいのは `trace`、`step`、`currentVerdict`、`finalized` で、内部キャッシュの詳細は公開契約に含めません。

### finalize と finalizeEmpty

trace が終わったら `finalize(monitor, lastEvent)` を呼びます。これは完全 trace に対する最終 verdict を batch evaluator と同じ semantics で解決します。

真に空の trace を評価したい場合は `finalizeEmpty(monitor)` を使います。`finalize()` は後方互換のため、空 monitor に対して呼ばれた場合でも `lastEvent` から 1 要素 trace を materialize します。

### Async Test Harness の注意点

trace-weave 自体の record / evaluation は同期的です。一方で、subscription、microtask、actor、hook、timer callback 経由で trace を流し込む harness では、その scheduler を flush してから assertion してください。

- 実 timer や promise ベースの処理では、イベント配送を行う microtask や framework の tick を待ってから `runOracle`、`finalize`、`toSatisfy` を呼ぶ
- fake timer では、まず timer を進め、その callback が積んだ microtask を flush してから assertion する
- recorder / monitor は同期 sink と考え、非同期境界は harness 側で制御する

Vitest では次の順序が基本です。

```typescript
await vi.runAllTimersAsync();
await Promise.resolve();
```

## Trace End Semantics

| Operator     | trace 中 | trace end |
|--------------|----------|-----------|
| `always`     | pending  | satisfied |
| `eventually` | pending  | violated  |
| `next`       | pending  | violated  |
| `weakNext`   | pending  | satisfied |
| `until`      | pending  | 最終位置で右辺を確認 |
| `release`    | pending  | 最終位置で右辺を確認 |
| `withinSteps`| pending  | 未達なら violated |
| `withinMs`   | pending  | 窓内未達なら violated |

## 使い分け

- `runOracle`: テスト、one-shot verification、最終 verdict が欲しいとき
- `evaluateFormula`: compile 済み document を直接評価したいとき
- online monitor: イベントを増分処理したいとき

通常のテストでは `runOracle` を優先し、online monitor は integration 用と考えると扱いやすいです。
