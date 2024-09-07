type JSONValue = string | number | boolean | {
    [x: string]: JSONValue;
} | Array<JSONValue>;
type WriteFn = (writeParamsObj: any, stores: {
    [key: string]: JSONValue;
} | any | undefined) => void;
type QueryFn = (readParamsObj: any, stores?: {
    [key: string]: JSONValue;
} | any | undefined) => Object;
type SkipCondition = (writeParamsObj: any, readParamsObj?: any, stores?: {
    [key: string]: JSONValue;
} | any | undefined) => boolean | undefined;
type QueryOptions = {
    cmpId?: string | number;
    hasResultChanged?: (prevData: any, data: any) => boolean;
    debounceMs?: number;
    throttleMs?: number;
    skipInitalQuerying?: boolean;
    [key: string]: any;
};
type Result = {
    version: number;
    data: any;
    prevData: any;
};
type QueryInstance = {
    instanceKey: string | number;
    readTrigger: ((res: Result) => void) | undefined;
    paramsObj: any;
    options: QueryOptions;
    result: Result;
};
interface QueryPlanInstance extends QueryInstance {
    skip: boolean;
}
type OnWriteRule = {
    readersMap: Map<QueryFn, SkipCondition | undefined>;
};

declare class KernelStore {
    runAllQueries: boolean;
    rules: Map<WriteFn, OnWriteRule>;
    reverseRules: Map<QueryFn, Set<WriteFn>>;
    queries: Map<QueryFn, Map<string | number, QueryInstance>>;
    execStack: {
        name: string;
        writeFn: WriteFn;
        writeParamsObj: Parameters<WriteFn>[0];
        queryPlan: Map<QueryFn, QueryPlanInstance[]>;
    }[];
    private static incrCpt;
    private static sessionCpt;
    private static instances;
    constructor({ rules, queries, reverseRules }?: {
        rules: Map<any, any>;
        queries: Map<any, any>;
        reverseRules: Map<any, any>;
    });
    static getAllInstances(): KernelStore[];
    getSortedID: () => string;
}
declare const kernelStore: KernelStore;

declare const getExecStack: (_?: any, stores?: {
    kernel: KernelStore;
}) => {
    name: string;
    writeFn: WriteFn;
    writeParamsObj: Parameters<WriteFn>[0];
    queryPlan: Map<QueryFn, QueryPlanInstance[]>;
}[];
declare const getQueryPlan: <FnType extends (x: any) => void>({ writeFn, writeParamsObj }: {
    writeFn: FnType;
    writeParamsObj: Parameters<FnType>[0];
}, stores?: {
    kernel: KernelStore;
}) => {
    queryPlan: Map<QueryFn, QueryPlanInstance[]>;
    computeData: () => void;
    triggerViews: () => void;
};

declare const addRule: ({ writeFn, queryFn, skip }: {
    writeFn: WriteFn;
    queryFn: QueryFn;
    skip?: SkipCondition | undefined;
}, stores?: {
    kernel: KernelStore;
}) => void;
declare const removeRule: ({ writeFn, queryFn }: {
    writeFn: WriteFn;
    queryFn: QueryFn;
}, stores?: {
    kernel: KernelStore;
}) => void;
declare const clearAllRules: (stores?: {
    kernel: KernelStore;
}) => void;
declare const addQuery: ({ queryFn, queryInstance }: {
    queryFn: QueryFn;
    queryInstance: QueryInstance;
}, stores?: {
    kernel: KernelStore;
}) => QueryInstance;
declare const removeQuery: ({ queryFn, queryInstance }: {
    queryFn: QueryFn;
    queryInstance: QueryInstance;
}, stores?: {
    kernel: KernelStore;
}) => void;
declare const afterWrite: ({ writeFn, writeParamsObj, queryPlan, }: {
    writeFn: WriteFn;
    writeParamsObj: Parameters<WriteFn>[0];
    queryPlan: Map<QueryFn, QueryPlanInstance[]>;
}, stores?: {
    kernel: KernelStore;
}) => void;

declare const getSortedID: () => string;
declare const trigger: <FnType extends (x: any) => void>(writeFn: FnType, writeParamsObj: Parameters<FnType>[0], stores?: {
    kernel: KernelStore;
}) => void;
declare const subscribe: <FnType extends (x: any) => any>(readTrigger: (res: Result) => void, readFn: FnType, paramsObj?: Parameters<FnType>[0], options?: QueryOptions, stores?: {
    kernel: KernelStore;
}) => {
    result: {
        data: any;
        prevData: undefined;
        version: number;
    };
    onMounted: () => void;
    onBeforeUnmount: () => void;
};

export { KernelStore, QueryOptions, Result, addQuery, addRule, afterWrite, clearAllRules, getExecStack, getQueryPlan, getSortedID, kernelStore, removeQuery, removeRule, subscribe, trigger };
