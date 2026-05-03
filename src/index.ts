import { KernelStore, kernelStore } from './store/index';
import { getQueryPlan } from './store/read';
import { addQuery, removeQuery, afterWrite } from './store/write';
import { debounce, throttle, isInternal, deepEqual, deepClone } from './store/utils';
import type { QueryOptions, Result } from "./store/type";

export { KernelStore, kernelStore } from './store/index';
export { getQueryPlan, getExecStack } from "./store/read";
export { addQuery, removeQuery, addRule, removeRule, clearAllRules, afterWrite } from './store/write';
export type { QueryOptions, Result } from "./store/type";

export const getSortedID = kernelStore.getSortedID;

export const trigger = <FnType extends (x: any) => void>(
    writeFn: FnType,
    writeParamsObj: Parameters<FnType>[0],
    stores: { kernel: KernelStore } = { kernel: kernelStore }
  ) => {
    const { queryPlan, computeData, triggerViews } = getQueryPlan({writeFn, writeParamsObj}, stores);    
    writeFn(writeParamsObj);
    computeData();
    triggerViews();
    setTimeout(()=> {
      if (!isInternal(writeFn)) {
        trigger(afterWrite, { writeFn, writeParamsObj, queryPlan }, stores);
      }
    });
  };

export const subscribe = <FnType extends (x: any) => any>(
  readTrigger: (res: Result) => void,
  readFn: FnType,
  paramsObj?: Parameters<FnType>[0],
  options: QueryOptions = {},
  stores: { kernel: KernelStore } = { kernel: kernelStore }
) => {
  /* istanbul ignore next */
  const cmpId = options.cmpId ?? getSortedID();
  options.hasResultChanged = options.hasResultChanged || ((data:any, prevData:any) => ! deepEqual(data, prevData));
  /* istanbul ignore next */
  const result: Result = {    
    //TODO: revisit production/developement mode: trackResultChanges=false/true;
    data: options?.skipInitialQuerying ? undefined : stores.kernel.trackResultChanges ? deepClone(readFn(paramsObj)) : readFn(paramsObj),
    prevData: undefined,
    version: 0,
    writeFn: undefined,
    writeParamsObj: undefined
  };
  let _trigger = readTrigger;
  if (options.debounceMs || options.throttleMs) {
    if (options.debounceMs && options.throttleMs) {
      throw new Error('Cannot have both debounce and throttle options for any given query')
    }
    if (options.debounceMs) {
      _trigger = debounce(readTrigger, options.debounceMs);
    } else if (options.throttleMs) {
      _trigger = throttle(readTrigger, options.throttleMs);
    }
  }
  const on = () => {
    addQuery({ queryFn: readFn, queryInstance: {
      instanceKey: cmpId,
      readTrigger: _trigger,
      paramsObj: paramsObj || {},
      options,
      result: result
    }}, stores);
  };  
  const off = () => {
    removeQuery({ queryFn: readFn, queryInstance: {
      // eslint-disable-next-line 
      instanceKey: cmpId,
      readTrigger: undefined,
      paramsObj: paramsObj || {},
      options,
      result: {
        data: undefined,
        prevData: undefined,
        version: 0,
        writeFn: undefined,
        writeParamsObj: undefined
      }
    }}, stores);
  }
  return { result, on, off };
};
//TODO: Rethink useSync to be used by adax adapters (such as adax-react) instead of subscribe
export const useSync = <FnType extends (x: any) => any>(
  render: (data: any) => void,
  query: FnType,
  paramsObj?: Parameters<FnType>[0],
  options: QueryOptions = {},
  stores: { kernel: KernelStore } = { kernel: kernelStore }
) => {
  const { result, on, off } = subscribe(
    (result) => render(result),
    query,
    paramsObj,
    options,
    stores
  );
  on();
  render(result);
  return off;
};

// DX.ts //////////////////////////////

export type AnyQueryFn = (params: any, stores?: any) => any;

export interface DxInit {
  readonly dxId: string;
  [key: string]: unknown; // callers may attach arbitrary domain fields
}

export type RunContext = {
  /**
   * Resets to 0 on every activation. Safe to use for "first run of this
   * activation" logic (runIndex === 0). Do NOT use for "first run ever"
   * or cross-activation logic — it resets on every on() call.
   *
   * Note: In ephemeral environments (e.g. Cloudflare Durable Objects) the
   * instance may be reconstructed mid-lifecycle, making any cross-activation
   * assumption invalid.
   */
  runIndex:            number;
  executionToken:      number;
  runToken:            number;
  isLatestRun:         () => boolean;
  isActiveExecution:   () => boolean;
};

export type RunFn<TQueryFn extends AnyQueryFn> = (
  init: DxInit & Parameters<TQueryFn>[0],
  result: {
    data: ReturnType<TQueryFn>;
    prevData: ReturnType<TQueryFn>;
    version: number;
    writeFn?: (x: unknown) => void;
    writeParamsObj: unknown;
  },
  ctx: RunContext
) => void | Promise<void> | unknown;

/**
 * Lifecycle hooks MUST be synchronous. Returning a Promise is a runtime error.
 * Any async work belongs inside `run`, which has full ctx guard infrastructure.
 *
 * Critical: if subscribe() throws after a successful beforeOn(), beforeOff()
 * is never called. Any side effects in beforeOn() must be safe to leave in place.
 */
export type LifecycleHook = (init: DxInit) => void;

// ─── Notify event types ───────────────────────────────────────────────────────

export type DxErrorEvent =
  | "ERROR_dxId_collision"   // dxId already active in the global registry
  | "ERROR_beforeOn"         // beforeOn threw or returned a Promise
  | "ERROR_onBeforeOnFail"   // onBeforeOnFail itself threw
  | "ERROR_subscribe"        // adax-core subscribe() threw (e.g. debounce+throttle conflict)
  | "ERROR_beforeOff"        // beforeOff threw or returned a Promise
  | "ERROR_run_sync"         // run() threw synchronously
  | "ERROR_run_async";       // run() returned a rejected Promise

export type DxWarnEvent =
  | "WARN_reentrant_run"     // trigger() called synchronously inside run()
  | "WARN_late_callback";    // adax-core callback arrived after actualState = "inactive"

export type DxEvent = DxErrorEvent | DxWarnEvent;

/**
 * The subscription shape dx depends on from adax-core.
 * Typed explicitly so any breaking change in adax-core's return type
 * is caught at the assignment site rather than hidden by a cast.
 */
type Subscription<TResult> = {
  result: {
    data:            TResult;
    prevData:        TResult;
    version:         number;
    writeFn:         ((x: unknown) => void) | undefined;
    writeParamsObj:  unknown;
  };
  on:  () => void;
  off: () => void;
};

export interface DxConfig<TQueryFn extends AnyQueryFn> {
  // 1. Forces init to include dxId AND the exact params queryFn expects
  init:            DxInit & Parameters<TQueryFn>[0];

  // 2. The source of truth for all types
  queryFn:         TQueryFn;

  // 3. run is automatically typed to the exact return type of queryFn
  run:             RunFn<TQueryFn>;

  notify:          (event: DxEvent, payload: unknown) => void;
  beforeOn?:       LifecycleHook;
  beforeOff?:      LifecycleHook;
  onBeforeOnFail?: LifecycleHook;
  queryOptions?:   QueryOptions;

  // ONLY the adax-core kernel configuration goes here.
  // Domain stores belong in your queryFn/writeFn default params!
  stores?: { kernel: KernelStore };
  __dev__?:        boolean;
}

// ─── DEV mode resolution ──────────────────────────────────────────────────────

const resolveDev = (override?: boolean): boolean => {
  if (typeof override === "boolean") return override;
  if (
    typeof process !== "undefined" &&
    process.env != null &&
    process.env.NODE_ENV != null
  ) {
    return process.env.NODE_ENV === "development";
  }
  // Defaults to false in all non-Node environments (browser, Durable Objects, etc.)
  // Pass __dev__: true explicitly to enable DEV mode in those environments.
  return false;
};

// ─── Global active dxId registry ─────────────────────────────────────────────
//
// Tracks dxIds of currently active instances. Two instances with the same dxId
// cannot be active simultaneously — they would collide in adax-core's subscription
// Map (keyed by cmpId = dxId), with the second silently overwriting the first.
//
// The check covers concurrent activation only. Two inactive instances sharing a
// dxId are fine until one tries to activate while the other is already active.

const activeDxIds = new Set<string>();

// ─── Shared defaults (avoid per-call allocations) ─────────────────────────────
const EMPTY_OPTIONS: QueryOptions = {};
const NOOP_HOOK: LifecycleHook = () => {};

// ─── dx ───────────────────────────────────────────────────────────────────────
export function dx<TQueryFn extends AnyQueryFn>(
  {
    init,
    queryFn,
    run,
    notify,
    beforeOn  = NOOP_HOOK,
    beforeOff = NOOP_HOOK,
    onBeforeOnFail,
    queryOptions = EMPTY_OPTIONS,
    stores,
    __dev__,
  }: DxConfig<TQueryFn>
): { claim: () => { on: () => void; off: () => void } } {

  const DEV = resolveDev(__dev__);

  // ── Ownership guard ───────────────────────────────────────────────────────
  let claimed = false;

  // ── Coalesced lifecycle state ─────────────────────────────────────────────
  type State = "inactive" | "active";

  let desiredState:  State = "inactive";
  let actualState:   State = "inactive";
  let transitioning        = false;

  // ── Token counters ────────────────────────────────────────────────────────
  let executionToken          = 0;
  let currentRunToken         = 0;
  let runIndexSinceActivation = 0;

  let sub: Subscription<ReturnType<TQueryFn>> | null = null;

  // DEV-only
  let isRunning       = false;
  let droppedRunCount = 0;

  // ── invokeRun ─────────────────────────────────────────────────────────────
  const invokeRun = (result: Subscription<ReturnType<TQueryFn>>["result"]): void => {
    if (actualState !== "active") {
      if (DEV) {
        droppedRunCount++;
        if (droppedRunCount === 1 || droppedRunCount % 100 === 0) {
          const msg =
            `[dx] Late callback discarded after deactivation ` +
            `(total: ${droppedRunCount}) for component "${init.dxId}". ` +
            `This may indicate a race condition.`;
          console.warn(msg);
          notify("WARN_late_callback", {
            componentId: init.dxId,
            totalDropped: droppedRunCount,
          });
        }
      }
      return;
    }

    if (DEV && isRunning) {
      const msg =
        `[dx] Re-entrant run detected in component "${init.dxId}". ` +
        `Avoid calling trigger() synchronously inside run().`;
      console.warn(msg);
      notify("WARN_reentrant_run", { componentId: init.dxId });
    }

    const myRunToken  = ++currentRunToken;
    const myExecToken = executionToken;
    const myRunIndex  = runIndexSinceActivation++;

    const ctx: RunContext = {
      runIndex:          myRunIndex,
      executionToken:    myExecToken,
      runToken:          myRunToken,
      isLatestRun:       () => myRunToken  === currentRunToken,
      isActiveExecution: () => myExecToken === executionToken,
    };

    isRunning = true;
    try {
      Promise.resolve(run(init, result, ctx)).catch((error: unknown) =>
        notify("ERROR_run_async", { error, componentId: init.dxId })
      );
    } catch (error) {
      notify("ERROR_run_sync", { error, componentId: init.dxId });
    } finally {
      isRunning = false;
    }
  };

  // ── activate ──────────────────────────────────────────────────────────────
  const activate = (): void => {
    if (activeDxIds.has(init.dxId)) {
      notify("ERROR_dxId_collision", {
        error: new Error(
          `[dx] Component "${init.dxId}" is already active. ` +
          `dxId must be unique across concurrently active instances.`
        ),
        componentId: init.dxId,
      });
      desiredState  = "inactive";
      transitioning = false;
      reconcile();
      return;
    }

    executionToken++;
    runIndexSinceActivation = 0;
    droppedRunCount         = 0;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beforeOnResult = beforeOn(init) as any;
      if (beforeOnResult instanceof Promise) {
        throw new Error(
          `[dx] beforeOn must be synchronous in component "${init.dxId}". ` +
          `Return value was a Promise. Move async work into run().`
        );
      }
    } catch (error) {
      notify("ERROR_beforeOn", { error, componentId: init.dxId });
      if (onBeforeOnFail) {
        try {
          onBeforeOnFail(init);
        } catch (cleanupError) {
          notify("ERROR_onBeforeOnFail", { error: cleanupError, componentId: init.dxId });
        }
      }
      desiredState  = "inactive";
      transitioning = false;
      reconcile();
      return;
    }

    try {
      sub = subscribe(
        (result: unknown) => invokeRun(result as Subscription<ReturnType<TQueryFn>>["result"]),
        queryFn,
        init,
        { ...queryOptions, cmpId: init.dxId },
        stores as { kernel: KernelStore } | undefined // Safe explicit cast
      ) as Subscription<ReturnType<TQueryFn>>;
    } catch (error) {
      notify("ERROR_subscribe", { error, componentId: init.dxId });
      desiredState  = "inactive";
      transitioning = false;
      reconcile();
      return;
    }

    activeDxIds.add(init.dxId);
    actualState = "active";

    invokeRun(sub.result);

    sub.on();

    transitioning = false;
    reconcile();
  };

  // ── deactivate ────────────────────────────────────────────────────────────
  const deactivate = (): void => {
    executionToken++;
    actualState = "inactive";

    sub?.off();
    sub = null;

    activeDxIds.delete(init.dxId);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beforeOffResult = beforeOff(init) as any;
      if (beforeOffResult instanceof Promise) {
        throw new Error(
          `[dx] beforeOff must be synchronous in component "${init.dxId}". ` +
          `Return value was a Promise. Move async work into run().`
        );
      }
    } catch (error) {
      notify("ERROR_beforeOff", { error, componentId: init.dxId });
    }

    transitioning = false;
    reconcile();
  };

  // ── reconcile ─────────────────────────────────────────────────────────────
  const reconcile = (): void => {
    if (transitioning)               return;
    if (desiredState === actualState) return;

    transitioning = true;

    if (desiredState === "active") {
      activate();
    } else {
      deactivate();
    }
  };

  // ── Public API ────────────────────────────────────────────────────────────
  const on = (): void => {
    desiredState = "active";
    reconcile();
  };

  const off = (): void => {
    desiredState = "inactive";
    reconcile();
  };

  const claim = (): { on: () => void; off: () => void } => {
    if (claimed) {
      throw new Error(
        `[dx] Component "${init.dxId}" has already been claimed. ` +
        `Only one owner may call on()/off() per dx instance.`
      );
    }
    claimed = true;
    return { on, off };
  };

  return { claim };
}