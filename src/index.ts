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
  | "ERROR_run_sync";

export type DxEvent = DxErrorEvent;

export type RunContext = {
  runIndex:   number;
  isFirstRun: () => boolean;
};

export type QueryResult<TQueryFn extends AnyQueryFn> = {
  data: ReturnType<TQueryFn>;
  prevData: ReturnType<TQueryFn>;
  version: number;
  writeFn?: (x: unknown) => void;
  writeParamsObj: unknown;
};

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

export interface DxConfig<
  TQueryFn extends AnyQueryFn,
  TInit extends DxInit,
  TNotifications extends NotificationMap = NotificationMap
> {
  init:            TInit;
  queryFn:         TQueryFn;
  onUpdate?:       (init: TInit, result: QueryResult<TQueryFn>, ctx: RunContext, emit: EmitFn<TNotifications>) => void;
  onReady?:        (init: TInit) => void;
  onUnmount?:      (init: TInit) => void;
  notify:          (event: DxEvent, payload: any) => void;
  onEmit:          EmitFn<TNotifications>;
  beforeOn?:       LifecycleHook<TInit>;
  beforeOff?:      LifecycleHook<TInit>;
  onBeforeOnFail?: LifecycleHook<TInit>;
  queryOptions?:   QueryOptions;
  stores?:         { kernel: KernelStore };
}

type AtLeastOneHook<TQueryFn extends AnyQueryFn, TInit extends DxInit, TN extends NotificationMap> =
  | (DxConfig<TQueryFn, TInit, TN> & { onUpdate:  NonNullable<DxConfig<TQueryFn, TInit, TN>['onUpdate']>  })
  | (DxConfig<TQueryFn, TInit, TN> & { onReady:   NonNullable<DxConfig<TQueryFn, TInit, TN>['onReady']>   })
  | (DxConfig<TQueryFn, TInit, TN> & { onUnmount: NonNullable<DxConfig<TQueryFn, TInit, TN>['onUnmount']> });

export function dx<
  TQueryFn extends AnyQueryFn,
  TInit extends Parameters<TQueryFn>[0] & DxInit,
  TNotifications extends NotificationMap
>(config: AtLeastOneHook<TQueryFn, TInit, TNotifications>)
  : { claim: () => { on: () => void; off: () => void; isActive: () => boolean } } {

  if (!config.onUpdate && !config.onReady && !config.onUnmount) {
    throw new Error(`[dx] At least one of onUpdate, onReady, or onUnmount must be provided.`);
  }

  const stores = config.stores ?? { kernel: kernelStore };

  let claimed                = false;
  let desiredState: "active" | "inactive" = "inactive";
  let actualState:  "active" | "inactive" = "inactive";
  let transitioning          = false;
  let currentInit: TInit | null = null;
  let sub: ReturnType<typeof subscribe> | null = null;
  let runIndexSinceActivation = 0;

  const invokeRun = (init: TInit, result: Result): void => {
    const myRunIndex = runIndexSinceActivation++;
    const ctx: RunContext = {
      runIndex:   myRunIndex,
      isFirstRun: () => myRunIndex === 0,
    };
    try {
      const r = (config as any).onUpdate?.(init, result, ctx, config.onEmit);
      if ((r as any) instanceof Promise) throw new Error("onUpdate must be synchronous");
    } catch (err) {
      config.notify("ERROR_run_sync", { error: err, componentId: init.dxId });
    }
  };

  const activate = (): void => {
    if (stores.kernel.activeDxIds.has(config.init.dxId)) {
      config.notify("ERROR_dxId_collision", {
        error: new Error(`[dx] "${config.init.dxId}" already active.`),
        componentId: config.init.dxId,
      });
      currentInit = null;
      desiredState = "inactive";
      transitioning = false;
      reconcile();
      return;
    }

    const init = { ...config.init } as TInit;
    runIndexSinceActivation = 0;

    try {
      const r = config.beforeOn?.(init);
      if ((r as any) instanceof Promise) throw new Error("beforeOn must be synchronous");
    } catch (err) {
      config.notify("ERROR_beforeOn", { error: err, componentId: init.dxId });
      if (config.onBeforeOnFail) {
        try { config.onBeforeOnFail(init); }
        catch (cleanupErr) {
          config.notify("ERROR_onBeforeOnFail", { error: cleanupErr, componentId: init.dxId });
        }
      }
      desiredState = "inactive";
      transitioning = false;
      throw err;
    }

    let isLive = false;
    let pendingUpdate = false;

    const protectedReadTrigger = (res: Result): void => {
      if (!isLive) {
        pendingUpdate = true;
        return;
      }
      invokeRun(init, res);
    };

    try {
      sub = subscribe(
        protectedReadTrigger,
        config.queryFn,
        init,
        { ...config.queryOptions, cmpId: init.dxId },
        stores
      );
    } catch (err) {
      config.notify("ERROR_subscribe", { error: err, componentId: init.dxId });
      if (config.onBeforeOnFail) {
        try { config.onBeforeOnFail(init); }
        catch (cleanupErr) {
          config.notify("ERROR_onBeforeOnFail", { error: cleanupErr, componentId: init.dxId });
        }
      }
      currentInit = null;
      desiredState = "inactive";
      transitioning = false;
      reconcile();
      return;
    }

    sub.on();
    stores.kernel.activeDxIds.add(init.dxId);
    currentInit = init;
    actualState = "active";

    invokeRun(init, sub.result);

    isLive = true;
    if (pendingUpdate) {
      pendingUpdate = false;
      invokeRun(init, sub.result);
    }

    try {
      const r = (config as any).onReady?.(init);
      if ((r as any) instanceof Promise) throw new Error("onReady must be synchronous");
    } catch (err) {
      config.notify("ERROR_run_sync", { error: err, componentId: init.dxId });
    }

    transitioning = false;
    reconcile();
  };

  const deactivate = (): void => {
    const init = currentInit!;

    sub?.off();
    sub = null;

    try {
      const r = (config as any).onUnmount?.(init);
      if ((r as any) instanceof Promise) throw new Error("onUnmount must be synchronous");
    } catch (err) {
      config.notify("ERROR_run_sync", { error: err, componentId: init.dxId });
    }

    try {
      const r = (config as any).beforeOff?.(init);
      if ((r as any) instanceof Promise) throw new Error("beforeOff must be synchronous");
    } catch (err) {
      config.notify("ERROR_beforeOff", { error: err, componentId: init.dxId });
    } finally {
      stores.kernel.activeDxIds.delete(init.dxId);
      actualState = "inactive";
    }

    currentInit = null;
    transitioning = false;
    reconcile();
  };

  const reconcile = (): void => {
    if (transitioning) return;
    if (desiredState === actualState) return;
    transitioning = true;
    desiredState === "active" ? activate() : deactivate();
  };

  const claim = () => {
    if (claimed) throw new Error(`[dx] "${config.init.dxId}" already claimed.`);
    claimed = true;
    return {
      on:  () => { desiredState = "active";   reconcile(); },
      off: () => { desiredState = "inactive"; reconcile(); },
      isActive: () => actualState === "active",
    };
  };

  return { claim };
}