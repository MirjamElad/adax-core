import { KernelStore, kernelStore } from './store/index';
import { getQueryPlan } from './store/read';
import { addQuery, removeQuery, afterWrite } from './store/write';
import { debounce, throttle, isInternal } from './store/utils';
import type { QueryOptions, Result, QueryFn, QueryPlanInstance } from "./store/type";

export type { QueryOptions, Result } from "./store/type";
export { KernelStore, kernelStore } from './store/index';
export { getQueryPlan, getExecStack } from "./store/read";
export { addQuery, removeQuery, addRule, removeRule, clearAllRules, afterWrite } from './store/write';


export const getSortedID = kernelStore.getSortedID;
// Extra comment to force new version 0.0.11
export const trigger = <FnType extends (x: any) => void>(
    writeFn: FnType,
    writeParamsObj: Parameters<FnType>[0],
    stores: { kernel: KernelStore } = { kernel: kernelStore }
  ) => {
    const { queryPlan, computeData, triggerViews } = getQueryPlan({writeFn, writeParamsObj}, stores);    
    writeFn(writeParamsObj);
    computeData();
    //TODO: timeout means triggering views delayed after both triggering beforeWrite + afterWrite.. => too late to cancel?
    setTimeout(()=> {
      triggerViews();
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
  const cmpId = options.cmpId ?? getSortedID();
  const result = { data: options?.skipInitalQuerying ? undefined :readFn(paramsObj), prevData: undefined, version: 0 };
  let _trigger = readTrigger;
  if (options.debounceMs || options.throttleMs) {
    if (options.debounceMs && options.throttleMs) {
      throw new Error('Cannot have both debounce and throttle options for any given query!')
    }
    if (options.debounceMs) {
      _trigger = debounce(readTrigger, options.debounceMs);
    } else if (options.throttleMs) {
      _trigger = throttle(readTrigger, options.throttleMs);
    }
  }
  const onMounted = () => {
    addQuery({ queryFn: readFn, queryInstance: {
      instanceKey: cmpId,
      readTrigger: _trigger,
      paramsObj: paramsObj || {},
      options,
      result: result
    }}, stores);
  };  
  const onBeforeUnmount = () => {
    removeQuery({ queryFn: readFn, queryInstance: {
      // eslint-disable-next-line 
      instanceKey: cmpId,
      readTrigger: undefined,
      paramsObj: paramsObj || {},
      options,
      result: { data: undefined, prevData: undefined, version: 0 }
    }}, stores);
  }
  return { result, onMounted, onBeforeUnmount };
};