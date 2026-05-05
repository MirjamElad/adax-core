# ADAX-CORE

> The missing shared state layer for micro-frontend architectures.  
> Framework-agnostic. Runtime-agnostic. 2KB gzipped. Zero dependencies.

---

## The problem no state library solves

Every major state library — Zustand, Pinia, NgRx, Redux — makes the same silent assumption:

**one app → one framework → one state system**

That assumption breaks the moment your architecture does not.

Modern production apps are rarely one framework anymore:

- A React shell embedding a Vue widget
- An Angular app being migrated component by component to something else
- Micro-frontends built by different teams with different stacks
- Business logic shared between browser, Node.js, and edge runtimes

When that happens, your state options are:
- **postMessage** — async, error-prone, not reactive
- **Event buses** — global, untyped, impossible to trace
- **Duplicate state** — inconsistent by definition
- **Force everyone onto one framework** — politically and technically expensive

ADAX breaks the assumption entirely.

---

## What ADAX is

ADAX is a reactive state engine that lives **outside** any framework.

A React component, a Vue component, and a Vanilla JS service can all subscribe to the same ADAX state and react to the same mutations — in real time, with no glue code, no event bus, no shared bundler required.

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│ React Shell │     │  Vue Widget │     │  Vanilla JS  │
│             │     │             │     │   Service    │
└──────┬──────┘     └──────┬──────┘     └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │  ADAX CORE  │
                    │  2KB · zero │
                    │    deps     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Your     │
                    │    State    │
                    └─────────────┘
```

---

## See it in action

**Multi-framework demo** — React, Vue, and Vanilla JS sharing the same live state:  
👉 https://github.com/MirjamElad/ADAX-Vanilla-Vue-React

**React starter** — full example with rules, subscriptions, and TypeScript:  
👉 https://github.com/MirjamElad/Adax-React-TW-Exp_0

---

## Installation

```bash
npm install adax-core
```

---

## Three primitives. That is the entire API.

```typescript
import { trigger, subscribe, addRule } from 'adax-core';
```

| Primitive | What it does |
|---|---|
| `trigger(writeFn, params)` | Mutates state and notifies all relevant subscribers |
| `subscribe(callback, readFn, params?)` | Registers a reactive listener on a query function |
| `addRule({ writeFn, queryFn })` | Optionally controls which queries fire for which mutations |

No reducers. No actions. No selectors. No providers. No context.  
Your state is plain JavaScript. Your reads and writes are plain functions.  
ADAX only orchestrates *when* to call them reactively.

---

## Quick start

```typescript
// ─── Your state — plain JavaScript ───────────────────────────────────────────
const store = { count: 0 };

// ─── Read function ────────────────────────────────────────────────────────────
const getCount = () => store.count;

// ─── Write function ───────────────────────────────────────────────────────────
const increment = () => { store.count++; };

// ─── Subscribe ────────────────────────────────────────────────────────────────
const { on, off } = subscribe(
  ({ data }) => console.log('count:', data),
  getCount
);
on();

// ─── Trigger ──────────────────────────────────────────────────────────────────
trigger(increment, undefined);
// → "count: 1"

off();
```

No boilerplate. No wiring. The same pattern works in React, Vue, Svelte, Angular,
Node.js, and Cloudflare Workers — identically.

---

## The feature that sets ADAX apart: Rules

By default ADAX re-evaluates all subscribed queries on every mutation and fires
callbacks only when results change (deep equality). That is correct and sufficient
for most cases.

Rules let you go further — declaring *exactly* which queries should react to which
mutations, with an optional skip predicate for fine-grained control:

```typescript
// Only fire getMood subscribers when voteFor is triggered.
// Skip re-evaluation entirely if the winner cannot change.
addRule({
  writeFn: voteFor,
  queryFn: getMood,
  skip: ({ name: votedName }, { name: subscribedName }) =>
    votedName !== subscribedName
});
```

Rules give you:
- **Predictable reactivity** — no surprise re-renders
- **Performance tuning** — skip evaluations you know are irrelevant
- **Explicit data flow** — your reactive graph is declared, not inferred

---

## Framework adapters

ADAX core is framework-agnostic. Adapters handle the lifecycle wiring
so your components stay clean:

| Framework | Package | Status |
|---|---|---|
| React | `adax-react` | ✅ Released |
| Vue | `adax-vue` | 🔄 In progress |
| Angular | `adax-angular` | 🔄 In progress |
| Svelte | `adax-svelte` | 📋 Planned |
| Solid | `adax-solid` | 📋 Planned |
| Vanilla JS | `adax-core` directly | ✅ Works today |

Each adapter exposes a single `useSync` hook that subscribes, mounts, and
unmounts automatically within the framework's lifecycle — matching the
ergonomics developers already expect.

**React:**
```tsx
const { mood } = useSync(getMood, { name });
```

**Vue:**
```vue
const mood = useSync(() => [getMood, { name }]);
```

**Svelte:**
```svelte
const mood = useSync(getMood, { name });
```

Same mental model. Different syntax. Same underlying state.

---

## Where ADAX shines

### Micro-frontends
The hardest unsolved problem in micro-frontend architectures is shared reactive
state across independently deployed framework boundaries. ADAX is the only
solution that is framework-agnostic by design rather than by accident.

No postMessage. No event bus. No coupling to a specific bundler or module
federation configuration. Just subscribe to the same state from anywhere.

### Incremental migrations
Migrating from Angular to React? From Vue 2 to Vue 3?  
Run both frameworks simultaneously, sharing the same ADAX state.  
Migrate component by component. No big-bang rewrite. No state duplication.

### Cross-runtime logic
ADAX runs identically in:
- **Browser** — reactive UI state
- **Node.js** — server-side shared state
- **Edge runtimes** — Cloudflare Workers, Durable Objects

Write your state logic once. Run it everywhere.

### Islands architecture
Using Astro, Fresh, or any islands-based framework?  
ADAX lets independently hydrated islands share reactive state without
a global framework wrapper.

---

## When NOT to use ADAX

ADAX is explicit and minimal by design. It may not be the right fit if you:

- Want a batteries-included solution with devtools, time-travel debugging,
  and a large plugin ecosystem out of the box
- Are building a single-framework app with no cross-boundary state needs
  and prefer convention over control
- Need built-in persistence, middleware chains, or async action orchestration
  without writing it yourself

For those needs, Zustand, Pinia, or NgRx are excellent choices within their
respective ecosystems. ADAX is for when those ecosystems are not enough —
or when you need to transcend them entirely.

---

## Design philosophy

> *Applications should remain as easy to reason about as a single component —
> no matter how large or how multi-framework they grow.*

ADAX achieves this with three constraints:

**No opinions on state shape.** One store, many stores, per-feature, per-team —
organize however your architecture demands.

**No framework coupling.** The core has zero knowledge of React, Vue, or anything
else. Adapters are thin wrappers, not deep integrations.

**No hidden magic.** Every reactive relationship is either derived automatically
from deep equality (zero config) or declared explicitly via rules (full control).
Nothing fires without a reason you can point to.

---

## Full documentation

→ [Complete API reference](https://github.com/MirjamElad/adax-core)  
→ [adax-react documentation](https://github.com/MirjamElad/adax-react)  
→ [Multi-framework live demo](https://github.com/MirjamElad/ADAX-Vanilla-Vue-React)

---

## Status

| Component | Status |
|---|---|
| adax-core | ✅ Stable |
| adax-react | ✅ Released |
| adax-vue | 🔄 In progress |
| adax-angular | 🔄 In progress |
| Documentation | 🔄 Actively expanding |

---

## Contributing & feedback

ADAX is at its most interesting at the edges — unusual framework combinations,
edge runtime deployments, migration architectures, islands patterns.

If you are building something in that space, or have ideas about where ADAX
should go next, opening an issue or a discussion is the best place to start.

If ADAX is saving you real time or solving a real problem in production,
consider supporting its development:

👉 [GitHub Sponsors](https://github.com/sponsors/MirjamElad)

---

*Built for the multi-framework, multi-runtime reality of modern web development.*