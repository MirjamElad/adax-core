import { trigger, useSync, addRule, removeRule, clearAllRules, kernelStore, KernelStore, Result } from '../index';
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

const getAll = (_: any = null,  stores = { testStore }) => (stores.testStore);

const getByTeam: ({team}: {team: 'right' | 'left'},  stores?: {testStore: TestStore}) => ColorCounterTuple = 
  ({team}: {team: 'right' | 'left'} = {team: 'right'},  stores = { testStore }) => stores.testStore[team];

const getCounterByTeam: ({team}: {team: 'right' | 'left'},  stores?: {testStore: TestStore}) => number  = 
  ({team}: {team: 'right' | 'left'} = {team: 'right'},  stores = { testStore }) => (stores.testStore[team]?.counter || 0);

const aggregateCounters = (_: any = null,  stores = { testStore }) => 
    ({total: stores.testStore['right'].counter + stores.testStore['left'].counter});

const incrementCounterByTeam: ({team}: {team: 'right' | 'left'},  stores?: {testStore: TestStore}) => void  = 
  ({team}: {team: 'right' | 'left'} = {team: 'right'},  stores = { testStore }) => stores.testStore[team] && stores.testStore[team].counter++;

const decrementCounterByTeam: ({team}: {team: 'right' | 'left'},  stores?: {testStore: TestStore}) => void  =
  ({team}: {team: 'right' | 'left'} = {team: 'right'},  stores = { testStore }) => stores.testStore[team] && stores.testStore[team].counter--;


describe('useSync WITHOUT rules', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it("useSync causes ALL queries to immediately fire with query's initial data results", async () => {
      const readTrigger_1 = jest.fn();
      const readTrigger_2 = jest.fn();
      const off = useSync(({ data }) => readTrigger_1(data), getCounterByTeam, {team: 'right'});
      const off_2 = useSync(({ data }) => readTrigger_2(data), getCounterByTeam, {team: 'left'});
      expect(readTrigger_1).toHaveBeenCalledTimes(1);
      expect(readTrigger_1).toHaveBeenLastCalledWith(0)
      expect(readTrigger_2).toHaveBeenCalledTimes(1);
      expect(readTrigger_2).toHaveBeenLastCalledWith(0)
      off();
      off_2();
    });
  
    it("useSync causes ALL readTrigger to immediately fire with query's updated data results", async () => {
      const readTrigger_1 = jest.fn();
      const readTrigger_2 = jest.fn();
      //Incrementing counter without trigger!
      incrementCounterByTeam({team: 'right'})
      const off = useSync(({ data }) => readTrigger_1(data), getCounterByTeam, {team: 'right'});
      const off_2 = useSync(({ data }) => readTrigger_2(data), getCounterByTeam, {team: 'left'});
      expect(readTrigger_1).toHaveBeenCalledTimes(1);
      expect(readTrigger_1).toHaveBeenLastCalledWith(1)
      expect(readTrigger_2).toHaveBeenCalledTimes(1);
      expect(readTrigger_2).toHaveBeenLastCalledWith(0)
      off();
      off_2();
    });
  
    it("useSync causes readTrigger to re-run when resulting data changes", async () => {
      const readTrigger = jest.fn();
      const off = useSync(({ data }) => readTrigger(data), getCounterByTeam, {team: 'right'});
      expect(readTrigger).toHaveBeenCalledTimes(1);
      expect(readTrigger).toHaveBeenLastCalledWith(0);
      trigger(incrementCounterByTeam, {team: 'right'});
      await new Promise(resolve => setTimeout(resolve, 2));
      expect(readTrigger).toHaveBeenCalledTimes(2);
      expect(readTrigger).toHaveBeenLastCalledWith(1);
      off();
    });

    it("useSync does NOT cause readTrigger to re-run when resulting data changes", async () => {
      const readTrigger = jest.fn();
      const off = useSync(({ data }) => readTrigger(data), getCounterByTeam, {team: 'right'});
      expect(readTrigger).toHaveBeenCalledTimes(1);
      expect(readTrigger).toHaveBeenLastCalledWith(0);
      trigger(incrementCounterByTeam, {team: 'left'});
      await new Promise(resolve => setTimeout(resolve, 2));
      expect(readTrigger).toHaveBeenCalledTimes(1);
      expect(readTrigger).toHaveBeenLastCalledWith(0);
      off();
    });
});


describe('useSync WITH rules', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

    it("useSync causes readTrigger to re-run due to rules regardless of data changes", async () => {
      addRule({writeFn: incrementCounterByTeam, queryFn: getCounterByTeam});
      const readTrigger = jest.fn();
      const off = useSync(({ data }) => readTrigger(data), getCounterByTeam, {team: 'right'});
      expect(readTrigger).toHaveBeenCalledTimes(1);
      expect(readTrigger).toHaveBeenLastCalledWith(0);
      trigger(incrementCounterByTeam, {team: 'right'});
      await new Promise(resolve => setTimeout(resolve, 2));
      expect(readTrigger).toHaveBeenCalledTimes(2);
      expect(readTrigger).toHaveBeenLastCalledWith(1);
      trigger(incrementCounterByTeam, {team: 'left'});
      await new Promise(resolve => setTimeout(resolve, 2));
      expect(readTrigger).toHaveBeenCalledTimes(3);
      expect(readTrigger).toHaveBeenLastCalledWith(1);
      off();
    });

});
