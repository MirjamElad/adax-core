import { trigger, subscribe, addRule, removeRule, clearAllRules, kernelStore, KernelStore, Result } from '../index';

type ColorCounterTuple = {
  counter: number,
  color: 'red' | 'blue'
}
type TestStore = {
  right: ColorCounterTuple,
  left: ColorCounterTuple
}

const testStore: TestStore = {
  right:  { color: 'red',   counter: 0},
  left:   { color: 'blue',  counter: 0}
};

const resetStore = (store: TestStore = testStore) => {
  store['right'].counter = 0;
  store['left'].counter = 0;
};

const getAll = (_: any = null,  stores = { testStore }) => (testStore);

const getByTeam: ({team}: {team: 'right' | 'left'},  stores?: {testStore: TestStore}) => ColorCounterTuple = 
  ({team}: {team: 'right' | 'left'} = {team: 'right'},  stores = { testStore }) => testStore[team];

const getCounterByTeam: ({team}: {team: 'right' | 'left'},  stores?: {testStore: TestStore}) => number  = 
  ({team}: {team: 'right' | 'left'} = {team: 'right'},  stores = { testStore }) => (testStore[team]?.counter || 0);

const aggregateCounters = (_: any = null,  stores = { testStore }) => 
    ({total: testStore['right'].counter + testStore['left'].counter});

const incrementCounterByTeam: ({team}: {team: 'right' | 'left'},  stores?: {testStore: TestStore}) => void  = 
  ({team}: {team: 'right' | 'left'} = {team: 'right'},  stores = { testStore }) => testStore[team] && testStore[team].counter++;

const decrementCounterByTeam: ({team}: {team: 'right' | 'left'},  stores?: {testStore: TestStore}) => void  =
  ({team}: {team: 'right' | 'left'} = {team: 'right'},  stores = { testStore }) => testStore[team] && testStore[team].counter--;

describe("adax without rules, basics", () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it("trigger causes ALL mounted queries to fire with proper results", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const { onMounted: onMounted_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    onMounted_1();
    onMounted_2();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
    expect(readTrigger_2).toHaveBeenCalledTimes(1);
    expect(readTrigger_2).toHaveBeenLastCalledWith({data: 0, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
  });

  it("mounting a query more than once has no bearing on how many times it fires", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const { onMounted: onMounted_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    onMounted_1();
    onMounted_1();
    onMounted_1();
    onMounted_2();
    onMounted_2();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
    expect(readTrigger_2).toHaveBeenCalledTimes(1);
    expect(readTrigger_2).toHaveBeenLastCalledWith({data: 0, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
  });

  it("trigger causes ONLY mounted queries to fire", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const { onMounted } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'right'});
    onMounted();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
    expect(readTrigger_2).not.toHaveBeenCalled();
  });

  it("trigger does NOT cause UN-MOUNTED queries to fire", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const { onMounted: onMounted_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2, onBeforeUnmount } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    onMounted_1();
    onMounted_2();
    onBeforeUnmount();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
    expect(readTrigger_2).not.toHaveBeenCalled();
  });

  it("trigger stops causing a query to be fired after that query has been unmounted", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const { onMounted: onMounted_1, onBeforeUnmount } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    onMounted_1();
    onMounted_2();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //Unmounting first query
    onBeforeUnmount();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
    expect(readTrigger_2).toHaveBeenCalledTimes(2);
    expect(readTrigger_2).toHaveBeenLastCalledWith({data: 0, prevData: 0, version: 2, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
  });

  it("only trigger causes queries to fire", async () => {
    const readTrigger = jest.fn();
    const { onMounted } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    onMounted();
    //No trigger!!
    incrementCounterByTeam({team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //first trigger
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //No trigger!!
    incrementCounterByTeam({team: 'right'});
    //second trigger
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //No trigger!!
    incrementCounterByTeam({team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger).toHaveBeenCalledTimes(2);
  });

  it("Non trigger calls only cause data to change (not prevData nor version)", async () => {
    const readTrigger = jest.fn();
    const { onMounted } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    onMounted();
    //No trigger!!
    incrementCounterByTeam({team: 'right'});
    //No trigger!!
    incrementCounterByTeam({team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //trigger
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger).toHaveBeenLastCalledWith({data: 3, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
  });

  it("trigger unecessary read (second time with no data changes) ensures data == prevData for 'by value' returns", async () => {
    const readTrigger = jest.fn();
    const { onMounted } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    onMounted();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //trigger NOT causing team right to have a different data!
    trigger(incrementCounterByTeam, {team: 'left'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger).toHaveBeenCalledTimes(2);
    expect(readTrigger).toHaveBeenLastCalledWith({data: 1, prevData: 1, version: 2, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'left'}});
  });
  
  it("Subscribing to query n-times, then launchign proper trigger causes call back to fire n-times", async () => {
    const readTrigger = jest.fn();
    const { onMounted: onMounted_1 } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(readTrigger, getCounterByTeam, {team: 'left'});
    const { onMounted: onMounted_3 } = subscribe(readTrigger, getCounterByTeam, {team: 'left'});
    const { onMounted: onMounted_4 } = subscribe(readTrigger, getByTeam, {team: 'left'});
    onMounted_1();
    onMounted_2();
    onMounted_3();
    onMounted_4();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger).toHaveBeenCalledTimes(4);
  });
});


describe("adax with rules, basics", () => {
  beforeEach(() =>{
    resetStore();
    kernelStore.runAllQueries = false;
    clearAllRules();
  });
  afterEach(() =>{
    resetStore();
    kernelStore.runAllQueries = false;
    clearAllRules();
  });

  it("trigger causes only queries in relevant rules to fire", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const readTrigger_3 = jest.fn();
    const readTrigger_4 = jest.fn();
    const readTrigger_5 = jest.fn();
    const dummyWriteFn = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getByTeam});
    addRule({writeFn: dummyWriteFn, queryFn: getCounterByTeam});
    const { onMounted: onMounted_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    const { onMounted: onMounted_3 } = subscribe(readTrigger_3, getByTeam, {team: 'right'});
    const { onMounted: onMounted_4 } = subscribe(readTrigger_4, getByTeam, {team: 'left'});
    // The queryFn: getAll below is not in any rules. Thus readTrigger_5 must be called upon any trigger!
    const { onMounted: onMounted_5 } = subscribe(readTrigger_5, getAll);
    onMounted_1();
    onMounted_2();
    onMounted_3();
    onMounted_4();
    onMounted_5();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).not.toHaveBeenCalled();
    expect(readTrigger_2).not.toHaveBeenCalled();
    expect(readTrigger_3).toHaveBeenCalledTimes(1);
    expect(readTrigger_3).toHaveBeenLastCalledWith({data: { color: 'red', counter: 1}, prevData: { color: 'red', counter: 1}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_4).toHaveBeenCalledTimes(1);
    expect(readTrigger_4).toHaveBeenLastCalledWith({data: { color: 'blue', counter: 0}, prevData: { color: 'blue', counter: 0}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_5).toHaveBeenCalledTimes(1);
  });

  it("trigger causes queries NOT in any rule to fire", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const readTrigger_3 = jest.fn();
    const readTrigger_4 = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getByTeam});
    ////////// getCounterByTeam is not in any rule! ////////////
    const { onMounted: onMounted_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    ////////////////////////////////////////////////////////////
    const { onMounted: onMounted_3 } = subscribe(readTrigger_3, getByTeam, {team: 'right'});
    const { onMounted: onMounted_4 } = subscribe(readTrigger_4, getByTeam, {team: 'left'});
    onMounted_1();
    onMounted_2();
    onMounted_3();
    onMounted_4();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    ////////// readTrigger_1 & readTrigger_2 are called because getCounterByTeam is not in any rule! ////////////
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_2).toHaveBeenCalledTimes(1);
    expect(readTrigger_2).toHaveBeenLastCalledWith({data: 0, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    ////////////////////////////////////////////////////////////
    expect(readTrigger_3).toHaveBeenCalledTimes(1);
    expect(readTrigger_3).toHaveBeenLastCalledWith({data: { color: 'red', counter: 1}, prevData: { color: 'red', counter: 1}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_4).toHaveBeenCalledTimes(1);
    expect(readTrigger_4).toHaveBeenLastCalledWith({data: { color: 'blue', counter: 0}, prevData: { color: 'blue', counter: 0}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
  });

  it("triggering a writeFn that is NOT in any rule causes ALL queries (regardless if they are in rules or not) to fire", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const readTrigger_3 = jest.fn();
    const readTrigger_4 = jest.fn();
    // We have a single rule decrementCounterByTeam -> getByTeam.
    addRule({writeFn: decrementCounterByTeam, queryFn: getByTeam});
    /// incrementCounterByTeam is NOT in ANY rule!
    ////////// getCounterByTeam is not in any rule! ////////////
    const { onMounted: onMounted_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    ////////////////////////////////////////////////////////////
    const { onMounted: onMounted_3 } = subscribe(readTrigger_3, getByTeam, {team: 'right'});
    const { onMounted: onMounted_4 } = subscribe(readTrigger_4, getByTeam, {team: 'left'});
    onMounted_1();
    onMounted_2();
    onMounted_3();
    onMounted_4();
    /// incrementCounterByTeam is NOT in ANY rule
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    ////////// readTrigger_1 & readTrigger_2 are called because getCounterByTeam is not in any rule! ////////////
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_2).toHaveBeenCalledTimes(1);
    expect(readTrigger_2).toHaveBeenLastCalledWith({data: 0, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    ////////////////////////////////////////////////////////////
    expect(readTrigger_3).toHaveBeenCalledTimes(1);
    expect(readTrigger_3).toHaveBeenLastCalledWith({data: { color: 'red', counter: 1}, prevData: { color: 'red', counter: 1}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_4).toHaveBeenCalledTimes(1);
    expect(readTrigger_4).toHaveBeenLastCalledWith({data: { color: 'blue', counter: 0}, prevData: { color: 'blue', counter: 0}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
  });

  it("all subciptions to queries fire regardless of rules if the current kernel's runAllQueries is true", async () => {
    const readTrigger_1 = jest.fn(); 
    const readTrigger_2 = jest.fn();
    const readTrigger_3 = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getByTeam});
    const { onMounted: onMounted_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(readTrigger_2, getByTeam, {team: 'right'});
    const { onMounted: onMounted_3 } = subscribe(readTrigger_3, getAll);
    onMounted_1();
    onMounted_2();
    onMounted_3();
    //runAllQueries on the default kernelStore to bypass all rules and thus cal all registered query callbacks!
    kernelStore.runAllQueries = true;
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_2).toHaveBeenCalledTimes(1);
    expect(readTrigger_3).toHaveBeenCalledTimes(1);
  });

  it("trigger causes all queries in rules to fire", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const readTrigger_3 = jest.fn();
    const readTrigger_4 = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam});
    addRule({writeFn: incrementCounterByTeam, queryFn: getByTeam});
    const { onMounted: onMounted_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    const { onMounted: onMounted_3 } = subscribe(readTrigger_3, getByTeam, {team: 'right'});
    const { onMounted: onMounted_4 } = subscribe(readTrigger_4, getByTeam, {team: 'left'});
    onMounted_1();
    onMounted_2();
    onMounted_3();
    onMounted_4();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_2).toHaveBeenCalledTimes(1);
    expect(readTrigger_2).toHaveBeenLastCalledWith({data: 0, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_3).toHaveBeenCalledTimes(1);
    expect(readTrigger_3).toHaveBeenLastCalledWith({data: { color: 'red', counter: 1}, prevData: { color: 'red', counter: 1}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_4).toHaveBeenCalledTimes(1);
    expect(readTrigger_4).toHaveBeenLastCalledWith({data: { color: 'blue', counter: 0}, prevData: { color: 'blue', counter: 0}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
  });
  
  it("trigger stops causing queries removed from rules to fire", async () => {
    const getCounterByTeamRight = jest.fn();
    const getCounterByTeamLeft = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam});
    addRule({writeFn: decrementCounterByTeam, queryFn: getCounterByTeam});
    addRule({writeFn: incrementCounterByTeam, queryFn: getByTeam});
    const { onMounted: onMounted_1 } = subscribe(getCounterByTeamRight, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(getCounterByTeamLeft, getCounterByTeam, {team: 'left'});
    onMounted_1();
    onMounted_2();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(getCounterByTeamRight).toHaveBeenCalledTimes(1);
    expect(getCounterByTeamLeft).toHaveBeenCalledTimes(1);
    expect(getCounterByTeamRight).toHaveBeenLastCalledWith({data: 1, prevData:0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(getCounterByTeamLeft).toHaveBeenLastCalledWith({data: 0, prevData:0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    //removing the rule for getCounterByTeam but adding another rule not have empty rules ( when zero rules: ALL queries are called!)
    removeRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam});
    //////////////////////////////////////////////////////////////////////////
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(getCounterByTeamRight).toHaveBeenLastCalledWith({data: 1, prevData:0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(getCounterByTeamLeft).toHaveBeenLastCalledWith({data: 0, prevData:0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});

    addRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam})
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(getCounterByTeamRight).toHaveBeenLastCalledWith({data: 3, prevData:1, version: 2, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(getCounterByTeamLeft).toHaveBeenLastCalledWith({data: 0, prevData:0, version: 2, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
  });

  it("only trigger causes queries to fire", async () => {
    const readTrigger = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam});
    const { onMounted } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    onMounted();
    //No trigger!!
    incrementCounterByTeam({team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //first trigger
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //No trigger!!
    incrementCounterByTeam({team: 'right'});
    //second trigger
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //No trigger!!
    incrementCounterByTeam({team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger).toHaveBeenCalledTimes(2);
  });

  it("Non trigger calls only cause data to change (not prevData nor version)", async () => {
    const readTrigger = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam});
    const { onMounted } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});    
    onMounted();
    //No trigger!!
    incrementCounterByTeam({team: 'right'});
    //No trigger!!
    incrementCounterByTeam({team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //trigger
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger).toHaveBeenLastCalledWith({data: 3, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
  });

  it("trigger unecessary read (second time with no data changes) ensures data == prevData for 'by value' returns", async () => {
    const readTrigger = jest.fn();    
    addRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam});
    const { onMounted } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    onMounted();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //trigger NOT causing team right to have a different data!
    trigger(incrementCounterByTeam, {team: 'left'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger).toHaveBeenCalledTimes(2);
    expect(readTrigger).toHaveBeenLastCalledWith({data: 1, prevData: 1, version: 2, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'left'}});
  });
  
  it("trigger can skip queries in rules to fire", async () => {
    const irrelevantTeams = (writeArg: {team: string}, readArg: {team: string}) =>
      writeArg.team != readArg.team;
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam, skip: irrelevantTeams});
    const { onMounted: onMounted_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    onMounted_1();
    onMounted_2();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_2).not.toHaveBeenCalled();
  });
});

describe("adax by default, queries return expected data, prevData & version", () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());
  it("adax's subscribtion returns expected result (data, prevData, version, writeFn & writeParamsObj)", async () => {
    let result: Result = {data: {}, prevData: {}, version: 0, writeFn: undefined, writeParamsObj: undefined };
    const readTrigger = ({data, prevData, version, writeFn, writeParamsObj}:{
        data: ColorCounterTuple, 
        prevData: ColorCounterTuple, 
        version: number,
        writeFn: ((x: any) => void) | undefined,
        writeParamsObj: unknown | undefined
      }) => {
      result.data = data;
      result.prevData = prevData;
      result.version = version;
      result.writeFn = writeFn;
      result.writeParamsObj = writeParamsObj;
    };
    const { onMounted } = subscribe(readTrigger, getByTeam, {team: 'right'});
    onMounted();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result.data).toEqual({ color: 'red',   counter: 1});
    expect(result.prevData).toEqual({ color: 'red',   counter: 1});
    expect(result.version).toEqual(1);
    expect(result.writeFn).toEqual(incrementCounterByTeam);
    expect(result.writeParamsObj).toEqual({team: 'right'});
  });

  it("adax by default, data === prevData for 'by reference' truthy", async () => {
    let result: Result = {data: {}, prevData: {}, version: 0, writeFn: undefined, writeParamsObj: undefined };
    const readTrigger = ({data, prevData, version, writeFn, writeParamsObj}:{
        data: ColorCounterTuple, 
        prevData: ColorCounterTuple, 
        version: number,
        writeFn: ((x: any) => void) | undefined,
        writeParamsObj: unknown | undefined
      }) => {
      result.data = data;
      result.prevData = prevData;
      result.version = version;
      result.writeFn = writeFn;
      result.writeParamsObj = writeParamsObj;
    };
    const { onMounted } = subscribe(readTrigger, getByTeam, {team: 'right'});
    onMounted();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result.data).toEqual({ color: 'red',   counter: 1});
    expect(result.prevData).toEqual({ color: 'red',   counter: 1});
    expect(result.version).toEqual(1);
    expect(result.writeFn).toEqual(incrementCounterByTeam);
    expect(result.writeParamsObj).toEqual({team: 'right'});
    expect(result.data === result.prevData).toBeTruthy();
  });

  it("adax by default, data === prevData for 'by value' NOT truthy", async () => {
    let result: Result = {data: {}, prevData: {}, version: 0, writeFn: undefined, writeParamsObj: undefined };
    const readTrigger = ({data, prevData, version, writeFn, writeParamsObj}:{
      data: ColorCounterTuple, 
      prevData: ColorCounterTuple, 
      version: number,
      writeFn: ((x: any) => void) | undefined,
      writeParamsObj: unknown | undefined
    }) => {
      result.data = data;
      result.prevData = prevData;
      result.version = version;
      result.writeFn = writeFn;
      result.writeParamsObj = writeParamsObj;
    };
    const { onMounted } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    onMounted();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result.version).toEqual(1);
    expect(result.data).toEqual(1);
    expect(result.prevData).toEqual(0);
    expect(result.writeFn).toEqual(incrementCounterByTeam);
    expect(result.writeParamsObj).toEqual({team: 'right'});
    expect(result.data === result.prevData).not.toBeTruthy();
  });

  it("adax by default, data !== prevData for 'aggregate' returns ", async () => {
    let result_1: Result = {data: { total: 0 }, prevData: { total: 0 }, version: 0 , writeFn: undefined, writeParamsObj: undefined };
    let result_2: Result = {data: { total: 0 }, prevData: { total: 0 }, version: 0 , writeFn: undefined, writeParamsObj: undefined };
    let result_1_computed = false;
    const readTrigger = ({data, prevData, version}: {data: { total:number }, prevData: { total:number }, version: number}) => {
      if (!result_1_computed) {
        result_1.data = data;
        result_1.prevData = prevData;
        result_1.version = version;
        result_1_computed = true;
      } else {        
        result_2.data = data;
        result_2.prevData = prevData;
        result_2.version = version;
      }
    };
    const { onMounted } = subscribe(readTrigger, aggregateCounters);
    onMounted();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result_1.version).toEqual(1);
    expect(result_1.data).toEqual({ total: 1 });
    expect(result_1.prevData).toEqual({ total: 0 });
    expect(result_1.data).not.toEqual(result_1.prevData);
    expect(result_1.data === result_1.prevData).not.toBeTruthy();
    //Now we decrement without triggering a read!
    decrementCounterByTeam({team: 'right'});
    incrementCounterByTeam({team: 'right'});
    decrementCounterByTeam({team: 'right'});
    //Now we increment to get similar results as in first phase
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result_2.version).toEqual(2);
    expect(result_2.data).toEqual({ total: 1 });
    expect(result_2.prevData).toEqual({ total: 1 });
    expect(result_2.data).toEqual(result_2.prevData);
    //Note how data !== prevData even if equivalent (not by ref then not same object!)
    expect(result_2.data !== result_2.prevData).toBeTruthy();
  });
  
  it("trigger unecessary read (second time with no data changes) data === prevData for 'by reference' truthy", async () => {
    let result= {data: {}, prevData: {}, version: 0 };
    const readTrigger = ({data, prevData, version}: {data: ColorCounterTuple, prevData: ColorCounterTuple, version: number}) => {
      result.data = data;
      result.prevData = prevData;
      result.version = version;
    };
    const { onMounted } = subscribe(readTrigger, getByTeam, {team: 'right'});
    onMounted();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    trigger(incrementCounterByTeam, {team: 'left'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result.data).toEqual({ color: 'red',   counter: 1});
    expect(result.prevData).toEqual({ color: 'red',   counter: 1});
    expect(result.version).toEqual(2);
    expect(result.data === result.prevData).toBeTruthy();
  });

  it("trigger unecessary read (second time with no data changes) data === prevData for 'by value' truthy", async () => {
    let result= {data: 0, prevData: 0, version: 0 };
    const readTrigger = ({data, prevData, version}: {data: number, prevData: number, version: number}) => {
      result.data = data;
      result.prevData = prevData;
      result.version = version;
    };
    const { onMounted } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    onMounted();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //trigger NOT causing team right to have a different data!
    trigger(incrementCounterByTeam, {team: 'left'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result.version).toEqual(2);
    expect(result.data).toEqual(1);
    expect(result.prevData).toEqual(1);
    expect(result.data === result.prevData).toBeTruthy();
  });

  it("trigger unecessary read (second time with no data changes) data !== prevData", async () => {
    let result_1 = {data: { total: 0 }, prevData: { total: 0 }, version: 0 };
    let result_2 = {data: { total: 0 }, prevData: { total: 0 }, version: 0 };
    let result_1_computed = false;
    const readTrigger = ({data, prevData, version}: {data: { total:number }, prevData: { total:number }, version: number}) => {
      if (!result_1_computed) {
        result_1.data = data;
        result_1.prevData = prevData;
        result_1.version = version;
        result_1_computed = true;
      } else {        
        result_2.data = data;
        result_2.prevData = prevData;
        result_2.version = version;
      }
    };
    const { onMounted } = subscribe(readTrigger, aggregateCounters);
    onMounted();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result_1.version).toEqual(1);
    expect(result_1.data).toEqual({ total: 1 });
    expect(result_1.prevData).toEqual({ total: 0 });
    expect(result_1.data).not.toEqual(result_1.prevData);
    expect(result_1.data === result_1.prevData).not.toBeTruthy();
    //decrement to undo previous increment
    decrementCounterByTeam({team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //trigger NOT causing team right to have a different "compoted" data!
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result_2.version).toEqual(2);
    expect(result_2.data).toEqual({ total: 1 });
    expect(result_2.prevData).toEqual({ total: 1 });
    expect(result_2.data).toEqual(result_2.prevData);
    //Note how data !== prevData even if equivalent (not by ref then not same object!)
    expect(result_2.data !== result_2.prevData).toBeTruthy();
  });
});


describe("adax with different kernel stores", () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());
  it("trigger does NOT cause queries in other Kernel Stores to fire", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const nonDefaultKernelStore = new KernelStore();
    const { onMounted: onMounted_0 } = 
      subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_1 } = 
      subscribe(readTrigger_1, getCounterByTeam, {team: 'left'});
    const { onMounted: onMounted_2 } = 
      subscribe(readTrigger_2, getCounterByTeam, {team: 'right'}, {}, {kernel: nonDefaultKernelStore});
    const { onMounted: onMounted_3 } = 
      subscribe(readTrigger_2, getCounterByTeam, {team: 'left'}, {}, {kernel: nonDefaultKernelStore});
    onMounted_0();
    onMounted_1();
    onMounted_2();
    onMounted_3();
    trigger(incrementCounterByTeam, {team: 'right'}, {kernel: nonDefaultKernelStore});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).not.toHaveBeenCalled();
    expect(readTrigger_2).toHaveBeenCalledTimes(2);
  });
});


describe("adax with options", () => {
  beforeEach(() =>{
    resetStore();
    clearAllRules();
  });
  afterEach(() =>{
    resetStore();
    clearAllRules();
  });
  //skipInitalQuerying. comment to try n publish to npm
  it("setting a skipInitalQuerying option works", async () => {
    const readTrigger_without_skipInitalQuerying = jest.fn();
    const readTrigger_skipInitalQuerying = jest.fn();    
    const { onMounted: onMounted_0 } = 
      subscribe(readTrigger_without_skipInitalQuerying, getCounterByTeam, {team: 'right'});
    const { onMounted: onMounted_1 } = 
      subscribe(readTrigger_skipInitalQuerying, getCounterByTeam, {team: 'right'}, { skipInitalQuerying: true });
    onMounted_0();
    onMounted_1();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_without_skipInitalQuerying).toHaveBeenCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    // prevData: undefine // because function only called onChange and NOT initially
    expect(readTrigger_skipInitalQuerying).toHaveBeenCalledWith({data: 1, prevData: undefined, version: 1+0, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
  });

  it("setting a debounce option works", async () => {
    let callNum_1 = 0;
    let callNum_2 = 0;
    const readTrigger_1 = () => {
      callNum_1++;
    };
    const readTrigger_2 = () => {
      callNum_2++;
    };
    const { onMounted: onMounted_0 } = 
      subscribe(readTrigger_1, getCounterByTeam, {team: 'right'}, { debounceMs: 5 });
    const { onMounted: onMounted_1 } = 
      subscribe(readTrigger_2, getCounterByTeam, {team: 'left'}, { debounceMs: 50 });
    onMounted_0();
    onMounted_1();
    for(let i=0; i <10; i++) {
      trigger(incrementCounterByTeam, {team: 'right'});
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    //give 20 ms: plenty of time to a 5 millisecond debounce
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(callNum_2).toEqual(0);
    expect(callNum_1).toEqual(1);
    //give 20+80 ms: plenty of time to a 50 millisecond debounce
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(callNum_2).toEqual(1);
    expect(callNum_1 == callNum_2).toBeTruthy();
  });
  
  it("setting a throttling option works", async () => {
    let callNum_1 = 0;
    let callNum_2 = 0;
    const readTrigger_1 = () => {
      callNum_1++;
    };
    const readTrigger_2 = () => {
      callNum_2++;
    };
    const { onMounted: onMounted_1 } = 
      subscribe(readTrigger_1, getCounterByTeam, {team: 'right'}, { throttleMs: 10 });
    const { onMounted: onMounted_2 } = 
      subscribe(readTrigger_2, getCounterByTeam, {team: 'left'}, { throttleMs: 20 });
    onMounted_1();
    onMounted_2();
    const start = performance.now();
    for(let i=0; i< 50; i++) {
      trigger(incrementCounterByTeam, {team: 'right'});
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    const timeInMilliseconds = performance.now() - start;
    //give plenty of time for both to catch up!
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(callNum_1 > callNum_2).toBeTruthy();
    expect(callNum_1 <= Math.floor(timeInMilliseconds/10)).toBeTruthy();
    expect(callNum_2 <= Math.floor(timeInMilliseconds/20)).toBeTruthy();
  });
});
