# dx — Reactive Component Primitive

`dx` wraps an adax-core subscription into a safe, restartable reactive process with a deterministic lifecycle. It is the only primitive you need to connect state management to any side-effecting environment.

**Runtime environments:** Browser · Node.js · Cloudflare Durable Objects  
**Dependencies:** adax-core  
**Bundle impact:** negligible

---

## Mental model

```
dx instance = one queryFn subscription + one lifecycle owner + one run function
```

`on()` activates the component: subscribes to the query, runs once unconditionally, then receives live notifications on every relevant `trigger()`.  
`off()` deactivates it: stops notifications, tears down resources.  
Everything observable must go through `run`.

---

## API

```ts
const component = dx<TQueryFn>(config)
const { on, off } = component.claim()

on()   // activate
off()  // deactivate
```

### `dx<TQueryFn extends AnyQueryFn>(config)`

Generic over a single type parameter — the **query function type** itself:

- `TQueryFn` — the full type of `queryFn`. From this, `dx` infers:
  - `Parameters<TQueryFn>[0]` — the params shape, which `init` must satisfy.
  - `ReturnType<TQueryFn>` — the result type; `result.data` inside `run` is typed as this.

This single-type-parameter design means you only ever pass in the `queryFn` type and everything else is derived automatically.

Returns `{ claim }`.

### `claim()`

Transfers ownership of `on`/`off` to exactly one caller. A second `claim()` throws synchronously. This enforces the single-owner invariant at runtime rather than by convention. There is no unclaim — ownership is permanent.

---

## Config reference

```ts
interface DxConfig<TQueryFn extends AnyQueryFn> {
  init:            DxInit & Parameters<TQueryFn>[0]  // required
  queryFn:         TQueryFn                          // required
  run:             RunFn<TQueryFn>                   // required
  notify:          (event: string, payload: unknown) => void  // required
  beforeOn?:       LifecycleHook          // sync only — defaults to no-op
  beforeOff?:      LifecycleHook          // sync only — defaults to no-op
  onBeforeOnFail?: LifecycleHook
  queryOptions?:   QueryOptions           // defaults to {}
  stores?:         { kernel: KernelStore }
  __dev__?:        boolean
}
```

### `init: DxInit & Parameters<TQueryFn>[0]`

`init` serves two purposes simultaneously:

1. **Lifecycle context** — passed as-is to `run`, `beforeOn`, `beforeOff`, `onBeforeOnFail`.
2. **Query params** — passed as `paramsObj` to `queryFn` on every adax-core evaluation.

`init` is set once at creation and never mutated by `dx`. Every field on `init` — including `dxId` and all domain fields — flows through to `queryFn` as its first argument on every evaluation. Ensure your `queryFn` signature matches the full `init` shape, or explicitly ignores extra fields.

```ts
const component = dx<typeof getUserData>({
  init:    { dxId: "user-panel", userId: 42 },
  queryFn: ({ userId }) => getUserData(userId),  // init is the params
  ...
})
```

`DxInit` requires:
```ts
interface DxInit {
  readonly dxId: string;
  [key: string]: unknown;  // arbitrary domain fields
}
```

### `queryFn: TQueryFn`

Pure read function. Evaluated once at subscribe time (unless `skipInitialQuerying` is set) and on every relevant `trigger()`. Must be the same reference across activations for adax-core to track it correctly.

### `run: RunFn<TQueryFn>`

Called once unconditionally on activation, then on every adax-core notification. The only place to put observable side effects.

```ts
type RunFn<TQueryFn extends AnyQueryFn> = (
  init:   DxInit & Parameters<TQueryFn>[0],
  result: {
    data:           ReturnType<TQueryFn>;
    prevData:       ReturnType<TQueryFn>;
    version:        number;
    writeFn?:       (x: unknown) => void;
    writeParamsObj: unknown;
  },
  ctx: RunContext
) => void | Promise<void> | unknown;
```

`run` may be async. See [Async safety](#async-safety) below.

Errors from `run` — both synchronous throws and rejected Promises — are caught and routed to `notify("ERROR", { error, componentId: init.dxId })`. The lifecycle remains active after a `run` error.

### `notify: (event, payload) => void`

All errors from all user-code boundaries route here as `notify("ERROR", { error, componentId: init.dxId })`. `notify` is called directly — if it throws, the error propagates. Provide a working implementation.

### `stores?: { kernel: KernelStore }`

Passes an alternative adax-core `KernelStore` to use for subscription registration. Domain stores (your app state) do **not** go here — they belong as default parameters in your `queryFn` and `writeFn`. This is exclusively for adax-core kernel configuration.

### `beforeOn` / `beforeOff`

Synchronous setup and teardown hooks. Both default to no-ops if omitted.

- `beforeOn` is called before `subscribe()` during activation.
- `beforeOff` is called after `sub.off()` and `sub = null` during deactivation.

**Must be synchronous.** Returning a `Promise` is detected at runtime and treated as a throw — activation/deactivation emits `notify("ERROR", ...)`. Move all async work into `run`.

Canonical use: `AbortController` setup/teardown, event listener attach/detach, flag initialization.

### `onBeforeOnFail`

Called synchronously if `beforeOn` throws, as a best-effort rollback. If `onBeforeOnFail` itself throws, a second `notify("ERROR", ...)` is emitted. Activation always aborts after any `beforeOn` failure regardless.

**Not called if `subscribe()` throws** — `onBeforeOnFail` is the rollback for `beforeOn` failures only. Any `beforeOn` side effects must be safe to leave in place if `subscribe()` subsequently fails.

### `queryOptions`

Passed to adax-core's `subscribe`. `cmpId` is always overridden with `init.dxId` — any `cmpId` you provide is silently replaced.

```ts
type QueryOptions = {
  hasResultChanged?:    (prev: unknown, next: unknown) => boolean
  debounceMs?:          number   // mutually exclusive with throttleMs
  throttleMs?:          number   // mutually exclusive with debounceMs
  skipInitialQuerying?: boolean
}
```

`debounceMs` and `throttleMs` are mutually exclusive. Providing both causes `subscribe()` to throw, which `dx` catches and routes to `notify("ERROR", ...)`.

### `__dev__`

Enables DEV-mode warnings. Resolution order:
1. Explicit `__dev__: true | false` — always wins.
2. Node.js: reads `process.env.NODE_ENV === "development"`.
3. All other environments (Browser, Durable Objects): defaults to `false`.

Pass `__dev__: true` explicitly in non-Node environments where you want warnings.

---

## `RunContext`

```ts
type RunContext = {
  runIndex:            number
  executionToken:      number
  runToken:            number
  isLatestRun:         () => boolean
  isActiveExecution:   () => boolean
}
```

`runIndex` — resets to `0` on every `on()` call. Safe for "is this the first run of this activation?" checks (`ctx.runIndex === 0`). Do not use for cross-activation logic or "first run ever" logic. In ephemeral environments (Cloudflare Durable Objects) the instance may be reconstructed, resetting `runIndex` independently of your application state.

`runToken` — monotonically increasing across the entire lifetime of the `dx` instance, including across multiple activations. Never resets. Use for cross-run coordination if needed.

`executionToken` — increments on every lifecycle transition (`on()`/`off()`). Used internally by `isActiveExecution`.

`isLatestRun()` — returns `false` if a newer run has started within the same active period.

`isActiveExecution()` — returns `false` if a lifecycle transition has occurred since this run started.

---

## Async safety

After every `await` that precedes a side effect, check both guards:

```ts
run: async (init, result, ctx) => {
  const data = await fetchSomething()
  if (!ctx.isLatestRun() || !ctx.isActiveExecution()) return

  const more = await fetchMore(data)
  if (!ctx.isLatestRun() || !ctx.isActiveExecution()) return

  applyUpdate(more) // safe
}
```

**Why both?**

- `isLatestRun()` alone misses lifecycle boundary crossings (`off`/`on`) when no new run has fired yet in the new period.
- `isActiveExecution()` alone misses a newer run within the same active period.
- Neither is sufficient in the general case. Always check both.

Side effects before the first `await` cannot be guarded — make them unconditionally safe.

---

## Lifecycle order

### Activation (`on()`)

1. Sets `desiredState = "active"`, calls `reconcile()`
2. Checks `dxId` uniqueness — ERROR + reset `desiredState` + abort if already active elsewhere
3. `executionToken++`
4. Reset `runIndexSinceActivation = 0`, `droppedRunCount = 0`
5. `beforeOn(init)` — throws or returns Promise → ERROR + `onBeforeOnFail` + reset `desiredState` + abort
6. `subscribe(...)` — throws → ERROR + reset `desiredState` + abort (`beforeOff` never called)
7. Register `dxId` in active registry; `actualState = "active"`
8. `run(init, sub.result, ctx)` — unconditional initial run
9. `sub.on()` — live notifications begin
10. `transitioning = false`; reconcile

### Deactivation (`off()`)

1. Sets `desiredState = "inactive"`, calls `reconcile()`
2. `executionToken++`
3. `actualState = "inactive"` — late callbacks are discarded from here
4. `sub.off()`; `sub = null`
5. Release `dxId` from active registry
6. `beforeOff(init)` — throws or returns Promise → ERROR (deactivation still completes fully)
7. `transitioning = false`; reconcile

### Reconciler

`desiredState` and `actualState` are separate. `on()`/`off()` update `desiredState` immediately. A mutex (`transitioning`) ensures only one transition runs at a time. On every transition end, reconcile re-checks whether another transition is needed. The system always converges to the last expressed intent.

Because all transitions are synchronous, calling `on()` then `off()` then `on()` in sequence produces two complete activations and one deactivation — each call fully completes before the next begins.

---

## Error model

All errors from all user-code boundaries route to `notify("ERROR", { error, componentId: init.dxId })`. This covers `beforeOn`, `onBeforeOnFail`, `beforeOff`, and both sync and async throws from `run`. The lifecycle always completes — errors are never fatal to the `dx` machinery itself.

`notify` is called directly. If it throws, the error propagates outward. Provide a working `notify`.

---

## dxId conventions

- Must be a globally unique string across all **concurrently active** `dx` instances.
- Used as the adax-core `cmpId` — two active instances with the same `dxId` would silently overwrite each other's subscription in adax-core's internal registry.
- `dx` enforces uniqueness at runtime: activating a second instance while one with the same `dxId` is already active emits `notify("ERROR", ...)`, resets `desiredState` to `"inactive"`, and aborts.
- The `dxId` slot is released when the instance deactivates (`activeDxIds.delete(init.dxId)` during `deactivate()`). A new instance with the same `dxId` may then activate freely.
- Two **inactive** instances sharing a `dxId` are fine — the collision check only fires on activation.

---

## DEV mode warnings

| Warning | Trigger |
|---|---|
| Re-entrant run | `trigger()` called synchronously inside `run()` while `isRunning` is true |
| Late callback discarded | adax-core callback arrives after `actualState = "inactive"` |

Late callback warning is sampled: fires on the first occurrence and every 100th thereafter (`droppedRunCount === 1 || droppedRunCount % 100 === 0`). The counter resets on each new activation.

---

## Gotchas

**Do not call `trigger()` inside the initial `run()` or inside `beforeOn()`.**  
Between `subscribe()` and `sub.on()` there is a gap where the subscription is registered but not mounted. Any `trigger()` that fires in this window produces a notification that adax-core drops silently because the subscription is not yet active. `dx` is not designed for this scenario.

**`beforeOn` and `beforeOff` must be synchronous.**  
Returning a Promise is a runtime error caught and sent to `notify("ERROR", ...)`. All async work belongs in `run`, which has the full `ctx` guard infrastructure. Both hooks default to no-ops — you do not need to provide them.

**`init` is the `queryFn` params object.**  
Every field on `init` — including `dxId` and all domain fields — is passed to `queryFn` as its first argument on every evaluation. Ensure your `queryFn` signature matches the full `init` shape, or ignores extra fields explicitly.

**`runIndex` resets on every activation.**  
`ctx.runIndex === 0` safely identifies the first run of the current activation. It does not mean "first run ever". In ephemeral environments (Cloudflare Durable Objects), the instance may be reconstructed, resetting `runIndex` independently of your application state.

**`runToken` never resets.**  
`ctx.runToken` is monotonically increasing across the entire lifetime of the `dx` instance, including across multiple activations. Use it for cross-run coordination if needed.

**`onBeforeOnFail` is not called if `subscribe()` throws.**  
`onBeforeOnFail` is the rollback hook for `beforeOn` failures only. If `subscribe()` throws (e.g. both `debounceMs` and `throttleMs` set), `beforeOff` is also never called. Any `beforeOn` side effects must be safe to leave in place regardless.

**`claim()` transfers ownership permanently.**  
A second `claim()` on the same instance throws synchronously. There is no unclaim. If you need to hand off lifecycle control, do so before calling `claim()`.

**`cmpId` in `queryOptions` is always overridden.**  
`dx` forces `cmpId = init.dxId` in every `subscribe()` call. Any `cmpId` you provide in `queryOptions` is silently replaced.

**`stores` is for the adax-core kernel only.**  
Do not place domain state stores in `stores`. They belong as default parameter values in your `queryFn` and `writeFn` definitions.

---

## Canonical patterns

### Minimal synchronous component

```ts
const counter = dx<typeof getCount>({
  init:    { dxId: "counter" },
  queryFn: (_params, stores = { appState }) => stores.appState.count,
  run:     (_init, result) => {
    renderCount(result.data)
  },
  notify:  (event, payload) => console.error(event, payload),
})

const { on, off } = counter.claim()
on()
// later:
off()
```

### Async fetch with cancellation

```ts
let controller: AbortController

const userPanel = dx<typeof getUserFromStore>({
  init:      { dxId: "user-panel", userId: 42 },
  queryFn:   ({ userId }) => getUserFromStore(userId),
  notify:    (event, payload) => console.error(event, payload),

  beforeOn:  () => { controller = new AbortController() },
  beforeOff: () => { controller.abort() },

  run: async (init, result, ctx) => {
    let res: Response
    try {
      res = await fetch(`/api/user/${result.data.id}`, { signal: controller.signal })
    } catch {
      return // aborted — exit cleanly
    }
    if (!ctx.isLatestRun() || !ctx.isActiveExecution()) return
    applyUserData(await res.json())
  },
})

const { on, off } = userPanel.claim()
on()
```

### First-run initialization

```ts
run: (init, result, ctx) => {
  if (ctx.runIndex === 0) {
    // Runs once per activation — safe for per-activation setup
    initializeLayout()
  }
  renderData(result.data)
}
```

### Multiple parameterized instances

```ts
// Same queryFn, different init params — fully isolated subscriptions
const panelA = dx<typeof getTeamData>({
  init:    { dxId: "panel-team-a", teamId: "a" },
  queryFn: ({ teamId }) => getTeamData(teamId),
  run:     (_init, result) => { renderTeam(result.data) },
  notify:  errorHandler,
})

const panelB = dx<typeof getTeamData>({
  init:    { dxId: "panel-team-b", teamId: "b" },
  queryFn: ({ teamId }) => getTeamData(teamId),
  run:     (_init, result) => { renderTeam(result.data) },
  notify:  errorHandler,
})

const { on: onA, off: offA } = panelA.claim()
const { on: onB, off: offB } = panelB.claim()
onA(); onB()
```

---

## Behavior reference

| Scenario | Behavior |
|---|---|
| `on()` while already active | No-op (reconciler: `desiredState === actualState`) |
| `off()` while already inactive | No-op (reconciler: `desiredState === actualState`) |
| `on()` called twice in sequence | Two full activations — each completes synchronously |
| `beforeOn` throws | ERROR emitted · `onBeforeOnFail` called · `desiredState` reset · activation aborts |
| `subscribe()` throws | ERROR emitted · `desiredState` reset · activation aborts · `beforeOff` never called |
| `beforeOff` throws | ERROR emitted · deactivation still completes fully |
| `run` throws synchronously | ERROR emitted · lifecycle remains active |
| `run` returns rejected Promise | ERROR emitted asynchronously · lifecycle remains active |
| Late adax-core callback after `off()` | Silently discarded (`actualState` guard); DEV warning emitted (sampled) |
| `dxId` collision on activation | ERROR emitted · `desiredState` reset · activation aborts |
| Async `beforeOn` or `beforeOff` | Detected at runtime · treated as throw · ERROR emitted |
| Second `claim()` | Throws synchronously |
| `notify` throws | Propagates — provide a working `notify` |
| `cmpId` set in `queryOptions` | Silently overridden with `init.dxId` |