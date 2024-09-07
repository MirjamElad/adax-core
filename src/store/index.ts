import {
    WriteFn,
    QueryFn,
    QueryInstance,
    QueryPlanInstance,
    OnWriteRule,
  } from './type';
class KernelStore {
    runAllQueries: boolean = false;
    // What writeFn cause what queryFn to run
    rules: Map<WriteFn, OnWriteRule>;
    reverseRules: Map<QueryFn, Set<WriteFn>>;
    // the actual queries instances to be ran for every QueryFn from the rules!
    queries: Map<QueryFn, Map<string | number, QueryInstance>>;

    execStack: {
        name: string;
        writeFn: WriteFn;
        writeParamsObj: Parameters<WriteFn>[0];
        queryPlan: Map<QueryFn, QueryPlanInstance[]>;
    }[] = [];

    private static incrCpt: number = 0;
    private static sessionCpt: number = 0;
    private static instances: KernelStore[] = [];

    public constructor({rules, queries, reverseRules} = {rules: new Map(), queries: new Map(), reverseRules: new Map()}) {
        this.rules = rules;
        this.queries = queries;
        this.reverseRules = reverseRules;
        KernelStore.instances.push(this);
    }

    static getAllInstances(): KernelStore[] {
        return KernelStore.instances;
    }

    public getSortedID = () => {
        if(!KernelStore.incrCpt && typeof sessionStorage !== 'undefined') {
            KernelStore.sessionCpt = Number(sessionStorage.getItem('adax-sessionCpt')) || 0;
            sessionStorage.setItem('adax-sessionCpt', `${KernelStore.sessionCpt+1}`);
        }
        return `${KernelStore.sessionCpt}-${new Date().getTime().toString(36)}-${KernelStore.incrCpt++}`;
    }
}

export const kernelStore = new KernelStore();

export { KernelStore };