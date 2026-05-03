# ADAX

### A tiny reactive state engine for multi-framework and multi-runtime apps

**ADAX** is a minimal (≈2KB gzipped), dependency-free state engine designed to work across:

* Frameworks (React, Vue, Angular, Svelte, Solid, Vanilla JS)
* Runtimes (browser, server, edge)

But more importantly:

> **ADAX allows multiple frameworks in the same app to share and react to the same state.**

---

## 🚀 Why ADAX?

Modern apps are no longer single-framework, single-runtime systems.

You might have:

* A React app embedding a Vue widget
* A gradual migration from Angular to something else
* Micro-frontends built with different stacks
* Logic shared between browser, server, and edge

Most state libraries assume:

> one app → one framework → one state system

**ADAX breaks that assumption.**

---

## 🧩 What makes ADAX different?

### 1. Shared state across frameworks

Use React, Vue, and Vanilla JS **in the same app**, all connected to the same state.

👉 Example:
https://github.com/MirjamElad/ADAX-Vanilla-Vue-React

---

### 2. Works everywhere

ADAX runs in:

* Browser
* Node.js
* Edge runtimes (e.g. Cloudflare Workers / Durable Objects)

Same mental model everywhere.

---

### 3. Minimal and explicit

* No dependencies
* No boilerplate
* No hidden magic

Just a small set of primitives you fully control.

---

### 4. Incremental adoption

You can:

* Use ADAX in a small part of your app
* Mix it with existing state solutions
* Gradually expand usage

No rewrites required.

---

## 🧠 Core concepts

ADAX is built around four simple ideas:

### **State**

Your application data.

Organize it however you want:

* Single store
* Multiple stores
* Per feature, per component, or global

---

### **Query (read + subscribe)**

Functions that:

* Read state
* React to changes

Components subscribe to **queries**, not raw state.

---

### **Mutate (write)**

Functions that:

* Create / update / delete state

Used from UI, services, or anywhere in your app.

---

### **Rules (optional but powerful)**

Rules define:

> **when queries should re-run based on mutations**

This gives you:

* Fine-grained control over reactivity
* Predictable updates
* Better performance tuning

---

## ⚙️ API

ADAX intentionally keeps a tiny API surface:

* `useSync(query)` → subscribe to data
* `trigger(mutate)` → update state
* `addRule(...)` → control reactivity

That’s it.

---

## 🧪 Example (conceptual)

```ts
const getCount = () => state.count;

const increment = () => {
  state.count += 1;
};

// subscribe
useSync(getCount);

// update
trigger(increment);
```

Rules can then define when `getCount` should re-run.

---

## 🔌 Adapters

ADAX works with plain JavaScript, but adapters make integration easier:

| Framework | Adapter                                  |
| --------- | ---------------------------------------- |
| React     | https://github.com/MirjamElad/adax-react |
| Vue       | (in progress)                            |
| Angular   | (in progress)                            |
| Others    | easy to build                            |

---

## 🧠 When should you use ADAX?

ADAX shines when you need:

* Shared state across multiple frameworks
* Micro-frontend architectures
* Cross-runtime logic (client + server + edge)
* A simple but explicit reactive model
* Full control over reactivity

---

## ⚠️ When NOT to use it

ADAX may not be ideal if you:

* Want a batteries-included framework solution
* Prefer convention-heavy tools
* Need a large ecosystem of plugins (yet)

---

## 📚 Documentation

Full documentation is in progress.

In the meantime:

* Start with the example:
  https://github.com/MirjamElad/Adax-React-TW-Exp_0

* Explore the multi-framework demo:
  https://github.com/MirjamElad/ADAX-Vanilla-Vue-React

---

## 🎯 Philosophy

ADAX is built on a simple idea:

> Applications should remain as easy to reason about as a single component—no matter how large they grow.

---

## 📌 Status

* Core is stable and usable
* Adapters are being expanded
* Documentation is actively being improved

---

## 🤝 Contributing / Feedback

Ideas, feedback, and experiments are very welcome.

If you're building something interesting with ADAX—especially across frameworks or runtimes—I'd love to hear about it.
