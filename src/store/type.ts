type JSONValue =
  | string
  | number
  | boolean
  | { [x: string]: JSONValue }
  | Array<JSONValue>;
  

export type WriteFn = (
  writeParamsObj: any,
  stores: { [key: string]: JSONValue } | any | undefined
) => void;
export type QueryFn = (
  readParamsObj: any,
  stores?: { [key: string]: JSONValue } | any | undefined
) => Object;
export type SkipCondition = (
  writeParamsObj: any,
  readParamsObj?: any,
  stores?: { [key: string]: JSONValue } | any | undefined
) => boolean | undefined;

export type QueryOptions = {
  cmpId?: string | number;
  hasResultChanged?: (prevData: any, data: any) => boolean;
  // debounce/throttle callBack to query & re-render
  debounceMs?: number;
  throttleMs?: number;
  skipInitalQuerying?: boolean; // if true the "hook" only calls readFn onChange and not on inital call of the hook!
  //We allow adax adapters to pass any extra option!
  [key: string]: any;
};

export type Result = {
  version: number;
  data: any;
  prevData: any;
  writeFn: ((x: any) => void) | undefined;
  writeParamsObj: unknown | undefined;
};

export type QueryInstance = {
  instanceKey: string | number;
  readTrigger: ((res: Result) => void) | undefined;
  paramsObj: any;
  options: QueryOptions;
  result: Result;
};

export interface QueryPlanInstance extends QueryInstance {
  skip: boolean;
}

export type OnWriteRule = {
  readersMap: Map<QueryFn, SkipCondition | undefined>;
};

