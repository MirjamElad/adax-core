import { trigger, subscribe, addRule, removeRule, clearAllRules, kernelStore, KernelStore, Result } from '../index';
import { deepEqual } from '../store/utils';
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


describe("adax's kernel stores", () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it("KernelStore keeps track of all its instances", async () => {
    const nonDefaultKernelStore = new KernelStore();
    const instancesList = KernelStore.getAllInstances();
    expect(instancesList.length).toEqual(2);
    expect(instancesList[0].isDefaultKernelStore).toEqual(true);
    expect(instancesList[1].isDefaultKernelStore).toEqual(false);
    expect(instancesList[1]).toEqual(nonDefaultKernelStore);
  });
  it("KernelStore getSortedID returns sorted ids", async () => {
    const someKernelStore = KernelStore.getAllInstances()[0];
    const firstId = someKernelStore.getSortedID();
    const secondId = someKernelStore.getSortedID();
    expect(firstId < secondId).toBeTruthy();
  });
});

describe("adax without rules, basics", () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it("Subciptions to queries ONLY fire when query result change", async () => {
    const readTrigger_right_counter = jest.fn(); 
    const readTrigger_right_team = jest.fn();
    const readTrigger_left_counter = jest.fn(); 
    const readTrigger_left_team = jest.fn();
    const readTrigger_all = jest.fn();
    const { on: on_right_counter, off: off_right_counter } = subscribe(readTrigger_right_counter, getCounterByTeam, {team: 'right'});
    const { on: on_right_team, off: off_right_team } = subscribe(readTrigger_right_team, getByTeam, {team: 'right'});
    const { on: on_left_counter, off: off_left_counter } = subscribe(readTrigger_left_counter, getCounterByTeam, {team: 'left'});
    const { on: on_left_team, off: off_left_team } = subscribe(readTrigger_left_team, getByTeam, {team: 'left'});
    const { on: on_all, off: off_all } = subscribe(readTrigger_all, getAll);
    on_right_counter();
    on_right_team();
    on_left_counter();
    on_left_team();
    on_all();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_right_counter).toHaveBeenCalledTimes(1);
    expect(readTrigger_right_team).toHaveBeenCalledTimes(1);
    expect(readTrigger_left_counter).toHaveBeenCalledTimes(0);
    expect(readTrigger_left_team).toHaveBeenCalledTimes(0);
    expect(readTrigger_all).toHaveBeenCalledTimes(1);
    off_right_counter();
    off_right_team();
    off_left_counter();
    off_left_team();
    off_all();
  });

  it("trigger causes ALL mounted queries to fire with proper results", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const { on: on_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { on: on_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    on_1();
    on_2();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
  });

  it("mounting a query more than once has no bearing on how many times it fires", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const { on: on_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { on: on_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    on_1();
    on_1();
    on_1();
    on_2();
    on_2();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
    expect(readTrigger_2).toHaveBeenCalledTimes(0);
  });

  it("trigger causes ONLY mounted queries to fire", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const { on } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { on: on_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'right'});
    on();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
    expect(readTrigger_2).not.toHaveBeenCalled();
  });

  it("trigger does NOT cause UN-MOUNTED queries to fire", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const readTrigger_3 = jest.fn();
    const { on: on_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    // readTrigger with arguments
    const { on: on_2, off: off_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'right'});
    // readTrigger without arguments
    const { on: on_3, off: off_3 } = subscribe(readTrigger_3, getAll);
    on_1();
    on_2();
    on_3();
    off_2();
    off_3();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
    expect(readTrigger_2).not.toHaveBeenCalled();
    expect(readTrigger_3).not.toHaveBeenCalled();
  });

  it("trigger stops causing a query to be fired after that query has been unmounted", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const { on: on_1, off } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { on: on_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'right'});
    on_1();
    on_2();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    //Unmounting first query
    off();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
    expect(readTrigger_2).toHaveBeenCalledTimes(2);
    expect(readTrigger_2).toHaveBeenLastCalledWith({data: 2, prevData: 1, version: 2, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}})
  });

  it("only trigger causes queries to fire", async () => {
    const readTrigger = jest.fn();
    const { on } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    on();
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
    const { on } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    on();
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

  it("We can customize hasResultChanged to determine whether to fire queries or not", async () => {
    const readTrigger_right = jest.fn();
    const readTrigger_left = jest.fn();
    const { on: on_team_right, off: off_1 } = subscribe(readTrigger_right, getByTeam, {team: 'right'}, {
      hasResultChanged: (prevData, data) => false // Never fire right as forcing not changed!
    });
    const { on: on_team_leftt, off: off_2 } = subscribe(readTrigger_left, getByTeam, {team: 'left'}, {
      hasResultChanged: (prevData, data) => true // always fire left as forcing allways as changed!
    });
    on_team_right();
    on_team_leftt();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_right).not.toHaveBeenCalled();
    expect(readTrigger_left).toHaveBeenCalledTimes(1);
    expect(readTrigger_left).toHaveBeenLastCalledWith({
      data: {
        "color": "blue",
        "counter": 0,
      },
      prevData: {
        "color": "blue",
        "counter": 0,
      },
      version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}
    });
    off_1();
    off_2();
  });

  it("trigger unecessary read (second time with no data changes) ensures data == prevData for 'by value' returns", async () => {
    const readTrigger = jest.fn();
    const { on } = subscribe(readTrigger, getCounterByTeam, {team: 'right'}, { hasResultChanged: (prevData, data) => true});
    on();
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
    const { on: on_1 } = subscribe(readTrigger, getCounterByTeam, {team: 'left'});
    const { on: on_2 } = subscribe(readTrigger, getCounterByTeam, {team: 'left'});
    const { on: on_3 } = subscribe(readTrigger, getCounterByTeam, {team: 'left'});
    const { on: on_4 } = subscribe(readTrigger, getByTeam, {team: 'left'});
    on_1();
    on_2();
    on_3();
    on_4();
    trigger(incrementCounterByTeam, {team: 'left'});
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
    const { on: on_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { on: on_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    const { on: on_3 } = subscribe(readTrigger_3, getByTeam, {team: 'right'});
    const { on: on_4 } = subscribe(readTrigger_4, getByTeam, {team: 'left'});
    // The queryFn: getAll below is not in any rules. Thus readTrigger_5 must be called upon any trigger!
    const { on: on_5 } = subscribe(readTrigger_5, getAll);
    on_1();
    on_2();
    on_3();
    on_4();
    on_5();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).not.toHaveBeenCalled();
    expect(readTrigger_2).not.toHaveBeenCalled();
    expect(readTrigger_3).toHaveBeenCalledTimes(1);
    expect(readTrigger_3).toHaveBeenLastCalledWith({data: { color: 'red', counter: 1}, prevData: { color: 'red', counter: 0}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_4).toHaveBeenCalledTimes(1);
    expect(readTrigger_4).toHaveBeenLastCalledWith({data: { color: 'blue', counter: 0}, prevData: { color: 'blue', counter: 0}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_5).toHaveBeenCalledTimes(1);
  });

  it("trigger causes queries NOT in any rule to fire if their results changed", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const readTrigger_3 = jest.fn();
    const readTrigger_4 = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getByTeam});
    ////////// getCounterByTeam is not in any rule! ////////////
    const { on: on_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { on: on_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    ////////////////////////////////////////////////////////////
    const { on: on_3 } = subscribe(readTrigger_3, getByTeam, {team: 'right'});
    const { on: on_4 } = subscribe(readTrigger_4, getByTeam, {team: 'left'});
    on_1();
    on_2();
    on_3();
    on_4();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    ////////// readTrigger_1 is called because getCounterByTeam is not in any rule and its results changed! ////////////
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    ////////// readTrigger_2 is not in any rule but is not called since its results has NOT changed! ////////////
    expect(readTrigger_2).not.toHaveBeenCalled();
    ////////////////////////////////////////////////////////////
    expect(readTrigger_3).toHaveBeenCalledTimes(1);
    expect(readTrigger_3).toHaveBeenLastCalledWith({data: { color: 'red', counter: 1}, prevData: { color: 'red', counter: 0}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    ///////// readTrigger_4 is called although its result has NOT changed because it is in a rule!
    expect(readTrigger_4).toHaveBeenCalledTimes(1);
    expect(readTrigger_4).toHaveBeenLastCalledWith({data: { color: 'blue', counter: 0}, prevData: { color: 'blue', counter: 0}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
  });

  it("Being in an 'unrelated' rule(s), a query will only fire if its result change", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const readTrigger_3 = jest.fn();
    const readTrigger_4 = jest.fn();
    // We have a single rule decrementCounterByTeam -> getByTeam.
    addRule({writeFn: decrementCounterByTeam, queryFn: getByTeam});
    /// incrementCounterByTeam is NOT in ANY rule!
    ////////// getCounterByTeam is not in any rule! ////////////
    const { on: on_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { on: on_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    ////////////////////////////////////////////////////////////
    const { on: on_3 } = subscribe(readTrigger_3, getByTeam, {team: 'right'});
    const { on: on_4 } = subscribe(readTrigger_4, getByTeam, {team: 'left'});
    on_1();
    on_2();
    on_3();
    on_4();
    /// incrementCounterByTeam is NOT in ANY rule
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    ////////// readTrigger_1 called because its result changed and getCounterByTeam is not in any rule! ////////////
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    ////////// readTrigger_1 not called although 
    expect(readTrigger_2).not.toHaveBeenCalled();
    ////////////////////////////////////////////////////////////
    expect(readTrigger_3).toHaveBeenCalledTimes(1);
    expect(readTrigger_3).toHaveBeenLastCalledWith({data: { color: 'red', counter: 1}, prevData: { color: 'red', counter: 0}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_4).not.toHaveBeenCalled();
  });

  it("all subciptions to queries fire regardless of rules if the current kernel's runAllQueries is true", async () => {
    const readTrigger_1 = jest.fn(); 
    const readTrigger_2 = jest.fn();
    const readTrigger_3 = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getByTeam});
    const { on: on_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { on: on_2 } = subscribe(readTrigger_2, getByTeam, {team: 'right'});
    const { on: on_3 } = subscribe(readTrigger_3, getAll);
    on_1();
    on_2();
    on_3();
    //runAllQueries on the default kernelStore to bypass all rules and thus cal all registered query callbacks!
    kernelStore.runAllQueries = true;
    trigger(incrementCounterByTeam, {team: 'left'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_2).toHaveBeenCalledTimes(1);
    expect(readTrigger_3).toHaveBeenCalledTimes(1);
  });

  it("trigger causes all queries in rules to fire (even if not change in results)", async () => {
    const readTrigger_1 = jest.fn();
    const readTrigger_2 = jest.fn();
    const readTrigger_3 = jest.fn();
    const readTrigger_4 = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam});
    addRule({writeFn: incrementCounterByTeam, queryFn: getByTeam});
    const { on: on_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { on: on_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    const { on: on_3 } = subscribe(readTrigger_3, getByTeam, {team: 'right'});
    const { on: on_4 } = subscribe(readTrigger_4, getByTeam, {team: 'left'});
    on_1();
    on_2();
    on_3();
    on_4();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_1).toHaveBeenCalledTimes(1);
    expect(readTrigger_1).toHaveBeenLastCalledWith({data: 1, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_2).toHaveBeenCalledTimes(1);
    expect(readTrigger_2).toHaveBeenLastCalledWith({data: 0, prevData: 0, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_3).toHaveBeenCalledTimes(1);
    expect(readTrigger_3).toHaveBeenLastCalledWith({data: { color: 'red', counter: 1}, prevData: { color: 'red', counter: 0}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
    expect(readTrigger_4).toHaveBeenCalledTimes(1);
    expect(readTrigger_4).toHaveBeenLastCalledWith({data: { color: 'blue', counter: 0}, prevData: { color: 'blue', counter: 0}, version: 1, writeFn: incrementCounterByTeam, writeParamsObj: {team: 'right'}});
  });
  
  it("trigger stops causing queries removed from rules to fire (when triggered writeFn is still in some other rule)", async () => {
    const getCounterByTeamRight = jest.fn();
    const getCounterByTeamLeft = jest.fn();
    addRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam});
    addRule({writeFn: decrementCounterByTeam, queryFn: getCounterByTeam});
    addRule({writeFn: incrementCounterByTeam, queryFn: getByTeam});
    const { on: on_1 } = subscribe(getCounterByTeamRight, getCounterByTeam, {team: 'right'});
    const { on: on_2 } = subscribe(getCounterByTeamLeft, getCounterByTeam, {team: 'left'});
    on_1();
    on_2();
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
    expect(getCounterByTeamRight).toHaveBeenCalledTimes(1);
    expect(getCounterByTeamLeft).toHaveBeenCalledTimes(1);
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
    const { on } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    on();
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
    const { on } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});    
    on();
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
    const { on } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    on();
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
    const { on: on_1 } = subscribe(readTrigger_1, getCounterByTeam, {team: 'right'});
    const { on: on_2 } = subscribe(readTrigger_2, getCounterByTeam, {team: 'left'});
    on_1();
    on_2();
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
    const { on } = subscribe(readTrigger, getByTeam, {team: 'right'});
    on();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result.data).toEqual({ color: 'red',   counter: 1});
    expect(result.prevData).toEqual({ color: 'red',   counter: 0});
    expect(result.version).toEqual(1);
    expect(result.writeFn).toEqual(incrementCounterByTeam);
    expect(result.writeParamsObj).toEqual({team: 'right'});
  });

  it("adax by default, readFn result changes => data !== prevData for NON scalar data", async () => {
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
    const { on } = subscribe(readTrigger, getByTeam, {team: 'right'});
    on();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result.data).toEqual({ color: 'red',   counter: 1});
    expect(result.prevData).toEqual({ color: 'red',   counter: 0});
    expect(result.version).toEqual(1);
    expect(result.writeFn).toEqual(incrementCounterByTeam);
    expect(result.writeParamsObj).toEqual({team: 'right'});
    expect(result.data === result.prevData).not.toBeTruthy();
    expect(deepEqual(result.data, result.prevData)).not.toBeTruthy();
  });

  it("adax by default, readFn result changes => data !== prevData for scalar data", async () => {
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
    const { on } = subscribe(readTrigger, getCounterByTeam, {team: 'right'});
    on();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result.version).toEqual(1);
    expect(result.data).toEqual(1);
    expect(result.prevData).toEqual(0);
    expect(result.writeFn).toEqual(incrementCounterByTeam);
    expect(result.writeParamsObj).toEqual({team: 'right'});
    expect(result.data === result.prevData).not.toBeTruthy();
  });
  
  it('trigger unecessary second read increments version AND now data same as prevData by value by but NOT by "ref"', async () => {
    let result= {data: {}, prevData: {}, version: 0 };
    const readTrigger = ({data, prevData, version}: {data: ColorCounterTuple, prevData: ColorCounterTuple, version: number}) => {
      result.data = data;
      result.prevData = prevData;
      result.version = version;
    };
    const { on } = subscribe(readTrigger, getByTeam, {team: 'right'}, { hasResultChanged:((prevData, data) => true)});
    on();
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    trigger(incrementCounterByTeam, {team: 'left'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result.version).toEqual(2);
    expect(result.data).toEqual({ color: 'red',   counter: 1});
    expect(result.prevData).toEqual({ color: 'red',   counter: 1});
    expect(result.data !== result.prevData).toBeTruthy();
  });

  it('trigger unecessary second read causes data === prevData when data is of scalar type', async () => {
    let result= {data: 0, prevData: 0, version: 0 };
    const readTrigger = ({data, prevData, version}: {data: number, prevData: number, version: number}) => {
      result.data = data;
      result.prevData = prevData;
      result.version = version;
    };
    const { on } = subscribe(readTrigger, getCounterByTeam, {team: 'right'}, { hasResultChanged:((prevData, data) => true)});
    on();
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

  it("trigger unecessary read (second time with no data changes) data !== prevData even as they hold same value", async () => {
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
    const { on } = subscribe(readTrigger, aggregateCounters, undefined, { hasResultChanged:((prevData, data) => true)});
    on();
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
    //trigger NOT causing team right to have a different "computed" data!
    trigger(incrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(result_2.version).toEqual(2);
    expect(result_2.data).toEqual({ total: 1 });
    expect(result_2.prevData).toEqual({ total: 1 });
    expect(result_2.data !== result_2.prevData).toBeTruthy();
  });
});


describe("adax with different kernel stores", () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());
  it("trigger does NOT cause queries in other Kernel Stores to fire", async () => {
    const readTrigger_default = jest.fn();
    const readTrigger_customKernel = jest.fn();
    const nonDefaultKernelStore = new KernelStore();
    const { on: on_0 } = 
      subscribe(readTrigger_default, getCounterByTeam, {team: 'right'});
    const { on: on_1 } = 
      subscribe(readTrigger_default, getCounterByTeam, {team: 'left'});
    const { on: on_2 } = 
      subscribe(readTrigger_customKernel, getCounterByTeam, {team: 'right'}, {}, {kernel: nonDefaultKernelStore});
    const { on: on_3 } = 
      subscribe(readTrigger_customKernel, getCounterByTeam, {team: 'left'}, {}, {kernel: nonDefaultKernelStore});
    on_0();
    on_1();
    on_2();
    on_3();
    trigger(incrementCounterByTeam, {team: 'right'}, {kernel: nonDefaultKernelStore});
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(readTrigger_default).not.toHaveBeenCalled();
    expect(readTrigger_customKernel).toHaveBeenCalledTimes(1);
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

  it("setting a skipInitalQuerying option works", async () => {
    const readTrigger_without_skipInitalQuerying = jest.fn();
    const readTrigger_skipInitalQuerying = jest.fn();    
    const { on: on_0, result: { data: data_0 } } = 
      subscribe(readTrigger_without_skipInitalQuerying, getCounterByTeam, {team: 'right'});
    expect(data_0).toBeDefined();
    const { on: on_1, result: { data: data_1 } } = 
      subscribe(readTrigger_skipInitalQuerying, getCounterByTeam, {team: 'right'}, { skipInitalQuerying: true });
    expect(data_1).not.toBeDefined();
    on_0();
    on_1();
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
    const { on: on_0 } = 
      subscribe(readTrigger_1, getCounterByTeam, {team: 'right'}, { debounceMs: 5, hasResultChanged:((prevData, data) => true) });
    const { on: on_1 } = 
      subscribe(readTrigger_2, getCounterByTeam, {team: 'left'}, { debounceMs: 50, hasResultChanged:((prevData, data) => true) });
    on_0();
    on_1();
    for(let i=0; i <5; i++) {
      trigger(incrementCounterByTeam, {team: 'right'});
    }
    //give 20 ms: plenty of time to a 5 millisecond debounce
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(callNum_2).toEqual(0);
    expect(callNum_1).toEqual(1);
    //give 30+80 ms: plenty of time to a 50 millisecond debounce
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(callNum_2).toEqual(1);
    expect(callNum_1 == callNum_2).toBeTruthy();
  });

  it("setting a debounce option works even when queryFn triggered by different write functions and WITHOUT rules", async () => {
    let callNum = 0;
    const readTrigger = () => {
      callNum++;
    };
    const { on } = subscribe(readTrigger, getCounterByTeam, {team: 'right'}, { debounceMs: 20 });
    on();
    trigger(incrementCounterByTeam, {team: 'right'});
    trigger(decrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(callNum).toEqual(1);
  });
  
  it("setting a debounce option works even when queryFn triggered by different write functions and WITH rules", async () => {
    let callNum = 0;
    const readTrigger = () => {
      callNum++;
    };
    addRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam});
    addRule({writeFn: decrementCounterByTeam, queryFn: getCounterByTeam});
    const { on } = subscribe(readTrigger, getCounterByTeam, {team: 'right'}, { debounceMs: 20 });
    on();
    trigger(incrementCounterByTeam, {team: 'right'});
    trigger(decrementCounterByTeam, {team: 'right'});
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(callNum).toEqual(1);
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
    const { on: on_1 } = 
      subscribe(readTrigger_1, getCounterByTeam, {team: 'right'}, { throttleMs: 10 });
    const { on: on_2 } = 
      subscribe(readTrigger_2, getCounterByTeam, {team: 'left'}, { throttleMs: 20 });
    on_1();
    on_2();
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
  
  it("setting both throttle & debounce options throws an exception", () => {
    expect(() => {
      subscribe(() => {}, getCounterByTeam, {team: 'right'}, { debounceMs: 10, throttleMs: 10 })
    }).toThrow("Cannot have both debounce and throttle options for any given query");
  });
});
