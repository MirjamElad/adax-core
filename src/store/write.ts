import {
    WriteFn,
    QueryFn,
    SkipCondition,
    QueryInstance,
    QueryPlanInstance
} from './type';

import { KernelStore, kernelStore } from './index';

export const addRule = ({ writeFn, queryFn, skip }: {
  writeFn: WriteFn,
  queryFn: QueryFn,
  skip?: SkipCondition | undefined
}, stores: { kernel: KernelStore } = { kernel: kernelStore }) => {
  //////////// rules //////////////////////////////////////////////////
  if (!stores.kernel.rules.has(writeFn as any)) {
      stores.kernel.rules.set(writeFn, { readersMap: new Map() });
  }
  const rule = stores.kernel.rules.get(writeFn)!;
  if (!rule.readersMap.has(queryFn)) {
    rule.readersMap.set(queryFn, skip);
  }
  //TODO: Consider enabling an option to automatically recall trigger on queryFn
  //      This, way, queryFn causes a "re-render" whenver rules related to it change!?
  
  //////////// reverseRules //////////////////////////////////////////////////
  if (!stores.kernel.reverseRules.has(queryFn as any)) {
    stores.kernel.reverseRules.set(queryFn, new Set());
  }
  const reverseRule = stores.kernel.reverseRules.get(queryFn)!;
  if (!reverseRule.has(writeFn)) {
    reverseRule.add(writeFn);
  }
  // console.info('rule: ', rule);
  // console.info('reverseRule: ', reverseRule);
};

export const removeRule = ({ writeFn, queryFn}: {
    writeFn: WriteFn,
    queryFn: QueryFn
  }, stores: { kernel: KernelStore } = { kernel: kernelStore }) => {
    const rule = stores.kernel.rules.get(writeFn);
    if (rule?.readersMap.has(queryFn)) {
      rule.readersMap.delete(queryFn);
      if (rule.readersMap.size == 0) {
        stores.kernel.rules.delete(writeFn);
      }
    }
    const reverseRule = stores.kernel.reverseRules.get(queryFn);
    if (reverseRule?.has(writeFn)) {
      reverseRule.delete(writeFn)
      if (!reverseRule.size) {
        stores.kernel.reverseRules.delete(queryFn)
      }
    }
};

export const clearAllRules = (stores: { kernel: KernelStore } = { kernel: kernelStore }) => {
  stores.kernel.rules.clear();
  stores.kernel.reverseRules.clear();
};

export const addQuery: ({queryFn, queryInstance}: {
    queryFn: QueryFn,
    queryInstance: QueryInstance
  }, stores?: { kernel: KernelStore }) => QueryInstance = (
        {queryFn, queryInstance}: {queryFn: QueryFn, queryInstance: QueryInstance}, stores = { kernel: kernelStore }) => {
    if (!stores.kernel.queries.has(queryFn)) {
        stores.kernel.queries.set(queryFn, new Map<string, QueryInstance>());
    }
    stores.kernel.queries.get(queryFn)!.set(queryInstance.instanceKey, queryInstance);
    return queryInstance;
};

export const removeQuery =
    ({queryFn, queryInstance}: {queryFn: QueryFn, queryInstance: QueryInstance}, stores = { kernel: kernelStore }) => {
      const instancesList = stores.kernel.queries.get(queryFn)
      if (instancesList) {
        instancesList.delete(queryInstance.instanceKey);
        if (!instancesList.size) {
          stores.kernel.queries.delete(queryFn)
        }
      }
      
};

export const afterWrite = (
  {
    writeFn,
    writeParamsObj,
    queryPlan,
  }: {
    writeFn: WriteFn;
    writeParamsObj: Parameters<WriteFn>[0];
    queryPlan: Map<QueryFn, QueryPlanInstance[]>;
  }, stores = { kernel: kernelStore }
) => {
  stores.kernel.execStack.push({
    name: writeFn.name,
    writeFn,
    writeParamsObj,
    queryPlan,
  });
};
