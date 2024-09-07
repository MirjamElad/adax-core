"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  KernelStore: () => KernelStore,
  addQuery: () => addQuery,
  addRule: () => addRule,
  afterWrite: () => afterWrite,
  clearAllRules: () => clearAllRules,
  getExecStack: () => getExecStack,
  getQueryPlan: () => getQueryPlan,
  getSortedID: () => getSortedID,
  kernelStore: () => kernelStore,
  removeQuery: () => removeQuery,
  removeRule: () => removeRule,
  subscribe: () => subscribe,
  trigger: () => trigger
});
module.exports = __toCommonJS(src_exports);

// src/store/index.ts
var _KernelStore = class {
  constructor({ rules, queries, reverseRules } = { rules: /* @__PURE__ */ new Map(), queries: /* @__PURE__ */ new Map(), reverseRules: /* @__PURE__ */ new Map() }) {
    this.runAllQueries = false;
    this.execStack = [];
    this.getSortedID = () => {
      if (!_KernelStore.incrCpt && typeof sessionStorage !== "undefined") {
        _KernelStore.sessionCpt = Number(sessionStorage.getItem("adax-sessionCpt")) || 0;
        sessionStorage.setItem("adax-sessionCpt", `${_KernelStore.sessionCpt + 1}`);
      }
      return `${_KernelStore.sessionCpt}-${(/* @__PURE__ */ new Date()).getTime().toString(36)}-${_KernelStore.incrCpt++}`;
    };
    this.rules = rules;
    this.queries = queries;
    this.reverseRules = reverseRules;
    _KernelStore.instances.push(this);
  }
  static getAllInstances() {
    return _KernelStore.instances;
  }
};
var KernelStore = _KernelStore;
KernelStore.incrCpt = 0;
KernelStore.sessionCpt = 0;
KernelStore.instances = [];
var kernelStore = new KernelStore();

// src/store/write.ts
var addRule = ({ writeFn, queryFn, skip }, stores = { kernel: kernelStore }) => {
  if (!stores.kernel.rules.has(writeFn)) {
    stores.kernel.rules.set(writeFn, { readersMap: /* @__PURE__ */ new Map() });
  }
  const rule = stores.kernel.rules.get(writeFn);
  if (!rule.readersMap.has(queryFn)) {
    rule.readersMap.set(queryFn, skip);
  }
  if (!stores.kernel.reverseRules.has(queryFn)) {
    stores.kernel.reverseRules.set(queryFn, /* @__PURE__ */ new Set());
  }
  const reverseRule = stores.kernel.reverseRules.get(queryFn);
  if (!reverseRule.has(writeFn)) {
    reverseRule.add(writeFn);
  }
};
var removeRule = ({ writeFn, queryFn }, stores = { kernel: kernelStore }) => {
  const rule = stores.kernel.rules.get(writeFn);
  if (rule == null ? void 0 : rule.readersMap.has(queryFn)) {
    rule.readersMap.delete(queryFn);
    if (rule.readersMap.size == 0) {
      stores.kernel.rules.delete(writeFn);
    }
  }
  const reverseRule = stores.kernel.reverseRules.get(queryFn);
  if (reverseRule == null ? void 0 : reverseRule.has(writeFn)) {
    reverseRule.delete(writeFn);
    if (!reverseRule.size) {
      stores.kernel.reverseRules.delete(queryFn);
    }
  }
};
var clearAllRules = (stores = { kernel: kernelStore }) => {
  stores.kernel.rules.clear();
  stores.kernel.reverseRules.clear();
};
var addQuery = ({ queryFn, queryInstance }, stores = { kernel: kernelStore }) => {
  if (!stores.kernel.queries.has(queryFn)) {
    stores.kernel.queries.set(queryFn, /* @__PURE__ */ new Map());
  }
  stores.kernel.queries.get(queryFn).set(queryInstance.instanceKey, queryInstance);
  return queryInstance;
};
var removeQuery = ({ queryFn, queryInstance }, stores = { kernel: kernelStore }) => {
  const instancesList = stores.kernel.queries.get(queryFn);
  if (instancesList) {
    instancesList.delete(queryInstance.instanceKey);
    if (!instancesList.size) {
      stores.kernel.queries.delete(queryFn);
    }
  }
};
var afterWrite = ({
  writeFn,
  writeParamsObj,
  queryPlan
}, stores = { kernel: kernelStore }) => {
  stores.kernel.execStack.push({
    name: writeFn.name,
    writeFn,
    writeParamsObj,
    queryPlan
  });
};

// src/store/utils.ts
var isInternal = (writeFn) => writeFn === afterWrite;
var throttle = (func, wait) => {
  let timeout;
  let lastCall = 0;
  return (...args) => {
    const context = void 0;
    const now = (/* @__PURE__ */ new Date()).getTime();
    const diff = now - lastCall;
    if (diff < wait) {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait - diff);
    } else {
      func.apply(context, args);
    }
    lastCall = now;
  };
};
var debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    const context = void 0;
    const argsArray = Array.prototype.slice.call(args);
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func.apply(context, argsArray);
    }, wait);
  };
};

// src/store/read.ts
var getExecStack = (_ = null, stores = { kernel: kernelStore }) => {
  var _a;
  return ((_a = stores == null ? void 0 : stores.kernel) == null ? void 0 : _a.execStack) || [];
};
var computeData = (queryInstance, queryFn) => {
  queryInstance.result.prevData = queryInstance.result.data;
  queryInstance.result.data = queryFn(queryInstance.paramsObj);
  queryInstance.result.version = queryInstance.result.version + 1;
};
var viewTrigger = (queryInstance) => {
  var _a, _b;
  if (((_a = queryInstance.options) == null ? void 0 : _a.hasResultChanged) ? (_b = queryInstance.options) == null ? void 0 : _b.hasResultChanged(queryInstance.result.prevData, queryInstance.result.data) : true) {
    queryInstance.readTrigger(queryInstance.result);
  }
};
var addQueryToPlan = (stores, queryPlan, dataComputationCallBacks = [], viewsTriggeringCallBacks = [], writeParamsObj, queryFn, skip = void 0) => {
  var _a, _b;
  (_b = (_a = stores.kernel.queries) == null ? void 0 : _a.get(queryFn)) == null ? void 0 : _b.forEach((queryInstance) => {
    if (!(queryInstance == null ? void 0 : queryInstance.readTrigger))
      return;
    if (!queryPlan.has(queryFn)) {
      queryPlan.set(queryFn, new Array());
    }
    const queryInstancesList = queryPlan.get(queryFn);
    const _skip = skip && skip(writeParamsObj, queryInstance.paramsObj);
    queryInstance.result = (queryInstance == null ? void 0 : queryInstance.result) || {
      version: 0,
      data: void 0,
      prevData: void 0
    };
    if (!_skip && (queryInstance == null ? void 0 : queryInstance.readTrigger)) {
      dataComputationCallBacks.push(() => {
        computeData(queryInstance, queryFn);
      });
      viewsTriggeringCallBacks.push(() => {
        (queryInstance == null ? void 0 : queryInstance.readTrigger) && viewTrigger(queryInstance);
      });
    }
    queryInstancesList.push(__spreadProps(__spreadValues({}, queryInstance), {
      skip: !!_skip
    }));
  });
};
var getQueryPlan = ({ writeFn, writeParamsObj }, stores = { kernel: kernelStore }) => {
  const queryPlan = /* @__PURE__ */ new Map();
  const dataComputationCallBacks = [];
  let viewsTriggeringCallBacks = [];
  if (!stores.kernel.runAllQueries && stores.kernel.rules.has(writeFn)) {
    const queryFnMap = stores.kernel.rules.get(writeFn).readersMap;
    if (!!(queryFnMap == null ? void 0 : queryFnMap.size)) {
      queryFnMap == null ? void 0 : queryFnMap.forEach((skip, queryFn) => {
        addQueryToPlan(stores, queryPlan, dataComputationCallBacks, viewsTriggeringCallBacks, writeParamsObj, queryFn, skip);
      });
    }
    if (stores.kernel.queries.size > stores.kernel.reverseRules.size) {
      stores.kernel.queries.forEach((_, queryFn) => {
        if (!stores.kernel.reverseRules.has(queryFn)) {
          addQueryToPlan(stores, queryPlan, dataComputationCallBacks, viewsTriggeringCallBacks, writeParamsObj, queryFn);
        }
      });
    }
  } else if (!isInternal(writeFn)) {
    stores.kernel.queries.forEach((_, queryFn) => {
      addQueryToPlan(stores, queryPlan, dataComputationCallBacks, viewsTriggeringCallBacks, writeParamsObj, queryFn);
    });
  }
  const computeData2 = () => {
    dataComputationCallBacks.forEach((cb) => cb());
  };
  const triggerViews = () => {
    viewsTriggeringCallBacks.forEach((cb) => cb());
  };
  return { queryPlan, computeData: computeData2, triggerViews };
};

// src/index.ts
var getSortedID = kernelStore.getSortedID;
var trigger = (writeFn, writeParamsObj, stores = { kernel: kernelStore }) => {
  const { queryPlan, computeData: computeData2, triggerViews } = getQueryPlan({ writeFn, writeParamsObj }, stores);
  writeFn(writeParamsObj);
  computeData2();
  setTimeout(() => {
    triggerViews();
    if (!isInternal(writeFn)) {
      trigger(afterWrite, { writeFn, writeParamsObj, queryPlan }, stores);
    }
  });
};
var subscribe = (readTrigger, readFn, paramsObj, options = {}, stores = { kernel: kernelStore }) => {
  var _a;
  const cmpId = (_a = options.cmpId) != null ? _a : getSortedID();
  const result = { data: (options == null ? void 0 : options.skipInitalQuerying) ? void 0 : readFn(paramsObj), prevData: void 0, version: 0 };
  let _trigger = readTrigger;
  if (options.debounceMs || options.throttleMs) {
    if (options.debounceMs && options.throttleMs) {
      throw new Error("Cannot have both debounce and throttle options for any given query!");
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
      result
    } }, stores);
  };
  const onBeforeUnmount = () => {
    removeQuery({ queryFn: readFn, queryInstance: {
      // eslint-disable-next-line 
      instanceKey: cmpId,
      readTrigger: void 0,
      paramsObj: paramsObj || {},
      options,
      result: { data: void 0, prevData: void 0, version: 0 }
    } }, stores);
  };
  return { result, onMounted, onBeforeUnmount };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  KernelStore,
  addQuery,
  addRule,
  afterWrite,
  clearAllRules,
  getExecStack,
  getQueryPlan,
  getSortedID,
  kernelStore,
  removeQuery,
  removeRule,
  subscribe,
  trigger
});
