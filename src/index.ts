import { KernelStore, kernelStore } from './store/index';
import { getQueryPlan } from './store/read';
import { addQuery, removeQuery, afterWrite } from './store/write';
import { debounce, throttle, isInternal, deepEqual } from './store/utils';
import type { QueryOptions, Result } from "./store/type";

export type { QueryOptions, Result } from "./store/type";
export { KernelStore, kernelStore } from './store/index';
export { getQueryPlan, getExecStack } from "./store/read";
export { addQuery, removeQuery, addRule, removeRule, clearAllRules, afterWrite } from './store/write';


export const getSortedID = kernelStore.getSortedID;

export const trigger = <FnType extends (x: any) => void>(
    writeFn: FnType,
    writeParamsObj: Parameters<FnType>[0],
    stores: { kernel: KernelStore } = { kernel: kernelStore }
  ) => {
    const { queryPlan, computeData, triggerViews } = getQueryPlan({writeFn, writeParamsObj}, stores);    
    writeFn(writeParamsObj);
    computeData();
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
  /* istanbul ignore next */
  const cmpId = options.cmpId ?? getSortedID();
  /* istanbul ignore next */
  const result: Result = {
    data: options?.skipInitalQuerying ? undefined :readFn(paramsObj),
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
  query: (queryArgs: QueryOptions | undefined) => any,
  paramsObj?: Parameters<FnType>[0],
  options: QueryOptions = {},
  stores: { kernel: KernelStore } = { kernel: kernelStore }
) => {
  options.hasResultChanged = options.hasResultChanged || ((data:any, prevData:any) => ! deepEqual(data, prevData));
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