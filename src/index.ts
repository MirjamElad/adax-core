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
  const effectiveOptions: QueryOptions = { ...options };
  /* istanbul ignore next */
  const cmpId = effectiveOptions.cmpId ?? stores.kernel.getSortedID();
  effectiveOptions.hasResultChanged = effectiveOptions.hasResultChanged || ((data:any, prevData:any) => ! deepEqual(data, prevData));
  /* istanbul ignore next */
  const result: Result = {    
    //TODO: revisit production/developement mode: trackResultChanges=false/true;
    data: effectiveOptions?.skipInitialQuerying ? undefined : stores.kernel.trackResultChanges ? deepClone(readFn(paramsObj)) : readFn(paramsObj),
    prevData: undefined,
    version: 0,
    writeFn: undefined,
    writeParamsObj: undefined
  };
  let _trigger = readTrigger;
  if (effectiveOptions.debounceMs || effectiveOptions.throttleMs) {
    if (effectiveOptions.debounceMs && effectiveOptions.throttleMs) {
      throw new Error('Cannot have both debounce and throttle options for any given query')
    }
    if (effectiveOptions.debounceMs) {
      _trigger = debounce(readTrigger, effectiveOptions.debounceMs);
    } else if (effectiveOptions.throttleMs) {
      _trigger = throttle(readTrigger, effectiveOptions.throttleMs);
    }
  }
  const on = () => {
    addQuery({ queryFn: readFn, queryInstance: {
      instanceKey: cmpId,
      readTrigger: _trigger,
      paramsObj: paramsObj || {},
      options: effectiveOptions,
      result: result
    }}, stores);
  };  
  const off = () => {
    removeQuery({ queryFn: readFn, queryInstance: {
      // eslint-disable-next-line 
      instanceKey: cmpId,
      readTrigger: undefined,
      paramsObj: paramsObj || {},
      options: effectiveOptions,
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

// ============================================================================
// DX.ts – with domain event system (onEmit) and full type safety
// ============================================================================

export type AnyQueryFn = (params: any, stores?: any) => any;

export interface DxInit {
  readonly dxId: string;
  [key: string]: unknown;
}

// Domain events (user‑land)
export type NotificationMap = Record<string, unknown>;
export type DxDomainEvent<T extends NotificationMap> = keyof T & string;
export type EmitFn<T extends NotificationMap> = <K extends DxDomainEvent<T>>(
  event: K,
  payload: T[K]
) => void;

// Diagnostic events (dx internal)
export type DxErrorEvent =
  | "ERROR_dxId_collision"
  | "ERROR_beforeOn"
  | "ERROR_onBeforeOnFail"
  | "ERROR_subscribe"
  | "ERROR_beforeOff"
  | "ERROR_run_sync"
  | "ERROR_run_async";

export type DxWarnEvent =
  | "WARN_reentrant_run"
  | "WARN_late_callback";

export type DxEvent = DxErrorEvent | DxWarnEvent;

export type RunContext = {
  runIndex:            number;
  executionToken:      number;
  runToken:            number;
  isLatestRun:         () => boolean;
  isActiveExecution:   () => boolean;
};

export type QueryResult<TQueryFn extends AnyQueryFn> = {
  data: ReturnType<TQueryFn>;
  prevData: ReturnType<TQueryFn>;
  version: number;
  writeFn?: (x: unknown) => void;
  writeParamsObj: unknown;
};

export type RunFn<
  TQueryFn extends AnyQueryFn,
  TInit extends Parameters<TQueryFn>[0] & DxInit,
  TNotifications extends NotificationMap
> = (
  init: TInit,
  result: QueryResult<TQueryFn>,
  ctx: RunContext,
  emit: EmitFn<TNotifications>
) => void | Promise<void>;

export type LifecycleHook<TInit extends DxInit = DxInit> = (init: TInit) => void;

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

// Conditional event narrowing (kept from original)
type EventsForConfig<TConfig extends HookShape> =
  | "ERROR_dxId_collision"
  | "ERROR_subscribe"
  | "ERROR_run_sync"
  | "ERROR_run_async"
  | "WARN_reentrant_run"
  | "WARN_late_callback"
  | (TConfig extends { beforeOn: LifecycleHook }
      ? "ERROR_beforeOn" | "ERROR_onBeforeOnFail"
      : never)
  | (TConfig extends { beforeOff: LifecycleHook }
      ? "ERROR_beforeOff"
      : never);

type ErrorPayload = { error: unknown; componentId: string };
type WarnReentrantPayload = { componentId: string };
type WarnLateCallbackPayload = { componentId: string; totalDropped: number };

type NotifyPayload<TEvent extends DxEvent> =
  TEvent extends `ERROR_${string}`      ? ErrorPayload           :
  TEvent extends "WARN_reentrant_run"   ? WarnReentrantPayload   :
  TEvent extends "WARN_late_callback"   ? WarnLateCallbackPayload :
  never;

export interface DxConfig<
  TQueryFn extends AnyQueryFn,
  TInit extends Parameters<TQueryFn>[0] & DxInit,
  TNotifications extends NotificationMap = NotificationMap
> {
  init:            TInit;
  queryFn:         TQueryFn;
  run:             RunFn<TQueryFn, TInit, TNotifications>;
  notify:          <TEvent extends DxEvent>(event: TEvent, payload: NotifyPayload<TEvent>) => void;
  onEmit:          EmitFn<TNotifications>;   // required – explicit domain event wiring
  beforeOn?:       LifecycleHook<TInit>;
  beforeOff?:      LifecycleHook<TInit>;
  onBeforeOnFail?: LifecycleHook<TInit>;
  queryOptions?:   QueryOptions;              // non‑generic, matches adax-core
  stores?:         { kernel: KernelStore };
  __dev__?:        boolean;
}

// HookShape for conditional event derivation
type HookShape = {
  beforeOn?:  (...args: never[]) => unknown;
  beforeOff?: (...args: never[]) => unknown;
};

const resolveDev = (override?: boolean): boolean => {
  if (typeof override === "boolean") return override;
  if (typeof process !== "undefined" && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === "development";
  }
  return false;
};

const activeDxIdsByStore = new WeakMap<KernelStore, Set<string>>();
const EMPTY_OPTIONS: QueryOptions = {};
const NOOP_HOOK: LifecycleHook = () => {};

export function dx<
  TQueryFn extends AnyQueryFn,
  TInit extends Parameters<TQueryFn>[0] & DxInit,
  TNotifications extends NotificationMap,
  TConfig extends HookShape
>(
  config: DxConfig<TQueryFn, TInit, TNotifications> & TConfig & {
    notify: <TEvent extends EventsForConfig<TConfig>>(
      event: TEvent,
      payload: NotifyPayload<TEvent>
    ) => void;
  }
): { claim: () => { on: () => void; off: () => void } } {

  const {
    init,
    queryFn,
    run,
    notify,
    onEmit,
    beforeOn = NOOP_HOOK,
    beforeOff = NOOP_HOOK,
    onBeforeOnFail,
    queryOptions = EMPTY_OPTIONS,
    stores,
    __dev__,
  } = config as DxConfig<TQueryFn, TInit, TNotifications> & TConfig & {
    notify: (event: DxEvent, payload: unknown) => void;
    onBeforeOnFail?: LifecycleHook<TInit>;
    queryOptions?: QueryOptions;
    stores?: { kernel: KernelStore };
    __dev__?: boolean;
  };

  const DEV = resolveDev(__dev__);
  const emit = onEmit; // domain event emitter

  let claimed = false;
  let desiredState: "active" | "inactive" = "inactive";
  let actualState: "active" | "inactive" = "inactive";
  let transitioning = false;

  let executionToken = 0;
  let currentRunToken = 0;
  let runIndexSinceActivation = 0;

  let sub: Subscription<ReturnType<TQueryFn>> | null = null;
  let isRunning = false;
  let droppedRunCount = 0;

  const invokeRun = (result: Subscription<ReturnType<TQueryFn>>["result"]): void => {
    if (actualState !== "active") {
      if (DEV) {
        droppedRunCount++;
        if (droppedRunCount === 1 || droppedRunCount % 100 === 0) {
          console.warn(
            `[dx] Late callback discarded after deactivation (total: ${droppedRunCount}) for component "${init.dxId}".`
          );
          notify("WARN_late_callback", {
            componentId: init.dxId,
            totalDropped: droppedRunCount,
          });
        }
      }
      return;
    }

    if (DEV && isRunning) {
      console.warn(`[dx] Re-entrant run detected in component "${init.dxId}". Avoid calling trigger() synchronously inside run().`);
      notify("WARN_reentrant_run", { componentId: init.dxId });
    }

    const myRunToken = ++currentRunToken;
    const myExecToken = executionToken;
    const myRunIndex = runIndexSinceActivation++;

    const ctx: RunContext = {
      runIndex: myRunIndex,
      executionToken: myExecToken,
      runToken: myRunToken,
      isLatestRun: () => myRunToken === currentRunToken,
      isActiveExecution: () => myExecToken === executionToken,
    };

    isRunning = true;
    try {
      Promise.resolve(run(init, result, ctx, emit)).catch((error: unknown) =>
        notify("ERROR_run_async", { error, componentId: init.dxId })
      );
    } catch (error) {
      notify("ERROR_run_sync", { error, componentId: init.dxId });
    } finally {
      isRunning = false;
    }
  };

  const activate = (): void => {
    const storeToUse = stores?.kernel ?? kernelStore;
    if (!activeDxIdsByStore.has(storeToUse)) {
      activeDxIdsByStore.set(storeToUse, new Set());
    }
    const storeActiveDxIds = activeDxIdsByStore.get(storeToUse)!;
    if (storeActiveDxIds.has(init.dxId)) {
      notify("ERROR_dxId_collision", {
        error: new Error(`[dx] Component "${init.dxId}" is already active. dxId must be unique across concurrently active instances.`),
        componentId: init.dxId,
      });
      desiredState = "inactive";
      transitioning = false;
      reconcile();
      return;
    }

    executionToken++;
    runIndexSinceActivation = 0;
    droppedRunCount = 0;

    try {
      const beforeOnResult = beforeOn(init) as any;
      if (beforeOnResult instanceof Promise) {
        throw new Error(`[dx] beforeOn must be synchronous in component "${init.dxId}". Return value was a Promise. Move async work into run().`);
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
      desiredState = "inactive";
      transitioning = false;
      reconcile();
      return;
    }

    try {
      sub = subscribe(
        (res) => invokeRun(res as Subscription<ReturnType<TQueryFn>>["result"]),
        queryFn,
        init,
        { ...queryOptions, cmpId: init.dxId },
        stores
      ) as Subscription<ReturnType<TQueryFn>>;
    } catch (error) {
      notify("ERROR_subscribe", { error, componentId: init.dxId });
      desiredState = "inactive";
      transitioning = false;
      reconcile();
      return;
    }

    storeActiveDxIds.add(init.dxId);
    actualState = "active";

    invokeRun(sub.result);
    sub.on();

    transitioning = false;
    reconcile();
  };

  const deactivate = (): void => {
    executionToken++;
    actualState = "inactive";

    sub?.off();
    sub = null;

    const storeToUse = stores?.kernel ?? kernelStore;
    const storeActiveDxIds = activeDxIdsByStore.get(storeToUse);
    storeActiveDxIds?.delete(init.dxId);

    try {
      const beforeOffResult = beforeOff(init) as any;
      if (beforeOffResult instanceof Promise) {
        throw new Error(`[dx] beforeOff must be synchronous in component "${init.dxId}". Return value was a Promise. Move async work into run().`);
      }
    } catch (error) {
      notify("ERROR_beforeOff", { error, componentId: init.dxId });
    }

    transitioning = false;
    reconcile();
  };

  const reconcile = (): void => {
    if (transitioning) return;
    if (desiredState === actualState) return;
    transitioning = true;
    desiredState === "active" ? activate() : deactivate();
  };

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
      throw new Error(`[dx] Component "${init.dxId}" has already been claimed. Only one owner may call on()/off() per dx instance.`);
    }
    claimed = true;
    return { on, off };
  };

  return { claim };
}