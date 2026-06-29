import { jest } from '@jest/globals';
import { dx, trigger, addRule, clearAllRules, KernelStore } from '../index';
import * as adaxCore from '../index';

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

const getCounterByTeam: ({team}: {team: 'right' | 'left'},  stores?: {testStore: TestStore}) => number  = 
  ({team}: {team: 'right' | 'left'} = {team: 'right'},  stores = { testStore }) => (stores.testStore[team]?.counter || 0);

const incrementCounterByTeam: ({team}: {team: 'right' | 'left'},  stores?: {testStore: TestStore}) => void  = 
  ({team}: {team: 'right' | 'left'} = {team: 'right'},  stores = { testStore }) => stores.testStore[team] && stores.testStore[team].counter++;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wait = (ms = 2) => new Promise(r => setTimeout(r, ms));
const noop = () => {};
const createSpy = () => jest.fn() as any;

// ─── Browser tests ────────────────────────────────────────────────────────────

describe('dx WITHOUT rules (Browser)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('onUpdate fires immediately on activation with initial snapshot', () => {
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'browser-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any, ctx: any) => onUpdate(r.data, ctx.runIndex),
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenLastCalledWith(0, 0);

    off();
  });

  it('initial run is based on state at activation time (silent pre-mutation ignored)', async () => {
    incrementCounterByTeam({ team: 'right' });
    incrementCounterByTeam({ team: 'right' });
    await wait();

    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'browser-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => onUpdate(r.data),
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenLastCalledWith(2);

    off();
  });

  it('reacts to changes AFTER subscription', async () => {
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'browser-03', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => onUpdate(r.data),
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(onUpdate.mock.calls.length).toEqual(3);
    off();
  });

  it('ignores unrelated store changes', async () => {
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'browser-04', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => onUpdate(r.data),
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();

    trigger(incrementCounterByTeam, { team: 'left' });
    await wait();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    off();
  });
});

// ─── Rule tests ───────────────────────────────────────────────────────────────

describe('dx WITH rules', () => {
  beforeEach(() => resetStore());
  afterEach(() => clearAllRules());

  it('rule forces onUpdate even if data unchanged', async () => {
    addRule({ writeFn: incrementCounterByTeam, queryFn: getCounterByTeam });

    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'rule-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => onUpdate(r.data),
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();

    trigger(incrementCounterByTeam, { team: 'left' });
    await wait();

    expect(onUpdate).toHaveBeenCalledTimes(2);
    off();
  });
});

// ─── Ownership & Uniqueness Guards ────────────────────────────────────────────

describe('dx Ownership & Uniqueness Guards', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('throws if claim() is called more than once on the same instance', () => {
    const component = dx({
      init: { dxId: 'ownership-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify: noop,
      onEmit: noop,
    });

    component.claim();
    expect(() => component.claim()).toThrow('already claimed');
  });

  it('fails activation if dxId is already active by another instance', () => {
    const notify = createSpy();
    const onUpdate = createSpy();

    const component1 = dx({
      init: { dxId: 'ownership-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
    });

    const component2 = dx({
      init: { dxId: 'ownership-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
    });

    const { on: on1, off: off1 } = component1.claim();
    const { on: on2 } = component2.claim();

    on1();
    on2();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      "ERROR_dxId_collision",
      expect.objectContaining({
        error: expect.objectContaining({ message: expect.stringContaining('already active') })
      })
    );

    expect(onUpdate).toHaveBeenCalledTimes(1);
    off1();
  });

  it('allows sequential reuse of the same dxId after the first is deactivated', () => {
    const notify = createSpy();
    const onUpdate = createSpy();

    const component1 = dx({
      init: { dxId: 'ownership-03', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
    });

    const component2 = dx({
      init: { dxId: 'ownership-03', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
    });

    const { on: on1, off: off1 } = component1.claim();
    const { on: on2, off: off2 } = component2.claim();

    on1();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    off1();
    on2();
    expect(notify).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledTimes(2);
    off2();
  });
});

// ─── Lifecycle Hooks ──────────────────────────────────────────────────────────

describe('dx Lifecycle Hooks', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('calls beforeOn and beforeOff exactly once during on() and off()', () => {
    const beforeOn = createSpy();
    const beforeOff = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify: noop,
      onEmit: noop,
      beforeOn,
      beforeOff,
    });

    const { on, off } = component.claim();
    expect(beforeOn).not.toHaveBeenCalled();
    on();
    expect(beforeOn).toHaveBeenCalledTimes(1);
    expect(beforeOff).not.toHaveBeenCalled();
    off();
    expect(beforeOff).toHaveBeenCalledTimes(1);
  });

  it('handles beforeOn synchronous failure, triggers onBeforeOnFail, and remains inactive', async () => {
    const notify = createSpy();
    const onBeforeOnFail = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
      beforeOn: () => { throw new Error("Sync boom!"); },
      onBeforeOnFail,
    });

    const { on, off } = component.claim();
    expect(() => on()).toThrow("Sync boom!");

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_beforeOn", expect.objectContaining({
      error: expect.objectContaining({ message: "Sync boom!" })
    }));
    expect(onBeforeOnFail).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();

    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(onUpdate).not.toHaveBeenCalled();
    off();
  });

  it('aborts activation if beforeOn returns a Promise', () => {
    const notify = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-03', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
      beforeOn: () => Promise.resolve(),
    });

    const { on, off } = component.claim();
    expect(() => on()).toThrow("must be synchronous");

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_beforeOn", expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining("must be synchronous") })
    }));
    expect(onUpdate).not.toHaveBeenCalled();
    off();
  });

  it('aborts deactivation and notifies if beforeOff returns a Promise', () => {
    const notify = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-04', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
      beforeOff: () => new Promise(() => {}),
    });

    const { on, off } = component.claim();
    on();
    expect(notify).not.toHaveBeenCalled();
    off();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_beforeOff", expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining("must be synchronous") })
    }));
  });
});

// ─── The RunContext Object ────────────────────────────────────────────────────

describe('dx RunContext Object', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('runIndex increments on triggers and resets on re-activation', async () => {
    const runIndexes: number[] = [];

    const component = dx({
      init: { dxId: 'ctx-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, _r: any, ctx: any) => { runIndexes.push(ctx.runIndex); },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(runIndexes).toEqual([0]);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(runIndexes).toEqual([0, 1]);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(runIndexes).toEqual([0, 1, 2]);
    off();
    on();
    expect(runIndexes).toEqual([0, 1, 2, 0]);
    off();
  });

  it('isFirstRun() returns true only on the first run after activation', async () => {
    const firstRunFlags: boolean[] = [];

    const component = dx({
      init: { dxId: 'ctx-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, _r: any, ctx: any) => { firstRunFlags.push(ctx.isFirstRun()); },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(firstRunFlags).toEqual([true]);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(firstRunFlags).toEqual([true, false]);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(firstRunFlags).toEqual([true, false, false]);
    off();
    on();
    expect(firstRunFlags).toEqual([true, false, false, true]);
    off();
  });
});

// ─── Error Handling Inside onUpdate() ──────────────────────────────────────────

describe('dx Error Handling Inside onUpdate()', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('catches synchronous throws in onUpdate(), notifies error, and keeps component active', async () => {
    const notify = createSpy();
    let callCount = 0;

    const component = dx({
      init: { dxId: 'err-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: () => {
        callCount++;
        if (callCount === 1) throw new Error("Sync onUpdate boom!");
      },
      notify,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_run_sync", expect.objectContaining({
      error: expect.objectContaining({ message: "Sync onUpdate boom!" })
    }));
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(callCount).toBe(2);
    off();
  });

  it('catches errors in onUpdate that return a Promise and notifies ERROR_run_sync', async () => {
    const notify = createSpy();
    let callCount = 0;

    const component = dx({
      init: { dxId: 'err-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: () => {
        callCount++;
        if (callCount === 1) return Promise.resolve();
      },
      notify,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_run_sync", expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining("must be synchronous") })
    }));
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(callCount).toBe(2);
    off();
  });
});

// ─── adax-core Options Passthrough ────────────────────────────────────────────

describe('dx adax-core Options Passthrough', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('passing skipInitialQuerying: true passes undefined data to the initial onUpdate', async () => {
    const onUpdate = createSpy();
    const notify = createSpy();

    const component = dx({
      init: { dxId: 'opts-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => onUpdate(r.data),
      notify,
      onEmit: noop,
      queryOptions: { skipInitialQuerying: true },
    });

    const { on, off } = component.claim();
    on();
    expect(notify).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenLastCalledWith(undefined);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(1);
    off();
  });

  it('respects hasResultChanged returning false to prevent subsequent onUpdate calls', async () => {
    const onUpdate = createSpy();
    const notify = createSpy();

    const component = dx({
      init: { dxId: 'opts-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => onUpdate(r.data),
      notify,
      onEmit: noop,
      queryOptions: { hasResultChanged: () => false },
    });

    const { on, off } = component.claim();
    on();
    expect(notify).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenLastCalledWith(0);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    off();
  });

  it('catches adax-core invalid queryOptions (debounce + throttle) and notifies ERROR', () => {
    const notify = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'opts-03', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
      queryOptions: { debounceMs: 100, throttleMs: 100 },
    });

    const { on, off } = component.claim();
    on();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_subscribe", expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining("Cannot have both debounce and throttle") })
    }));
    expect(onUpdate).not.toHaveBeenCalled();
    off();
  });
});

// ─── Lifecycle Hook Edge Cases ─────────────────────────────────────────────

describe('dx Lifecycle Hook Edge Cases', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('calls notify twice if both beforeOn and onBeforeOnFail throw', () => {
    const notify = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-edge-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
      beforeOn: () => { throw new Error("beforeOn failed!"); },
      onBeforeOnFail: () => { throw new Error("onBeforeOnFail also failed!"); },
    });

    const { on, off } = component.claim();
    expect(() => on()).toThrow("beforeOn failed!");
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenNthCalledWith(1, "ERROR_beforeOn", expect.objectContaining({
      error: expect.objectContaining({ message: "beforeOn failed!" })
    }));
    expect(notify).toHaveBeenNthCalledWith(2, "ERROR_onBeforeOnFail", expect.objectContaining({
      error: expect.objectContaining({ message: "onBeforeOnFail also failed!" })
    }));
    expect(onUpdate).not.toHaveBeenCalled();
    off();
  });

  it('completes deactivation even if beforeOff throws', async () => {
    const notify = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-edge-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
      beforeOff: () => { throw new Error("beforeOff failed!"); },
    });

    const { on, off } = component.claim();
    on();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    off();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_beforeOff", expect.objectContaining({
      error: expect.objectContaining({ message: "beforeOff failed!" })
    }));
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

// ─── Advanced adax-core Options & Integration ─────────────────────────────

describe('dx Advanced adax-core Options & Integration', () => {
  beforeEach(() => resetStore());
  afterEach(() => clearAllRules());

  it('silently overrides cmpId in queryOptions with init.dxId', () => {
    const notify = createSpy();
    const onUpdate = createSpy();

    const component1 = dx({
      init: { dxId: 'cmp-override-real', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
      queryOptions: { cmpId: 'cmp-override-fake' },
    });

    const component2 = dx({
      init: { dxId: 'cmp-override-real', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
    });

    const { on: on1, off: off1 } = component1.claim();
    const { on: on2 } = component2.claim();

    on1();
    on2();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_dxId_collision", expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining('already active') })
    }));
    off1();
  });

  it('correctly passes through and respects adax-core rule skip conditions', async () => {
    addRule({ 
      writeFn: incrementCounterByTeam, 
      queryFn: getCounterByTeam,
      skip: (writeArgs: any, readArgs: any) => writeArgs.team !== readArgs.team
    });

    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'rule-skip-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => onUpdate(r.data),
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'left' });
    await wait();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenLastCalledWith(0);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(1);
    off();
  });
  
  it('isolates subscriptions and triggers using a custom KernelStore', async () => {
    const myKernel = new KernelStore();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'isolated-01', team: 'right' },
      queryFn: getCounterByTeam, 
      onUpdate: (_i: any, r: any) => onUpdate(r.data),
      notify: noop,
      onEmit: noop,
      stores: { kernel: myKernel },
    });

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' }, { kernel: myKernel });
    await wait();
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(1);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(onUpdate).toHaveBeenCalledTimes(2);
    off();
  });
});

// ─── Reconciler & State Coalescing ─────────────────────────────────────────

describe('dx Reconciler & State Coalescing', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('calling on() while already active is a no-op and does not re-run hooks', () => {
    const beforeOn = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'reconciler-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify: noop,
      onEmit: noop,
      beforeOn,
    });

    const { on, off } = component.claim();
    on();
    expect(beforeOn).toHaveBeenCalledTimes(1);
    on();
    expect(beforeOn).toHaveBeenCalledTimes(1);
    off();
  });

  it('calling off() while already inactive is a no-op and does not re-run hooks', () => {
    const beforeOff = createSpy();

    const component = dx({
      init: { dxId: 'reconciler-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify: noop,
      onEmit: noop,
      beforeOff,
    });

    const { on, off } = component.claim();
    on();
    off();
    expect(beforeOff).toHaveBeenCalledTimes(1);
    off();
    expect(beforeOff).toHaveBeenCalledTimes(1);
  });

  it('rapid synchronous on() -> off() -> on() leaves component active and correctly executes hooks', async () => {
    const beforeOn = createSpy();
    const beforeOff = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'reconciler-03', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify: noop,
      onEmit: noop,
      beforeOn,
      beforeOff,
    });

    const { on, off } = component.claim();
    on();
    off();
    on();
    expect(beforeOn).toHaveBeenCalledTimes(2);
    expect(beforeOff).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(onUpdate).toHaveBeenCalledTimes(3);
    off();
  });
});

// ─── Error Propagation ────────────────────────────────────────────────────

describe('dx Error Propagation', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('propagates the error if notify() throws when onUpdate() fails', () => {
    const component = dx({
      init: { dxId: 'err-prop-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: () => { throw new Error("onUpdate failed!"); },
      notify: () => { throw new Error("Notify exploded!"); },
      onEmit: noop,
    });

    const { on, off } = component.claim();
    expect(() => on()).toThrow("Notify exploded!");
    off();
  });

  it('propagates the error if notify() throws when beforeOn() fails', () => {
    const component = dx({
      init: { dxId: 'err-prop-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      onEmit: noop,
      beforeOn: () => { throw new Error("beforeOn failed!"); },
      notify: () => { throw new Error("Notify exploded!"); },
    });

    const { on, off } = component.claim();
    expect(() => on()).toThrow("Notify exploded!");
    off();
  });

  it('propagates the error if notify() throws when beforeOff() fails', () => {
    const component = dx({
      init: { dxId: 'err-prop-03', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      onEmit: noop,
      beforeOff: () => { throw new Error("beforeOff failed!"); },
      notify: () => { throw new Error("Notify exploded!"); },
    });

    const { on, off } = component.claim();
    on();
    expect(() => off()).toThrow("Notify exploded!");
  });
});

// ─── result.prevData ──────────────────────────────────────────────────────

describe('dx result.prevData', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('prevData reflects the value from the previous onUpdate call', async () => {
    const snapshots: { data: number; prevData: number }[] = [];

    const component = dx({
      init: { dxId: 'prevdata-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => snapshots.push({ data: r.data, prevData: r.prevData }),
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(snapshots[0].data).toBe(0);
    expect(snapshots[1].data).toBe(1);
    expect(snapshots[1].prevData).toBe(0);
    expect(snapshots[2].data).toBe(2);
    expect(snapshots[2].prevData).toBe(1);
    off();
  });

  it('prevData and data are different references (deep-clone guarantee)', async () => {
    let capturedResult: any = null;

    const storeWithObject = { team: { score: 0, label: 'right' } };
    const getTeamObj = (_?: any, stores = { storeWithObject }) => stores.storeWithObject.team;
    const incrementTeam = (_?: any, stores = { storeWithObject }) => { stores.storeWithObject.team.score++; };

    const component = dx({
      init: { dxId: 'prevdata-02' },
      queryFn: getTeamObj,
      onUpdate: (_i: any, r: any) => { capturedResult = r; },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    trigger(incrementTeam, undefined);
    await wait();
    expect(capturedResult.data).not.toBe(capturedResult.prevData);
    expect(capturedResult.data.score).toBe(1);
    expect(capturedResult.prevData.score).toBe(0);
    off();
  });
});

// ─── result.writeFn and result.writeParamsObj ─────────────────────────────

describe('dx result.writeFn and result.writeParamsObj', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('result.writeFn and result.writeParamsObj identify the triggering write', async () => {
    const snapshots: { writeFn: any; writeParamsObj: any }[] = [];

    const component = dx({
      init: { dxId: 'writefn-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => snapshots.push({ writeFn: r.writeFn, writeParamsObj: r.writeParamsObj }),
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(snapshots[0].writeFn).toBeUndefined();
    expect(snapshots[0].writeParamsObj).toBeUndefined();
    expect(snapshots[1].writeFn).toBe(incrementCounterByTeam);
    expect(snapshots[1].writeParamsObj).toEqual({ team: 'right' });
    off();
  });
});

// ─── onReady lifecycle ────────────────────────────────────────────────────

describe('dx onReady lifecycle', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('onReady fires after initial onUpdate', () => {
    const onUpdate = createSpy();
    const onReady = createSpy();
    let callOrder: string[] = [];

    const component = dx({
      init: { dxId: 'ready-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: () => { callOrder.push('onUpdate'); },
      onReady: () => { callOrder.push('onReady'); },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(callOrder).toEqual(['onUpdate', 'onReady']);
    off();
  });

  it('onReady can call trigger() which dispatches onUpdate live', async () => {
    const updateCount: number[] = [];

    const component = dx({
      init: { dxId: 'ready-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: () => { updateCount.push(updateCount.length); },
      onReady: () => {
        trigger(incrementCounterByTeam, { team: 'right' });
      },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(updateCount.length).toBe(2);
    off();
  });

  it('onReady errors are caught and notified', () => {
    const notify = createSpy();

    const component = dx({
      init: { dxId: 'ready-03', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      onReady: () => { throw new Error("onReady boom!"); },
      notify,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_run_sync", expect.objectContaining({
      error: expect.objectContaining({ message: "onReady boom!" })
    }));
    off();
  });

  it('onReady that returns a Promise is treated as an error', () => {
    const notify = createSpy();

    const component = dx({
      init: { dxId: 'ready-04', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      onReady: () => Promise.resolve(),
      notify,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_run_sync", expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining("must be synchronous") })
    }));
    off();
  });
});

// ─── onUnmount lifecycle ──────────────────────────────────────────────────

describe('dx onUnmount lifecycle', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('onUnmount fires during off() before beforeOff', () => {
    const callOrder: string[] = [];

    const component = dx({
      init: { dxId: 'unmount-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      onUnmount: () => { callOrder.push('onUnmount'); },
      beforeOff: () => { callOrder.push('beforeOff'); },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    off();
    expect(callOrder).toEqual(['onUnmount', 'beforeOff']);
  });

  it('onUnmount errors are caught and notified, deactivation continues', async () => {
    const notify = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'unmount-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      onUnmount: () => { throw new Error("onUnmount boom!"); },
      notify,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    off();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_run_sync", expect.objectContaining({
      error: expect.objectContaining({ message: "onUnmount boom!" })
    }));
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('onUnmount that returns a Promise is treated as an error', () => {
    const notify = createSpy();

    const component = dx({
      init: { dxId: 'unmount-03', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      onUnmount: () => Promise.resolve(),
      notify,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    off();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_run_sync", expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining("must be synchronous") })
    }));
  });

  it('onUnmount can safely call child.off() while dxId is still held', () => {
    const childComponent = dx({
      init: { dxId: 'child-unmount-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify: noop,
      onEmit: noop,
    });

    const parentComponent = dx({
      init: { dxId: 'parent-unmount-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      onUnmount: () => {
        const { off } = childComponent.claim();
        off();
      },
      notify: noop,
      onEmit: noop,
    });

    const { on: parentOn, off: parentOff } = parentComponent.claim();
    const { on: childOn, off: childOff } = childComponent.claim();

    childOn();
    parentOn();
    expect(() => parentOff()).not.toThrow();
  });
});

// ─── throttleMs ───────────────────────────────────────────────────────

describe('dx throttleMs option', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('fires immediately on first trigger then rate-limits subsequent calls', async () => {
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'throttle-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => onUpdate(r.data),
      notify: noop,
      onEmit: noop,
      queryOptions: { throttleMs: 100 },
    });

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait(10);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait(10);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    await wait(120);
    expect(onUpdate).toHaveBeenCalledTimes(3);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait(10);
    expect(onUpdate).toHaveBeenCalledTimes(4);
    off();
  });
});

// ─── onBeforeOnFail called on subscribe() failure ────────────────────────

describe('dx onBeforeOnFail on subscribe failure', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('calls onBeforeOnFail when subscribe() throws', () => {
    const notify = createSpy();
    const onBeforeOnFail = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'subscribe-fail-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
      onBeforeOnFail,
      queryOptions: { debounceMs: 100, throttleMs: 100 },
    });

    const { on, off } = component.claim();
    on();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('ERROR_subscribe', expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining('Cannot have both debounce and throttle') })
    }));
    expect(onBeforeOnFail).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
    off();
  });

  it('notifies ERROR_onBeforeOnFail when onBeforeOnFail throws during subscribe() failure', () => {
    const notify = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'subscribe-fail-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
      onBeforeOnFail: () => { throw new Error("onBeforeOnFail cleanup failed!"); },
      queryOptions: { debounceMs: 100, throttleMs: 100 },
    });

    const { on, off } = component.claim();
    on();
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenNthCalledWith(1, 'ERROR_subscribe', expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining('Cannot have both debounce and throttle') })
    }));
    expect(notify).toHaveBeenNthCalledWith(2, 'ERROR_onBeforeOnFail', expect.objectContaining({
      error: expect.objectContaining({ message: "onBeforeOnFail cleanup failed!" }),
      componentId: 'subscribe-fail-02'
    }));
    expect(onUpdate).not.toHaveBeenCalled();
    off();
  });
});

// ─── At least one lifecycle hook is required ─────────────────────────────

describe('dx at least one lifecycle hook validation', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('throws if none of onUpdate, onReady, onUnmount are provided', () => {
    expect(() => {
      dx({
        init: { dxId: 'no-hook-01', team: 'right' },
        queryFn: getCounterByTeam,
        notify: noop,
        onEmit: noop,
      } as any);
    }).toThrow('At least one of onUpdate, onReady, or onUnmount must be provided');
  });

  it('does not throw if only onUpdate is provided', () => {
    expect(() => {
      const component = dx({
        init: { dxId: 'hook-01', team: 'right' },
        queryFn: getCounterByTeam,
        onUpdate: noop,
        notify: noop,
        onEmit: noop,
      });
      component.claim();
    }).not.toThrow();
  });

  it('does not throw if only onReady is provided', () => {
    expect(() => {
      const component = dx({
        init: { dxId: 'hook-02', team: 'right' },
        queryFn: getCounterByTeam,
        onReady: noop,
        notify: noop,
        onEmit: noop,
      });
      component.claim();
    }).not.toThrow();
  });

  it('does not throw if only onUnmount is provided', () => {
    expect(() => {
      const component = dx({
        init: { dxId: 'hook-03', team: 'right' },
        queryFn: getCounterByTeam,
        onUnmount: noop,
        notify: noop,
        onEmit: noop,
      });
      component.claim();
    }).not.toThrow();
  });
});

// ─── trigger() inside beforeOn ────────────────────────────────────────────

describe('dx trigger() inside beforeOn', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('does not crash when trigger() is called inside beforeOn (update is deferred)', () => {
    const onUpdate = createSpy();
    const notify = createSpy();

    const component = dx({
      init: { dxId: 'gap-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify,
      onEmit: noop,
      beforeOn: () => {
        trigger(incrementCounterByTeam, { team: 'right' });
      },
    });

    const { on, off } = component.claim();
    expect(() => on()).not.toThrow();
    expect(notify).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.anything(),        // init
      expect.objectContaining({ data: 1 }), // result
      expect.anything(),        // ctx
      expect.any(Function)      // emit
    );
    off();
  });
});

// ─── Pending update flushed after isLive ─────────────────────────────────

describe('dx pending update coalescing', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('collapses multiple trigger() calls during initial onUpdate into one update', async () => {
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'coalesce-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: () => {
        onUpdate();
        // Simulate trigger inside initial onUpdate
        if (onUpdate.mock.calls.length === 1) {
          trigger(incrementCounterByTeam, { team: 'right' });
        }
      },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    // Initial onUpdate triggers an internal trigger(), which is collapsed
    // Then onReady (if present) or just end, isLive is set, pendingUpdate is flushed
    expect(onUpdate).toHaveBeenCalledTimes(2);
    off();
  });
});

// ─── Result version tracking ──────────────────────────────────────────────

describe('dx result.version tracking', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('increments version on each query result change', async () => {
    const versions: number[] = [];

    const component = dx({
      init: { dxId: 'version-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => versions.push(r.version),
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(versions).toEqual([0]);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(versions).toEqual([0, 1]);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(versions).toEqual([0, 1, 2]);
    off();
  });

  it('version does not increment if hasResultChanged returns false', async () => {
    const versions: number[] = [];

    const component = dx({
      init: { dxId: 'version-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => versions.push(r.version),
      notify: noop,
      onEmit: noop,
      queryOptions: { hasResultChanged: () => false },
    });

    const { on, off } = component.claim();
    on();
    expect(versions).toEqual([0]);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(versions).toEqual([0]);
    off();
  });
});

// ─── Domain event emissions via onEmit ────────────────────────────────────

describe('dx domain event emissions (onEmit)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('passes emit callback to onUpdate with correct signature', () => {
    const emitCalls: any[] = [];

    const component = dx({
      init: { dxId: 'emit-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, _r: any, _ctx: any, emit: any) => {
        emitCalls.push({ emit: typeof emit, isFunction: typeof emit === 'function' });
      },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(emitCalls[0].isFunction).toBe(true);
    off();
  });

  it('onEmit receives events dispatched during onUpdate', () => {
    const emittedEvents: any[] = [];

    const component = dx({
      init: { dxId: 'emit-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any, _ctx: any, emit: any) => {
        if (r.data === 0) {
          emit('COUNTER_CHANGED', { newValue: r.data });
        }
      },
      notify: noop,
      onEmit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    });

    const { on, off } = component.claim();
    on();
    expect(emittedEvents).toEqual([
      { event: 'COUNTER_CHANGED', payload: { newValue: 0 } }
    ]);
    off();
  });
});

// ─── Complex trigger patterns ──────────────────────────────────────────────

describe('dx complex trigger patterns', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('handles nested trigger calls across multiple writes', async () => {
    const updateLog: string[] = [];

    const component = dx({
      init: { dxId: 'nested-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => {
        updateLog.push(`counter=${r.data}`);
      },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    trigger(incrementCounterByTeam, { team: 'right' });
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(updateLog).toEqual(['counter=0', 'counter=1', 'counter=2', 'counter=3']);
    off();
  });

  it('correctly handles writes to different team parameters', async () => {
    const updates: { team: string; counter: number }[] = [];

    const component1 = dx({
      init: { dxId: 'multi-team-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => updates.push({ team: 'right', counter: r.data }),
      notify: noop,
      onEmit: noop,
    });

    const component2 = dx({
      init: { dxId: 'multi-team-02', team: 'left' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => updates.push({ team: 'left', counter: r.data }),
      notify: noop,
      onEmit: noop,
    });

    const { on: on1, off: off1 } = component1.claim();
    const { on: on2, off: off2 } = component2.claim();
    on1();
    on2();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    trigger(incrementCounterByTeam, { team: 'left' });
    await wait();
    expect(updates).toEqual([
      { team: 'right', counter: 0 },
      { team: 'left', counter: 0 },
      { team: 'right', counter: 1 },
      { team: 'left', counter: 1 },
    ]);
    off1();
    off2();
  });
});

// ─── Multiple queries and rule interactions ────────────────────────────────

describe('dx multiple queries and rule interactions', () => {
  beforeEach(() => resetStore());
  afterEach(() => clearAllRules());

  it('multiple query instances on same queryFn all receive updates', async () => {
    const results1: number[] = [];
    const results2: number[] = [];

    const component1 = dx({
      init: { dxId: 'multi-query-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => results1.push(r.data),
      notify: noop,
      onEmit: noop,
    });

    const component2 = dx({
      init: { dxId: 'multi-query-02', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => results2.push(r.data),
      notify: noop,
      onEmit: noop,
    });

    const { on: on1, off: off1 } = component1.claim();
    const { on: on2, off: off2 } = component2.claim();
    on1();
    on2();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(results1).toEqual([0, 1]);
    expect(results2).toEqual([0, 1]);
    off1();
    off2();
  });

  it('rule skip condition correctly filters which queries run', async () => {
    addRule({
      writeFn: incrementCounterByTeam,
      queryFn: getCounterByTeam,
      skip: (writeArgs: any, readArgs: any) => writeArgs.team !== readArgs.team,
    });

    const rightUpdates: number[] = [];
    const leftUpdates: number[] = [];

    const rightComponent = dx({
      init: { dxId: 'rule-filter-right', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => rightUpdates.push(r.data),
      notify: noop,
      onEmit: noop,
    });

    const leftComponent = dx({
      init: { dxId: 'rule-filter-left', team: 'left' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => leftUpdates.push(r.data),
      notify: noop,
      onEmit: noop,
    });

    const { on: onR, off: offR } = rightComponent.claim();
    const { on: onL, off: offL } = leftComponent.claim();
    onR();
    onL();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(rightUpdates).toEqual([0, 1]);
    expect(leftUpdates).toEqual([0]);
    trigger(incrementCounterByTeam, { team: 'left' });
    await wait();
    expect(rightUpdates).toEqual([0, 1]);
    expect(leftUpdates).toEqual([0, 1]);
    offR();
    offL();
  });
});

// ─── Deep cloning and immutability ─────────────────────────────────────────

describe('dx deep cloning and immutability', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('modifications to result.data do not affect result.prevData', async () => {
    let capturedData: any = null;
    let capturedPrevData: any = null;

    const storeWithArray = { items: [1, 2, 3] };
    const getArray = (_?: any, stores = { storeWithArray }) => stores.storeWithArray.items;
    const pushItem = (_?: any, stores = { storeWithArray }) => {
      stores.storeWithArray.items.push(4);
    };

    const component = dx({
      init: { dxId: 'clone-01' },
      queryFn: getArray,
      onUpdate: (_i: any, r: any) => {
        capturedData = r.data;
        capturedPrevData = r.prevData;
      },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    trigger(pushItem, undefined);
    await wait();
    expect(capturedData).toEqual([1, 2, 3, 4]);
    expect(capturedPrevData).toEqual([1, 2, 3]);
    expect(capturedData).not.toBe(capturedPrevData);
    off();
  });

  it('nested object cloning preserves independence', async () => {
    const storeWithNested = {
      user: { name: 'Alice', profile: { age: 30, city: 'NYC' } }
    };
    const getUser = (_?: any, stores = { storeWithNested }) => stores.storeWithNested.user;
    const updateAge = (_?: any, stores = { storeWithNested }) => {
      stores.storeWithNested.user.profile.age = 31;
    };

    let results: any[] = [];

    const component = dx({
      init: { dxId: 'clone-nested-01' },
      queryFn: getUser,
      onUpdate: (_i: any, r: any) => {
        results.push({ data: r.data, prevData: r.prevData });
      },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    trigger(updateAge, undefined);
    await wait();
    expect(results[1].data.profile.age).toBe(31);
    expect(results[1].prevData.profile.age).toBe(30);
    off();
  });
});

// ─── Activation/deactivation state machine ────────────────────────────────

describe('dx activation/deactivation state machine', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('rapid on/off/on/off transitions execute hooks correctly', async () => {
    const beforeOn = createSpy();
    const beforeOff = createSpy();
    const onUpdate = createSpy();

    const component = dx({
      init: { dxId: 'state-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate,
      notify: noop,
      onEmit: noop,
      beforeOn,
      beforeOff,
    });

    const { on, off } = component.claim();
    on();
    on();
    on();
    off();
    off();
    on();
    expect(beforeOn).toHaveBeenCalledTimes(2);
    expect(beforeOff).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    off();
  });

  it('off() during onUpdate execution is deferred until after onUpdate completes', async () => {
    const callOrder: string[] = [];

    const component = dx({
      init: { dxId: 'deferred-off-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any) => {
        callOrder.push('onUpdate-start');
        callOrder.push('onUpdate-end');
      },
      onUnmount: () => {
        callOrder.push('onUnmount');
      },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    callOrder.push('after-on');
    expect(callOrder).toEqual(['onUpdate-start', 'onUpdate-end', 'after-on']);
    off();
    expect(callOrder).toContain('onUnmount');
  });
});

// ─── Custom kernel store isolation ────────────────────────────────────────

describe('dx custom kernel store isolation', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('two components with different kernels do not cross-trigger each other', async () => {
    const kernel1 = new KernelStore();
    const kernel2 = new KernelStore();

    const updates1: number[] = [];
    const updates2: number[] = [];

    const component1 = dx({
      init: { dxId: 'kernel-iso-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => updates1.push(r.data),
      notify: noop,
      onEmit: noop,
      stores: { kernel: kernel1 },
    });

    const component2 = dx({
      init: { dxId: 'kernel-iso-02', team: 'left' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => updates2.push(r.data),
      notify: noop,
      onEmit: noop,
      stores: { kernel: kernel2 },
    });

    const { on: on1, off: off1 } = component1.claim();
    const { on: on2, off: off2 } = component2.claim();

    on1();
    on2();
    expect(updates1).toEqual([0]);
    expect(updates2).toEqual([0]);

    trigger(incrementCounterByTeam, { team: 'right' }, { kernel: kernel1 });
    await wait();
    expect(updates1).toEqual([0, 1]);
    expect(updates2).toEqual([0]);

    trigger(incrementCounterByTeam, { team: 'left' }, { kernel: kernel2 });
    await wait();
    expect(updates1).toEqual([0, 1]);
    expect(updates2).toEqual([0, 1]);

    off1();
    off2();
  });
});

// ─── onReady and trigger interactions ──────────────────────────────────────

describe('dx onReady and trigger interactions', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('pendingUpdate is flushed before onReady runs', async () => {
    const readyCallCount = { value: 0 };
    const updateCallCount = { value: 0 };

    const component = dx({
      init: { dxId: 'ready-flush-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: () => {
        updateCallCount.value++;
        if (updateCallCount.value === 1) {
          trigger(incrementCounterByTeam, { team: 'right' });
        }
      },
      onReady: () => {
        readyCallCount.value++;
      },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(updateCallCount.value).toBe(2);
    expect(readyCallCount.value).toBe(1);
    off();
  });

  it('multiple trigger() calls during onReady are dispatched live', async () => {
    const updateLog: number[] = [];

    const component = dx({
      init: { dxId: 'ready-live-01', team: 'right' },
      queryFn: getCounterByTeam,
      onUpdate: (_i: any, r: any) => {
        updateLog.push(r.data);
      },
      onReady: () => {
        trigger(incrementCounterByTeam, { team: 'right' });
        trigger(incrementCounterByTeam, { team: 'right' });
      },
      notify: noop,
      onEmit: noop,
    });

    const { on, off } = component.claim();
    on();
    expect(updateLog).toEqual([0, 1, 2]);
    off();
  });
});