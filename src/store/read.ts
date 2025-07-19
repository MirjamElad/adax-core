import {
    QueryFn,
    QueryPlanInstance,
    QueryInstance,
    SkipCondition,
    Result
} from './type';
import { isInternal, deepClone, deepEqual } from './utils';
import { KernelStore, kernelStore } from './index';

/* istanbul ignore next */
export const getExecStack = (_: any = null, stores: { kernel: KernelStore } = { kernel: kernelStore }) => (stores?.kernel?.execStack || []);

const setResult = (queryInstance: QueryInstance, queryFn: QueryFn, writeFn: (x: any) => void, writeParamsObj: unknown) => {
  ////////// dev mode so that it doesnot need rules, but too expensive for prod mode //////////
  //// queryInstance.result!.prevData = deepClone(queryInstance.result!.data);  ////
  ////////// ////////// ////////// ////////// ////////// ////////// ////////// //////////
  console.log('READ::initial prevData >>>', queryInstance.result!.prevData);
  console.log('READ::initial data >>>', queryInstance.result!.data);
  const cloned = deepClone(queryInstance.result!.data);
  console.log('READ::cloned >>>', cloned);
  queryInstance.result!.prevData = cloned;
  //queryInstance.result!.prevData = queryInstance.result!.data;
  const res = queryFn(queryInstance.paramsObj);
  console.log(`READ::res queryFn(${JSON.stringify(queryInstance.paramsObj, null, 2)}) data >>>`, res);
  queryInstance.result!.data = res;
  queryInstance.result!.version = queryInstance.result!.version + 1;
  queryInstance.result!.writeFn = writeFn;
  queryInstance.result!.writeParamsObj = writeParamsObj;
}

const viewTrigger = (
  stores: { kernel: KernelStore },
  queryInstance: QueryInstance, 
  fromRule: boolean | undefined) => {
  if (fromRule || stores.kernel.runAllQueries){
    queryInstance.readTrigger!(queryInstance.result!);
    return;
  }
  const hasChanged: (prevData: any, data: any) => boolean = 
    queryInstance.options?.hasResultChanged || ((prevData: any, data: any) => !deepEqual(prevData, data));
  if (hasChanged(queryInstance.result!.prevData, queryInstance.result!.data)) {
    queryInstance.readTrigger!(queryInstance.result!);
  }
}

const addQueryToPlan = (
  stores: { kernel: KernelStore },
  queryPlan: Map<QueryFn, Array<QueryPlanInstance>>,
  dataComputationCallBacks: (() => void)[] = [],
  viewsTriggeringCallBacks: (() => void)[] = [],
  writeParamsObj: unknown,
  queryFn: QueryFn,
  writeFn: (x: any) => void,
  fromRules: boolean | undefined = undefined,
  skip: SkipCondition | undefined = undefined
) => {
  stores.kernel.queries?.get(queryFn)?.forEach((queryInstance) => {
    if (!queryInstance?.readTrigger) return;
    if (!queryPlan.has(queryFn)) {
      queryPlan.set(queryFn, new Array<QueryPlanInstance>());
    }
    console.log('addQueryToPlan::queryInstance?.result:', JSON.stringify(queryInstance?.result, null, 3));
    const queryInstancesList = queryPlan.get(queryFn)!;
    const _skip = skip && skip(writeParamsObj, queryInstance.paramsObj);
    queryInstance!.result = queryInstance?.result || {
      version: 0,
      data: undefined,
      prevData: undefined,
      writeFn: undefined,
      writeParamsObj: undefined
    };
    
    console.log('addQueryToPlan::queryInstance!.result:', JSON.stringify(queryInstance!.result, null, 3));
    if (!_skip && queryInstance?.readTrigger) {
      dataComputationCallBacks.push(() => {
        setResult(queryInstance, queryFn, writeFn, writeParamsObj);
      });
      viewsTriggeringCallBacks.push(() => {
        queryInstance?.readTrigger && viewTrigger(stores, queryInstance, !!fromRules || !!(stores.kernel.runAllQueries));
      });
    }
    queryInstancesList.push({
      ...queryInstance,
      skip: !!_skip,
    });
  });
}

export const  getQueryPlan = <FnType extends (x: any) => void>({writeFn, writeParamsObj} : {
    writeFn: FnType,
    writeParamsObj: Parameters<FnType>[0]
  }, stores: { kernel: KernelStore } = { kernel: kernelStore }) => {
    const queryPlan: Map<QueryFn, Array<QueryPlanInstance>> = new Map();
    const dataComputationCallBacks: (() => void)[] = [];
    let viewsTriggeringCallBacks: (() => void)[] = [];
    if (!stores.kernel.runAllQueries && stores.kernel.rules.has(writeFn)) { // writeFn has rules
      const queryFnMap = stores.kernel.rules.get(writeFn)!.readersMap;
      if (!!queryFnMap?.size) {
        queryFnMap?.forEach ((skip, queryFn) => {
          addQueryToPlan(stores, queryPlan, dataComputationCallBacks, viewsTriggeringCallBacks, writeParamsObj, queryFn, writeFn, true, skip);
        });
      }
      if (stores.kernel.queries.size > stores.kernel.reverseRules.size) { // collect all queries NOT in any rule
        stores.kernel.queries.forEach((_, queryFn) => {
          if (!stores.kernel.reverseRules.has(queryFn)) {
            // run all queryFn that belong to NO rule
            addQueryToPlan(stores, queryPlan, dataComputationCallBacks, viewsTriggeringCallBacks, writeParamsObj, queryFn, writeFn);
          }          
        });        
      }
    } else if (!isInternal(writeFn)) { // runAllQueries || writeFn has no rules (and not internal) => collect all queryFn
      stores.kernel.queries.forEach((_, queryFn) => {
        addQueryToPlan(stores, queryPlan, dataComputationCallBacks, viewsTriggeringCallBacks, writeParamsObj, queryFn, writeFn);
      });
    }
    const computeData = () => {
      dataComputationCallBacks.forEach((cb: () => void) => cb());
    };
    const triggerViews = () => {
      viewsTriggeringCallBacks.forEach((cb: () => void) => cb());
    };
    return { queryPlan, computeData, triggerViews };
  };
  