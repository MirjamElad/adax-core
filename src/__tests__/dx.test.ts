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

  it('run fires immediately on activation with initial snapshot', () => {
    const run = createSpy();

    const component = dx({
      init: { dxId: 'browser-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i: any, r: any, ctx: any) => run(r.data, ctx.runIndex),
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenLastCalledWith(0, 0);

    off();
  });

  it('initial run is based on state at activation time (silent pre-mutation ignored)', async () => {
    incrementCounterByTeam({ team: 'right' });
    incrementCounterByTeam({ team: 'right' });
    await wait();

    const run = createSpy();

    const component = dx({
      init: { dxId: 'browser-02', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i: any, r: any) => run(r.data),
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenLastCalledWith(2);

    off();
  });

  it('reacts to changes AFTER subscription', async () => {
    const run = createSpy();

    const component = dx({
      init: { dxId: 'browser-03', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i: any, r: any) => run(r.data),
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(run.mock.calls.length).toEqual(3);
    off();
  });

  it('ignores unrelated store changes', async () => {
    const run = createSpy();

    const component = dx({
      init: { dxId: 'browser-04', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i: any, r: any) => run(r.data),
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();

    trigger(incrementCounterByTeam, { team: 'left' });
    await wait();

    expect(run).toHaveBeenCalledTimes(1);
    off();
  });
});

// ─── Rule tests ───────────────────────────────────────────────────────────────

describe('dx WITH rules', () => {
  beforeEach(() => resetStore());
  afterEach(() => clearAllRules());

  it('rule forces run even if data unchanged', async () => {
    addRule({ writeFn: incrementCounterByTeam, queryFn: getCounterByTeam });

    const run = createSpy();

    const component = dx({
      init: { dxId: 'rule-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i: any, r: any) => run(r.data),
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();

    trigger(incrementCounterByTeam, { team: 'left' });
    await wait();

    expect(run).toHaveBeenCalledTimes(2);
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
      run: noop,
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

    component.claim();
    expect(() => component.claim()).toThrow('already been claimed');
  });

  it('fails activation if dxId is already active by another instance', () => {
    const notify = createSpy();
    const run = createSpy();

    const component1 = dx({
      init: { dxId: 'ownership-02', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      __dev__: false,
    } as any);

    const component2 = dx({
      init: { dxId: 'ownership-02', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      __dev__: false,
    } as any);

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

    expect(run).toHaveBeenCalledTimes(1);
    off1();
  });

  it('allows sequential reuse of the same dxId after the first is deactivated', () => {
    const notify = createSpy();
    const run = createSpy();

    const component1 = dx({
      init: { dxId: 'ownership-03', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      __dev__: false,
    } as any);

    const component2 = dx({
      init: { dxId: 'ownership-03', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on: on1, off: off1 } = component1.claim();
    const { on: on2, off: off2 } = component2.claim();

    on1();
    expect(run).toHaveBeenCalledTimes(1);
    off1();
    on2();
    expect(notify).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(2);
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
      run: noop,
      notify: noop,
      onEmit: noop,
      beforeOn,
      beforeOff,
      __dev__: false,
    } as any);

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
    const run = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-02', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      beforeOn: () => { throw new Error("Sync boom!"); },
      onBeforeOnFail,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_beforeOn", expect.objectContaining({
      error: expect.objectContaining({ message: "Sync boom!" })
    }));
    expect(onBeforeOnFail).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();

    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(run).not.toHaveBeenCalled();
    off();
  });

  it('aborts activation if beforeOn returns a Promise', () => {
    const notify = createSpy();
    const run = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-03', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      beforeOn: () => Promise.resolve(),
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_beforeOn", expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining("must be synchronous") })
    }));
    expect(run).not.toHaveBeenCalled();
    off();
  });

  it('aborts deactivation and notifies if beforeOff returns a Promise', () => {
    const notify = createSpy();
    const run = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-04', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      beforeOff: () => new Promise(() => {}),
      __dev__: false,
    } as any);

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
      run: (_i: any, _r: any, ctx: any) => { runIndexes.push(ctx.runIndex); },
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

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

  it('isActiveExecution() returns false if off() is called during async run', async () => {
    let capturedIsActive: boolean | null = null;

    const component = dx({
      init: { dxId: 'ctx-02', team: 'right' },
      queryFn: getCounterByTeam,
      run: async (_i: any, _r: any, ctx: any) => {
        await wait(20);
        capturedIsActive = ctx.isActiveExecution();
      },
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    off();
    await wait(30);
    expect(capturedIsActive).toBe(false);
  });

  it('isLatestRun() returns false if a subsequent trigger superseded the current async run', async () => {
    const capturedIsLatest: boolean[] = [];

    const component = dx({
      init: { dxId: 'ctx-03', team: 'right' },
      queryFn: getCounterByTeam,
      run: async (_i: any, _r: any, ctx: any) => {
        await wait(10);
        capturedIsLatest.push(ctx.isLatestRun());
      },
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait(30);
    expect(capturedIsLatest).toEqual([false, false, true]);
    off();
  });
});

// ─── Error Handling Inside run() ──────────────────────────────────────────────

describe('dx Error Handling Inside run()', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('catches synchronous throws in run(), notifies error, and keeps component active', async () => {
    const notify = createSpy();
    let callCount = 0;

    const component = dx({
      init: { dxId: 'err-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: () => {
        callCount++;
        if (callCount === 1) throw new Error("Sync run boom!");
      },
      notify,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_run_sync", expect.objectContaining({
      error: expect.objectContaining({ message: "Sync run boom!" })
    }));
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(callCount).toBe(2);
    off();
  });

  it('catches async rejections in run(), notifies error, and keeps component active', async () => {
    const notify = createSpy();
    let callCount = 0;

    const component = dx({
      init: { dxId: 'err-02', team: 'right' },
      queryFn: getCounterByTeam,
      run: async () => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error("Async run boom!"));
      },
      notify,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    await wait();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_run_async", expect.objectContaining({
      error: expect.objectContaining({ message: "Async run boom!" })
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

  it('passing skipInitialQuerying: true passes undefined data to the initial run', async () => {
    const run = createSpy();
    const notify = createSpy();

    const component = dx({
      init: { dxId: 'opts-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i: any, r: any) => run(r.data),
      notify,
      onEmit: noop,
      queryOptions: { skipInitialQuerying: true },
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    expect(notify).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenLastCalledWith(undefined);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith(1);
    off();
  });

  it('respects hasResultChanged returning false to prevent subsequent runs', async () => {
    const run = createSpy();
    const notify = createSpy();

    const component = dx({
      init: { dxId: 'opts-02', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i: any, r: any) => run(r.data),
      notify,
      onEmit: noop,
      queryOptions: { hasResultChanged: () => false },
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    expect(notify).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenLastCalledWith(0);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(run).toHaveBeenCalledTimes(1);
    off();
  });

  it('catches adax-core invalid queryOptions (debounce + throttle) and notifies ERROR', () => {
    const notify = createSpy();
    const run = createSpy();

    const component = dx({
      init: { dxId: 'opts-03', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      queryOptions: { debounceMs: 100, throttleMs: 100 },
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_subscribe", expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining("Cannot have both debounce and throttle") })
    }));
    expect(run).not.toHaveBeenCalled();
    off();
  });
});

// ─── DEV Mode Warnings ────────────────────────────────────────────────────

describe('dx DEV Mode Warnings', () => {
  let warnSpy: jest.SpiedFunction<typeof console.warn>;
  
  beforeEach(() => {
    resetStore();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    resetStore();
    warnSpy.mockRestore();
  });

  it('warns if trigger() is called synchronously inside a TRIGGERED run()', () => {
    let runCount = 0;
    
    const component = dx({
      init: { dxId: 'dev-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: () => {
        runCount++;
        if (runCount === 2) {
          trigger(incrementCounterByTeam, { team: 'right' });
        }
      },
      notify: noop,
      onEmit: noop,
      __dev__: true,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Re-entrant run detected'));
    off();
  });
});

// ─── Lifecycle Hook Edge Cases ─────────────────────────────────────────────

describe('dx Lifecycle Hook Edge Cases', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('calls notify twice if both beforeOn and onBeforeOnFail throw', () => {
    const notify = createSpy();
    const run = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-edge-01', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      beforeOn: () => { throw new Error("beforeOn failed!"); },
      onBeforeOnFail: () => { throw new Error("onBeforeOnFail also failed!"); },
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenNthCalledWith(1, "ERROR_beforeOn", expect.objectContaining({
      error: expect.objectContaining({ message: "beforeOn failed!" })
    }));
    expect(notify).toHaveBeenNthCalledWith(2, "ERROR_onBeforeOnFail", expect.objectContaining({
      error: expect.objectContaining({ message: "onBeforeOnFail also failed!" })
    }));
    expect(run).not.toHaveBeenCalled();
    off();
  });

  it('completes deactivation even if beforeOff throws', async () => {
    const notify = createSpy();
    const run = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-edge-02', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      beforeOff: () => { throw new Error("beforeOff failed!"); },
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    expect(run).toHaveBeenCalledTimes(1);
    off();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_beforeOff", expect.objectContaining({
      error: expect.objectContaining({ message: "beforeOff failed!" })
    }));
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

// ─── RunContext Nuances ────────────────────────────────────────────────────

describe('dx RunContext Nuances', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('runToken increments monotonically and NEVER resets across activations', async () => {
    const runTokens: number[] = [];

    const component = dx({
      init: { dxId: 'ctx-nuance-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i: any, _r: any, ctx: any) => { runTokens.push(ctx.runToken); },
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    off();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(runTokens).toEqual([1, 2, 3, 4, 5]);
    off();
  });

  it('synchronous side effects BEFORE an await cannot be guarded by off()', async () => {
    const syncEffects: string[] = [];
    const guardedEffects: string[] = [];

    const component = dx({
      init: { dxId: 'ctx-nuance-02', team: 'right' },
      queryFn: getCounterByTeam,
      run: async (_i: any, _r: any, ctx: any) => {
        syncEffects.push('sync-ran');
        await wait(20);
        if (ctx.isActiveExecution()) {
          guardedEffects.push('guarded-ran');
        }
      },
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    off();
    await wait(30);
    expect(syncEffects).toEqual(['sync-ran']);
    expect(guardedEffects).toEqual([]);
  });
});

// ─── Advanced adax-core Options & Integration ─────────────────────────────

describe('dx Advanced adax-core Options & Integration', () => {
  beforeEach(() => resetStore());
  afterEach(() => clearAllRules());

  it('silently overrides cmpId in queryOptions with init.dxId', () => {
    const notify = createSpy();
    const run = createSpy();

    const component1 = dx({
      init: { dxId: 'cmp-override-real', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      queryOptions: { cmpId: 'cmp-override-fake' },
      __dev__: false,
    } as any);

    const component2 = dx({
      init: { dxId: 'cmp-override-real', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      __dev__: false,
    } as any);

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

    const run = createSpy();

    const component = dx({
      init: { dxId: 'rule-skip-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i: any, r: any) => run(r.data),
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'left' });
    await wait();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenLastCalledWith(0);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith(1);
    off();
  });
  
  it('isolates subscriptions and triggers using a custom KernelStore', async () => {
    const myKernel = new KernelStore();
    const run = createSpy();

    const component = dx({
      init: { dxId: 'isolated-01', team: 'right' },
      queryFn: getCounterByTeam, 
      run: (_i: any, r: any) => run(r.data),
      notify: noop,
      onEmit: noop,
      stores: { kernel: myKernel }, 
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' }, { kernel: myKernel });
    await wait();
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith(1);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(run).toHaveBeenCalledTimes(2);
    off();
  });
});

// ─── Reconciler & State Coalescing ─────────────────────────────────────────

describe('dx Reconciler & State Coalescing', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('calling on() while already active is a no-op and does not re-run hooks', () => {
    const beforeOn = createSpy();
    const run = createSpy();

    const component = dx({
      init: { dxId: 'reconciler-01', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify: noop,
      onEmit: noop,
      beforeOn,
      __dev__: false,
    } as any);

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
      run: noop,
      notify: noop,
      onEmit: noop,
      beforeOff,
      __dev__: false,
    } as any);

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
    const run = createSpy();

    const component = dx({
      init: { dxId: 'reconciler-03', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify: noop,
      onEmit: noop,
      beforeOn,
      beforeOff,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    off();
    on();
    expect(beforeOn).toHaveBeenCalledTimes(2);
    expect(beforeOff).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(run).toHaveBeenCalledTimes(3);
    off();
  });
});

// ─── Error Propagation ────────────────────────────────────────────────────

describe('dx Error Propagation', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('propagates the error if notify() throws when a sync run() fails', () => {
    const component = dx({
      init: { dxId: 'err-prop-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: () => { throw new Error("Run failed!"); },
      notify: () => { throw new Error("Notify exploded!"); },
      onEmit: noop,
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    expect(() => on()).toThrow("Notify exploded!");
    off();
  });

  it('propagates the error if notify() throws when beforeOn() fails', () => {
    const component = dx({
      init: { dxId: 'err-prop-02', team: 'right' },
      queryFn: getCounterByTeam,
      run: noop,
      onEmit: noop,
      beforeOn: () => { throw new Error("beforeOn failed!"); },
      notify: () => { throw new Error("Notify exploded!"); },
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    expect(() => on()).toThrow("Notify exploded!");
    off();
  });

  it('propagates the error if notify() throws when beforeOff() fails', () => {
    const component = dx({
      init: { dxId: 'err-prop-03', team: 'right' },
      queryFn: getCounterByTeam,
      run: noop,
      onEmit: noop,
      beforeOff: () => { throw new Error("beforeOff failed!"); },
      notify: () => { throw new Error("Notify exploded!"); },
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    expect(() => off()).toThrow("Notify exploded!");
  });
});

// ─── resolveDev & DEV invokeRun branches ──────────────────────────────────

describe('dx resolveDev & DEV invokeRun branches', () => {
  let warnSpy: jest.SpiedFunction<typeof console.warn>;
  const originalEnv = process.env;
  
  beforeEach(() => {
    resetStore();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env = { ...originalEnv, NODE_ENV: undefined };
  });
  
  afterEach(() => {
    resetStore();
    warnSpy.mockRestore();
    process.env = originalEnv;
  });

  it('resolves DEV to false if __dev__ is omitted in a non-Node environment', () => {
    let runCount = 0;
    const component = dx({
      init: { dxId: 'dev-resolve-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: () => {
        runCount++;
        if (runCount === 2) trigger(incrementCounterByTeam, { team: 'right' });
      },
      notify: noop,
      onEmit: noop,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    expect(warnSpy).not.toHaveBeenCalled();
    off();
  });

  it('resolves DEV to true via process.env.NODE_ENV === "development"', () => {
    process.env.NODE_ENV = 'development';
    let runCount = 0;
    const component = dx({
      init: { dxId: 'dev-resolve-02', team: 'right' },
      queryFn: getCounterByTeam,
      run: () => {
        runCount++;
        if (runCount === 2) trigger(incrementCounterByTeam, { team: 'right' });
      },
      notify: noop,
      onEmit: noop,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Re-entrant run detected'));
    off();
  });

  it('resolves DEV to false if process.env.NODE_ENV === "production"', () => {
    process.env.NODE_ENV = 'production';
    let runCount = 0;
    const component = dx({
      init: { dxId: 'dev-resolve-03', team: 'right' },
      queryFn: getCounterByTeam,
      run: () => {
        runCount++;
        if (runCount === 2) trigger(incrementCounterByTeam, { team: 'right' });
      },
      notify: noop,
      onEmit: noop,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    expect(warnSpy).not.toHaveBeenCalled();
    off();
  });

  it('samples late callback warnings: fires on 1st and 100th occurrences', () => {
    const subscribeSpy = jest.spyOn(adaxCore, 'subscribe').mockImplementation(((readTrigger: any) => ({
      result: { data: 0, prevData: 0, version: 0, writeFn: undefined, writeParamsObj: undefined },
      on: jest.fn(),
      off: jest.fn(),
    })) as any);

    const component = dx({
      init: { dxId: 'dev-modulo-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: noop,
      notify: noop,
      onEmit: noop,
      __dev__: true,
    } as any);

    const { on, off } = component.claim();
    on();
    off();
    const readTrigger = subscribeSpy.mock.calls[0][0];
    for (let i = 0; i < 100; i++) {
      readTrigger({ 
        data: 1, 
        prevData: 0, 
        version: 1,
        writeFn: undefined,
        writeParamsObj: undefined
      });
    }
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenNthCalledWith(2, expect.stringContaining('(total: 100)'));
    subscribeSpy.mockRestore();
  });

  it('warns if a debounced callback arrives after off() (late callback)', async () => {
    const component = dx({
      init: { dxId: 'dev-02', team: 'right' },
      queryFn: getCounterByTeam,
      run: noop,
      notify: noop,
      onEmit: noop,
      queryOptions: { debounceMs: 50 }, 
      __dev__: true,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    off();
    await wait(100);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Late callback discarded'));
  });
});

// ─── throttleMs ───────────────────────────────────────────────────────────

describe('dx throttleMs option', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('fires immediately on first trigger then rate-limits subsequent calls', async () => {
    const run = createSpy();

    const component = dx({
      init: { dxId: 'throttle-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i: any, r: any) => run(r.data),
      notify: noop,
      onEmit: noop,
      queryOptions: { throttleMs: 100 },
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait(10);
    expect(run).toHaveBeenCalledTimes(2);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait(10);
    expect(run).toHaveBeenCalledTimes(2);
    await wait(120);
    expect(run).toHaveBeenCalledTimes(3);
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait(10);
    expect(run).toHaveBeenCalledTimes(4);
    off();
  });
});

// ─── onBeforeOnFail NOT called when subscribe() throws ────────────────────

describe('dx onBeforeOnFail boundary', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('does NOT call onBeforeOnFail when subscribe() throws', () => {
    const notify = createSpy();
    const onBeforeOnFail = createSpy();
    const run = createSpy();

    const component = dx({
      init: { dxId: 'subscribe-fail-01', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      onBeforeOnFail,
      queryOptions: { debounceMs: 100, throttleMs: 100 },
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    on();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('ERROR_subscribe', expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining('Cannot have both debounce and throttle') })
    }));
    expect(onBeforeOnFail).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    off();
  });
});

// ─── Late callback counter resets on re-activation ────────────────────────

describe('dx DEV late callback counter reset', () => {
  let warnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    resetStore();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    resetStore();
    warnSpy.mockRestore();
  });

  it('resets droppedRunCount on re-activation so the 1st post-reactivation drop warns', () => {
    const subscribeSpy = jest.spyOn(adaxCore, 'subscribe').mockImplementation(((readTrigger: any) => ({
      result: { data: 0, prevData: 0, version: 0, writeFn: undefined, writeParamsObj: undefined },
      on: jest.fn(),
      off: jest.fn(),
    })) as any);

    const component = dx({
      init: { dxId: 'dev-reset-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: noop,
      notify: noop,
      onEmit: noop,
      __dev__: true,
    } as any);

    const { on, off } = component.claim();
    on();
    off();
    const readTrigger = subscribeSpy.mock.calls[0][0] as any;
    for (let i = 0; i < 99; i++) {
      readTrigger({ data: 1, prevData: 0, version: 1, writeFn: undefined, writeParamsObj: undefined });
    }
    expect(warnSpy).toHaveBeenCalledTimes(1);
    on();
    off();
    const readTrigger2 = subscribeSpy.mock.calls[1][0] as any;
    readTrigger2({ data: 1, prevData: 0, version: 1, writeFn: undefined, writeParamsObj: undefined });
    expect(warnSpy).toHaveBeenCalledTimes(2);
    readTrigger2({ data: 1, prevData: 0, version: 1, writeFn: undefined, writeParamsObj: undefined });
    expect(warnSpy).toHaveBeenCalledTimes(2);
    subscribeSpy.mockRestore();
  });
});

// ─── result.prevData ──────────────────────────────────────────────────────

describe('dx result.prevData', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('prevData reflects the value from the previous run', async () => {
    const snapshots: { data: number; prevData: number }[] = [];

    const component = dx({
      init: { dxId: 'prevdata-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i: any, r: any) => snapshots.push({ data: r.data, prevData: r.prevData }),
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

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
      run: (_i: any, r: any) => { capturedResult = r; },
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

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
      run: (_i: any, r: any) => snapshots.push({ writeFn: r.writeFn, writeParamsObj: r.writeParamsObj }),
      notify: noop,
      onEmit: noop,
      __dev__: false,
    } as any);

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

// ─── DEV notify side of WARN events ──────────────────────────────────────

describe('dx DEV warnings also route through notify', () => {
  let warnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    resetStore();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    resetStore();
    warnSpy.mockRestore();
  });

  it('routes WARN_reentrant_run through notify with correct componentId', () => {
    const notify = createSpy();
    let runCount = 0;

    const component = dx({
      init: { dxId: 'warn-notify-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: () => {
        runCount++;
        if (runCount === 2) trigger(incrementCounterByTeam, { team: 'right' });
      },
      notify,
      onEmit: noop,
      __dev__: true,
    } as any);

    const { on, off } = component.claim();
    on();
    trigger(incrementCounterByTeam, { team: 'right' });
    expect(notify).toHaveBeenCalledWith('WARN_reentrant_run', expect.objectContaining({ componentId: 'warn-notify-01' }));
    off();
  });

  it('routes WARN_late_callback through notify with componentId and totalDropped', () => {
    const notify = createSpy();

    const subscribeSpy = jest.spyOn(adaxCore, 'subscribe').mockImplementation(((readTrigger: any) => ({
      result: { data: 0, prevData: 0, version: 0, writeFn: undefined, writeParamsObj: undefined },
      on: jest.fn(),
      off: jest.fn(),
    })) as any);

    const component = dx({
      init: { dxId: 'warn-notify-02', team: 'right' },
      queryFn: getCounterByTeam,
      run: noop,
      notify,
      onEmit: noop,
      __dev__: true,
    } as any);

    const { on, off } = component.claim();
    on();
    off();
    const readTrigger = subscribeSpy.mock.calls[0][0] as any;
    readTrigger({ data: 1, prevData: 0, version: 1, writeFn: undefined, writeParamsObj: undefined });
    expect(notify).toHaveBeenCalledWith('WARN_late_callback', expect.objectContaining({
      componentId: 'warn-notify-02',
      totalDropped: 1,
    }));
    subscribeSpy.mockRestore();
  });
});

// ─── trigger() inside beforeOn ────────────────────────────────────────────

describe('dx trigger() inside beforeOn', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('does not crash when trigger() is called inside beforeOn (notification silently dropped)', () => {
    const run = createSpy();
    const notify = createSpy();

    const component = dx({
      init: { dxId: 'gap-01', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      onEmit: noop,
      beforeOn: () => {
        trigger(incrementCounterByTeam, { team: 'right' });
      },
      __dev__: false,
    } as any);

    const { on, off } = component.claim();
    expect(() => on()).not.toThrow();
    expect(notify).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
    // The run function now receives 4 arguments: init, result, ctx, emit
    expect(run).toHaveBeenCalledWith(
      expect.anything(),        // init
      expect.objectContaining({ data: 1 }), // result
      expect.anything(),        // ctx
      expect.any(Function)      // emit
    );
    off();
  });
});