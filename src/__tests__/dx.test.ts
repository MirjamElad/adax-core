import { jest } from '@jest/globals';
import { dx, trigger, addRule, clearAllRules, KernelStore } from '../index';
import * as adaxCore from '../index'; // Add this to your imports at the top

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
const createSpy = () => jest.fn();

// ─── Browser tests ────────────────────────────────────────────────────────────

describe('dx WITHOUT rules (Browser)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('run fires immediately on activation with initial snapshot', () => {
    const run = createSpy();

    const component = dx({
      init: { dxId: 'browser-01', team: 'right' },
      //@ts-ignore
      queryFn: getCounterByTeam,
      run: (_i, r, ctx) => run(r.data, ctx.runIndex),
      notify: noop,
      __dev__: false,
    });

    const { on, off } = component.claim();
    on();

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenLastCalledWith(0, 0);

    off();
  });

  it('initial run is based on state at activation time (silent pre-mutation ignored)', async () => {
    incrementCounterByTeam({ team: 'right' }); // happens BEFORE subscribe
    incrementCounterByTeam({ team: 'right' }); // happens BEFORE subscribe
    await wait();

    const run = createSpy();

    const component = dx({
      init: { dxId: 'browser-02', team: 'right' },
      //@ts-ignore
      queryFn: getCounterByTeam,
      run: (_i, r) => run(r.data),
      notify: noop,
      __dev__: false,
    });

    const { on, off } = component.claim();
    on();

    // FIX: correct behavior is snapshot-at-subscribe, not pre-mutation capture
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenLastCalledWith(2);

    off();
  });

  it('reacts to changes AFTER subscription', async () => {
    const run = createSpy();

    const component = dx({
      init: { dxId: 'browser-03', team: 'right' },
      //@ts-ignore
      queryFn: getCounterByTeam,
      run: (_i, r) => run(r.data),
      notify: noop,
      __dev__: false,
    });

    const { on, off } = component.claim();
    on();
    // first trigger
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    // second trigger
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    // initial run + 2 triggers
    expect(run.mock.calls.length).toEqual(3);

    off();
  });

  it('ignores unrelated store changes', async () => {
    const run = createSpy();

    const component = dx({
      init: { dxId: 'browser-04', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i, r) => run(r.data),
      notify: noop,
      __dev__: false,
    });

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
      //@ts-ignore
      queryFn: getCounterByTeam,
      run: (_i, r) => run(r.data),
      notify: noop,
      __dev__: false,
    });

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
      __dev__: false,
    });

    component.claim(); // First claim is fine
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
      __dev__: false,
    });

    const component2 = dx({
      init: { dxId: 'ownership-02', team: 'right' }, // Same dxId
      queryFn: getCounterByTeam,
      run,
      notify,
      __dev__: false,
    });

    const { on: on1, off: off1 } = component1.claim();
    const { on: on2 } = component2.claim();

    on1(); // Activates successfully
    on2(); // Should fail and notify error

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      "ERROR_dxId_collision",
      expect.objectContaining({
        error: expect.objectContaining({ message: expect.stringContaining('already active') })
      })
    );

    // Component 2's run should never have fired
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
      __dev__: false,
    });

    const component2 = dx({
      init: { dxId: 'ownership-03', team: 'right' }, // Same dxId
      queryFn: getCounterByTeam,
      run,
      notify,
      __dev__: false,
    });

    const { on: on1, off: off1 } = component1.claim();
    const { on: on2, off: off2 } = component2.claim();

    on1();
    expect(run).toHaveBeenCalledTimes(1); // Initial run for comp 1
    
    off1(); // Free up the dxId
    
    on2(); // Should succeed without errors
    expect(notify).not.toHaveBeenCalled(); 
    expect(run).toHaveBeenCalledTimes(2); // Initial run for comp 2

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
      beforeOn,
      beforeOff,
      __dev__: false,
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
    const run = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-02', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      beforeOn: () => { throw new Error("Sync boom!"); },
      onBeforeOnFail,
      __dev__: false,
    });

    const { on, off } = component.claim();
    on();

    // Should notify the error
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_beforeOn", expect.objectContaining({
      error: expect.objectContaining({ message: "Sync boom!" })
    }));

    // Should trigger the failure hook
    expect(onBeforeOnFail).toHaveBeenCalledTimes(1);

    // Run should NOT have been called (activation aborted)
    expect(run).not.toHaveBeenCalled();

    // Verify it remains inactive by triggering a state change
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    
    expect(run).not.toHaveBeenCalled();
    
    off(); // Cleanup safely
  });

  it('aborts activation if beforeOn returns a Promise', () => {
    const notify = createSpy();
    const run = createSpy();

    const component = dx({
      init: { dxId: 'lifecycle-03', team: 'right' },
      queryFn: getCounterByTeam,
      run,
      notify,
      beforeOn: () => Promise.resolve(), // INVALID: returning a promise
      __dev__: false,
    });

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
      // FIX: Use a pending promise instead of Promise.reject() to avoid 
      // crashing the Jest worker with an unhandled rejection in Node v25
      beforeOff: () => new Promise(() => {}), 
      __dev__: false,
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
      run: (_i, _r, ctx) => { runIndexes.push(ctx.runIndex); },
      notify: noop,
      __dev__: false,
    });

    const { on, off } = component.claim();
    
    // 1. Initial activation
    on();
    expect(runIndexes).toEqual([0]);

    // 2. First trigger
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(runIndexes).toEqual([0, 1]);

    // 3. Second trigger
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();
    expect(runIndexes).toEqual([0, 1, 2]);

    // 4. Deactivate and reactivate
    off();
    on();
    expect(runIndexes).toEqual([0, 1, 2, 0]); // Reset back to 0

    off();
  });

  it('isActiveExecution() returns false if off() is called during async run', async () => {
    let capturedIsActive: boolean | null = null;

    const component = dx({
      init: { dxId: 'ctx-02', team: 'right' },
      queryFn: getCounterByTeam,
      run: async (_i, _r, ctx) => {
        await wait(20); // Simulate async work
        capturedIsActive = ctx.isActiveExecution();
      },
      notify: noop,
      __dev__: false,
    });

    const { on, off } = component.claim();
    
    on(); // Initial run starts async work
    off(); // Called BEFORE the 20ms wait finishes

    // Wait for the async run to finish resolving
    await wait(30);

    // The execution token incremented during off(), so isActiveExecution should be false
    expect(capturedIsActive).toBe(false);
  });

  it('isLatestRun() returns false if a subsequent trigger superseded the current async run', async () => {
    const capturedIsLatest: boolean[] = [];

    const component = dx({
      init: { dxId: 'ctx-03', team: 'right' },
      queryFn: getCounterByTeam,
      run: async (_i, _r, ctx) => {
        await wait(10); // Simulate network/delayed work
        capturedIsLatest.push(ctx.isLatestRun());
      },
      notify: noop,
      __dev__: false,
    });

    const { on, off } = component.claim();
    on(); // 1. Queues initial async run (runToken 1)

    // Fire trigger 1 (starts async work, gets runToken 2)
    trigger(incrementCounterByTeam, { team: 'right' });
    
    // Fire trigger 2 immediately after (starts async work, gets runToken 3)
    // This runs synchronously before trigger 1's await finishes because 
    // adax-core view triggers are synchronous.
    trigger(incrementCounterByTeam, { team: 'right' });

    // Wait for all 3 async runs to resolve
    await wait(30);

    // The initial run and first trigger should realize they're no longer the latest
    // The second trigger should realize it IS the latest
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
      __dev__: false,
    });

    const { on, off } = component.claim();
    
    // Initial run throws synchronously
    on(); 

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_run_sync", expect.objectContaining({
      error: expect.objectContaining({ message: "Sync run boom!" })
    }));

    // Prove the component is NOT broken and remains active
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();

    expect(callCount).toBe(2); // Second run executed successfully without throwing
    
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
      __dev__: false,
    });

    const { on, off } = component.claim();
    
    // Initial run rejects asynchronously
    on(); 
    await wait(); // Let the promise rejection settle and hit the .catch() handler

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_run_async", expect.objectContaining({
      error: expect.objectContaining({ message: "Async run boom!" })
    }));

    // Prove the component is NOT broken and remains active
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();

    expect(callCount).toBe(2); // Second run executed successfully
    
    off();
  });
});

// ─── adax-core Options Passthrough ────────────────────────────────────────────

describe('dx adax-core Options Passthrough', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('passing skipInitialQuerying: true passes undefined data to the initial run', async () => {
    const run = createSpy();
    const notify = createSpy(); // Changed from noop to spy

    const component = dx({
      init: { dxId: 'opts-01', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i, r) => run(r.data),
      notify,
      queryOptions: { skipInitialQuerying: true },
      __dev__: false,
    });

    const { on, off } = component.claim();
    on();

    // 1. Ensure no hidden errors were swallowed during setup/initial run
    expect(notify).not.toHaveBeenCalledWith("ERROR", expect.anything());

    // 2. dx.ts unconditionally calls invokeRun(sub.result) on activation.
    // Because of skipInitialQuerying, adax-core did not run the query yet.
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenLastCalledWith(undefined); // data is undefined

    // 3. When a trigger happens, adax-core evaluates the query normally
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith(1); // data is now 1

    off();
  });

  it('respects hasResultChanged returning false to prevent subsequent runs', async () => {
    const run = createSpy();
    const notify = createSpy(); // Changed from noop to spy

    const component = dx({
      init: { dxId: 'opts-02', team: 'right' },
      queryFn: getCounterByTeam,
      run: (_i, r) => run(r.data),
      notify,
      queryOptions: { hasResultChanged: () => false }, 
      __dev__: false,
    });

    const { on, off } = component.claim();
    on();

    // 1. Ensure no hidden errors were swallowed during setup/initial run
    expect(notify).not.toHaveBeenCalledWith("ERROR", expect.anything());

    // 2. Initial run always happens via dx.ts
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenLastCalledWith(0);

    // 3. Trigger a state change (0 -> 1)
    trigger(incrementCounterByTeam, { team: 'right' });
    await wait();

    // 4. hasResultChanged returned false, so run should NOT be called again
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
      // adax-core throws synchronously if both are provided
      queryOptions: { debounceMs: 100, throttleMs: 100 },
      __dev__: false,
    });

    const { on, off } = component.claim();
    on();

    // dx.ts wraps subscribe() in a try/catch, so it should catch the error
    // from adax-core and route it to notify()
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("ERROR_subscribe", expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining("Cannot have both debounce and throttle") })
    }));

    // Component should have failed to activate, so run was never called
    expect(run).not.toHaveBeenCalled();

    off();
  });
});


/*
the unit test file does not verify all paths and edge cases. While it covers the happy paths, basic error handling, and core RunContext mechanics well, there are several notable gaps based on the implementation and documentation.

Here are the categories you should test further:

1. DEV Mode Warnings (Completely Untested)
The __dev__: true flag enables specific warnings that are currently untested:

Re-entrant run warning: Triggering a state change synchronously inside run() while isRunning is true.
Late callback discarded warning: An adax-core notification arriving after off() has been called.
Warning sampling: Verifying that the late callback warning fires on the 1st occurrence and then every 100th occurrence (resetting on new activations).
2. Lifecycle Hook Edge Cases
onBeforeOnFail throwing: If the rollback hook itself throws, dx should emit a second notify("ERROR", ...) and still abort activation.
beforeOff throwing: If beforeOff throws a synchronous error, it should route to notify("ERROR", ...), but the deactivation lifecycle must still complete fully (component becomes inactive).
3. RunContext Nuances
runToken monotonic increase: Unlike runIndex, runToken should never reset, even across multiple on()/off() cycles.
Unguardable side effects: Testing that synchronous code executing before the first await in an async run() cannot be prevented by off() (since the guards are checked post-await).
4. Advanced adax-core Options & Integration
debounceMs and throttleMs execution: Verifying that these options actually work and delay/throttle the run function as expected, rather than just testing that passing both throws an error.
cmpId override enforcement: Explicitly passing a cmpId in queryOptions to prove dx silently overrides it with init.dxId.
Rule skip conditions: Testing a rule with a skip function to ensure specific parameterized instances are excluded from the plan.
Custom stores passthrough: Verifying that a custom stores object (e.g., { kernel: myKernelStore }) is correctly passed down to adax-core's subscribe.
5. Reconciler & State Coalescing
Rapid synchronous toggling: Calling on(), off(), and on() synchronously in the same tick to verify the reconciler correctly coalesces the state and leaves the component active.
Explicit No-op tests: Explicitly asserting that calling on() when already active, or off() when already inactive, does not trigger hooks or reset counters.
6. Error Propagation
notify throwing: The documentation explicitly states: "if it throws, the error propagates". There is no test verifying that an error thrown inside notify actually bubbles up to the calling scope.
7. The subscribe() Gap
Triggering inside initial run or beforeOn: Calling trigger() during the initial run() invocation (which happens between subscribe() and sub.on()). According to the docs, adax-core drops this notification silently, and dx should handle this without crashing.

*/

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
          // We skip the initial run (runCount 1) because sub.on() hasn't happened yet.
          // On the second run (runCount 2), we are inside a valid trigger notification.
          if (runCount === 2) {
            trigger(incrementCounterByTeam, { team: 'right' });
          }
        },
        notify: noop,
        __dev__: true, // Must be explicitly true in Jest (non-Node env defaults to false)
      });

      const { on, off } = component.claim();
      on(); // runCount = 1 (initial run)
      
      // Fire a trigger to start the second run
      trigger(incrementCounterByTeam, { team: 'right' }); 
      
      // During the second run, we called trigger() synchronously.
      // This forces a 3rd invokeRun while isRunning === true.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Re-entrant run detected')
      );

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
        beforeOn: () => { throw new Error("beforeOn failed!"); },
        onBeforeOnFail: () => { throw new Error("onBeforeOnFail also failed!"); },
        __dev__: false,
      });

      const { on, off } = component.claim();
      on();

      // 1. notify should have been called exactly twice
      expect(notify).toHaveBeenCalledTimes(2);

      // 2. First error is from beforeOn
      expect(notify).toHaveBeenNthCalledWith(
        1,
        "ERROR_beforeOn",
        expect.objectContaining({
          error: expect.objectContaining({ message: "beforeOn failed!" })
        })
      );

      // 3. Second error is from onBeforeOnFail
      expect(notify).toHaveBeenNthCalledWith(
        2,
        "ERROR_onBeforeOnFail",
        expect.objectContaining({
          error: expect.objectContaining({ message: "onBeforeOnFail also failed!" })
        })
      );

      // 4. Activation must have still aborted
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
        beforeOff: () => { throw new Error("beforeOff failed!"); },
        __dev__: false,
      });

      const { on, off } = component.claim();
      
      // Activate successfully
      on();
      expect(run).toHaveBeenCalledTimes(1);

      // Deactivate (which will trigger the error)
      off();

      // 1. The error should have been routed to notify
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith(
        "ERROR_beforeOff",
        expect.objectContaining({
          error: expect.objectContaining({ message: "beforeOff failed!" })
        })
      );

      // 2. Prove the lifecycle actually completed (component is inactive).
      // If it didn't fully deactivate, this trigger would cause a second run.
      trigger(incrementCounterByTeam, { team: 'right' });
      await wait();

      expect(run).toHaveBeenCalledTimes(1); // Still exactly 1
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
        run: (_i, _r, ctx) => { runTokens.push(ctx.runToken); },
        notify: noop,
        __dev__: false,
      });

      const { on, off } = component.claim();
      
      // 1. First activation cycle
      on();                                              // runToken 1 (initial)
      trigger(incrementCounterByTeam, { team: 'right' });
      await wait();                                      // runToken 2
      trigger(incrementCounterByTeam, { team: 'right' });
      await wait();                                      // runToken 3

      // 2. Second activation cycle
      off();
      on();                                              // runToken 4 (initial)
      trigger(incrementCounterByTeam, { team: 'right' });
      await wait();                                      // runToken 5

      // runIndex would have reset to 0 here, but runToken keeps going up
      expect(runTokens).toEqual([1, 2, 3, 4, 5]);

      off();
    });

    it('synchronous side effects BEFORE an await cannot be guarded by off()', async () => {
      const syncEffects: string[] = [];
      const guardedEffects: string[] = [];

      const component = dx({
        init: { dxId: 'ctx-nuance-02', team: 'right' },
        queryFn: getCounterByTeam,
        run: async (_i, _r, ctx) => {
          // This synchronous side effect happens IMMEDIATELY when run() is called.
          // It cannot be cancelled by off() because JavaScript is single-threaded
          // and off() hasn't had a chance to execute yet.
          syncEffects.push('sync-ran');

          await wait(20); // Yield to the event loop. off() will execute here.

          // NOW we check the guard. Because off() was called during the await,
          // this execution is no longer active.
          if (ctx.isActiveExecution()) {
            guardedEffects.push('guarded-ran');
          }
        },
        notify: noop,
        __dev__: false,
      });

      const { on, off } = component.claim();
      
      // Start the initial async run, then immediately deactivate
      on();
      off(); 

      // Wait for the async run to finish resolving
      await wait(30);

      // The synchronous part executed before off() could stop it
      expect(syncEffects).toEqual(['sync-ran']);
      
      // The guarded part correctly detected the lifecycle transition and skipped
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
        // We attempt to sneak in a different cmpId
        queryOptions: { cmpId: 'cmp-override-fake' },
        __dev__: false,
      });

      const component2 = dx({
        init: { dxId: 'cmp-override-real', team: 'right' }, // Same dxId as comp1
        queryFn: getCounterByTeam,
        run,
        notify,
        __dev__: false,
      });

      const { on: on1, off: off1 } = component1.claim();
      const { on: on2 } = component2.claim();

      on1(); // Activates successfully, registering cmpId "cmp-override-real"
      
      // If dx DID NOT override cmpId, component2 would register as "cmp-override-fake"
      // and this on2() would succeed without collision. 
      // Because dx DOES override it to "cmp-override-real", it collides.
      on2(); 

      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith(
        "ERROR_dxId_collision",
        expect.objectContaining({
          error: expect.objectContaining({ message: expect.stringContaining('already active') })
        })
      );

      off1();
    });

    it('correctly passes through and respects adax-core rule skip conditions', async () => {
      // Add a rule that links the write and query, but with a skip condition
      addRule({ 
        writeFn: incrementCounterByTeam, 
        queryFn: getCounterByTeam,
        // Skip if the team targeted by the write doesn't match the team subscribed to
        skip: (writeArgs: any, readArgs: any) => writeArgs.team !== readArgs.team
      });

      const run = createSpy();

      const component = dx({
        init: { dxId: 'rule-skip-01', team: 'right' },
        queryFn: getCounterByTeam,
        run: (_i, r) => run(r.data),
        notify: noop,
        __dev__: false,
      });

      const { on, off } = component.claim();
      on();

      // 1. Trigger for the 'left' team. 
      // The rule matches the queryFn, but the skip condition evaluates to true ('left' !== 'right').
      trigger(incrementCounterByTeam, { team: 'left' });
      await wait();

      // Only the initial run should have fired. The skip condition prevented the notification.
      expect(run).toHaveBeenCalledTimes(1);
      expect(run).toHaveBeenLastCalledWith(0);

      // 2. Trigger for the 'right' team.
      // The rule matches, and the skip condition evaluates to false ('right' === 'right').
      trigger(incrementCounterByTeam, { team: 'right' });
      await wait();

      // Initial run + forced rule run = 2
      expect(run).toHaveBeenCalledTimes(2);
      expect(run).toHaveBeenLastCalledWith(1);

      off();
    });
    
    it('isolates subscriptions and triggers using a custom KernelStore', async () => {
      const myKernel = new KernelStore();
      const run = createSpy();

      const component = dx({
        init: { dxId: 'isolated-01', team: 'right' },
        // testStore is safely captured here in the default parameter
        queryFn: getCounterByTeam, 
        run: (_i, r) => run(r.data),
        notify: noop,
        // ONLY pass the kernel configuration to dx
        stores: { kernel: myKernel }, 
        __dev__: false,
      });

      const { on, off } = component.claim();
      on();

      // 1. Trigger explicitly targeting the custom kernel
      trigger(incrementCounterByTeam, { team: 'right' }, { kernel: myKernel });
      await wait();

      expect(run).toHaveBeenCalledTimes(2); // Initial run + trigger
      expect(run).toHaveBeenLastCalledWith(1);

      // 2. Trigger targeting the DEFAULT global kernel (no 3rd argument)
      trigger(incrementCounterByTeam, { team: 'right' });
      await wait();

      // Still exactly 2 calls, proving the custom kernel isolated the state
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
        beforeOn,
        __dev__: false,
      });

      const { on, off } = component.claim();
      on();
      expect(beforeOn).toHaveBeenCalledTimes(1);

      // Call on() again while already active
      on();
      expect(beforeOn).toHaveBeenCalledTimes(1); // Still exactly 1

      off();
    });

    it('calling off() while already inactive is a no-op and does not re-run hooks', () => {
      const beforeOff = createSpy();

      const component = dx({
        init: { dxId: 'reconciler-02', team: 'right' },
        queryFn: getCounterByTeam,
        run: noop,
        notify: noop,
        beforeOff,
        __dev__: false,
      });

      const { on, off } = component.claim();
      on();
      off();
      expect(beforeOff).toHaveBeenCalledTimes(1);

      // Call off() again while already inactive
      off();
      expect(beforeOff).toHaveBeenCalledTimes(1); // Still exactly 1
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
        beforeOn,
        beforeOff,
        __dev__: false,
      });

      const { on, off } = component.claim();
      
      // Rapid synchronous toggling
      on();  // 1. Activate (beforeOn: 1, run: 1)
      off(); // 2. Deactivate (beforeOff: 1)
      on();  // 3. Reactivate (beforeOn: 2, run: 2)

      expect(beforeOn).toHaveBeenCalledTimes(2);
      expect(beforeOff).toHaveBeenCalledTimes(1);
      expect(run).toHaveBeenCalledTimes(2); // Initial run for both activations

      // Prove it is actually active by triggering a state change
      trigger(incrementCounterByTeam, { team: 'right' });
      await wait();

      expect(run).toHaveBeenCalledTimes(3); // 2 initial + 1 trigger

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
        __dev__: false,
      });

      const { on, off } = component.claim();
      
      // dx catches the error from run(), passes it to notify(), 
      // but if notify() throws, it MUST bubble up uncaught to the caller.
      expect(() => on()).toThrow("Notify exploded!");
      
      off();
    });

    it('propagates the error if notify() throws when beforeOn() fails', () => {
      const component = dx({
        init: { dxId: 'err-prop-02', team: 'right' },
        queryFn: getCounterByTeam,
        run: noop,
        beforeOn: () => { throw new Error("beforeOn failed!"); },
        notify: () => { throw new Error("Notify exploded!"); },
        __dev__: false,
      });

      const { on, off } = component.claim();
      
      // dx catches the error from beforeOn(), passes it to notify(), 
      // but if notify() throws, it MUST bubble up uncaught to the caller.
      expect(() => on()).toThrow("Notify exploded!");
      
      off();
    });

    it('propagates the error if notify() throws when beforeOff() fails', () => {
      const component = dx({
        init: { dxId: 'err-prop-03', team: 'right' },
        queryFn: getCounterByTeam,
        run: noop,
        beforeOff: () => { throw new Error("beforeOff failed!"); },
        notify: () => { throw new Error("Notify exploded!"); },
        __dev__: false,
      });

      const { on, off } = component.claim();
      on(); // Activate successfully first
      
      // dx catches the error from beforeOff(), passes it to notify(), 
      // but if notify() throws, it MUST bubble up uncaught to the caller.
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
      // Clear NODE_ENV by default to simulate non-Node environments
      process.env = { ...originalEnv, NODE_ENV: undefined };
    });
    
    afterEach(() => {
      resetStore();
      warnSpy.mockRestore();
      process.env = originalEnv; // Restore original env
    });

    it('resolves DEV to false if __dev__ is omitted in a non-Node environment', () => {
      let runCount = 0;
      const component = dx({
        init: { dxId: 'dev-resolve-01', team: 'right' },
        queryFn: getCounterByTeam,
        run: () => {
          runCount++;
          if (runCount === 2) trigger(incrementCounterByTeam, { team: 'right' }); // Re-entrant
        },
        notify: noop,
        // __dev__ omitted, process.env.NODE_ENV is undefined
      });

      const { on, off } = component.claim();
      on();
      trigger(incrementCounterByTeam, { team: 'right' });

      expect(warnSpy).not.toHaveBeenCalled(); // DEV is false
      off();
    });

    it('resolves DEV to true via process.env.NODE_ENV === "development"', () => {
      process.env.NODE_ENV = 'development'; // Set Node env

      let runCount = 0;
      const component = dx({
        init: { dxId: 'dev-resolve-02', team: 'right' },
        queryFn: getCounterByTeam,
        run: () => {
          runCount++;
          if (runCount === 2) trigger(incrementCounterByTeam, { team: 'right' }); // Re-entrant
        },
        notify: noop,
        // __dev__ omitted, but NODE_ENV is 'development'
      });

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
      });

      const { on, off } = component.claim();
      on();
      trigger(incrementCounterByTeam, { team: 'right' });

      expect(warnSpy).not.toHaveBeenCalled(); // DEV is false
      off();
    });

    it('samples late callback warnings: fires on 1st and 100th occurrences', () => {
      // Isolate dx from adax-core by mocking subscribe
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
        __dev__: true,
      });

      const { on, off } = component.claim();
      on();  // Activate
      off(); // Deactivate (actualState is now 'inactive')

      // Extract the readTrigger callback that dx passed to the mock subscribe
      const readTrigger = subscribeSpy.mock.calls[0][0];

      // Simulate exactly 100 late callbacks arriving from adax-core
            // Simulate exactly 100 late callbacks arriving from adax-core
      for (let i = 0; i < 100; i++) {
        readTrigger({ 
          data: 1, 
          prevData: 0, 
          version: 1,
          writeFn: undefined,       // Add missing properties
          writeParamsObj: undefined // Add missing properties
        });
      }

      // With correct sampling logic, it should ONLY warn on the 1st and 100th
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('(total: 100)')
      );

      subscribeSpy.mockRestore();
    });

    it('warns if a debounced callback arrives after off() (late callback)', async () => {
      const component = dx({
        init: { dxId: 'dev-02', team: 'right' },
        queryFn: getCounterByTeam,
        run: noop,
        notify: noop,
        queryOptions: { debounceMs: 50 }, 
        __dev__: true,
      });

      const { on, off } = component.claim();
      on(); 
      
      trigger(incrementCounterByTeam, { team: 'right' });
      off(); // Deactivate before the 50ms resolves

      await wait(100); // Let the debounce timer resolve

      // Now it correctly yields exactly 1 warning
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Late callback discarded')
      );
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
        run: (_i, r) => run(r.data),
        notify: noop,
        queryOptions: { throttleMs: 100 },
        __dev__: false,
      });

      const { on, off } = component.claim();
      on(); // Initial run (not throttled — dx always calls invokeRun unconditionally)

      // First trigger: fires immediately (throttle leading edge)
      trigger(incrementCounterByTeam, { team: 'right' });
      await wait(10); // well within throttle window
      expect(run).toHaveBeenCalledTimes(2); // initial + first trigger

      // Second trigger within the throttle window: leading edge suppressed,
      // but adax-core's throttle also fires a trailing-edge call once the
      // window expires — so after waiting we expect 3 total, not 2.
      trigger(incrementCounterByTeam, { team: 'right' });
      await wait(10);
      expect(run).toHaveBeenCalledTimes(2); // leading edge suppressed immediately

      // Wait for the throttle window to expire — trailing edge fires here
      await wait(120);
      expect(run).toHaveBeenCalledTimes(3); // trailing edge of second trigger

      // Third trigger after window has fully expired: fires immediately again
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
        onBeforeOnFail,
        // adax-core throws synchronously when both are provided — forces subscribe() to throw
        queryOptions: { debounceMs: 100, throttleMs: 100 },
        __dev__: false,
      });

      const { on, off } = component.claim();
      on();

      // subscribe() threw → ERROR_subscribe emitted
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith(
        'ERROR_subscribe',
        expect.objectContaining({
          error: expect.objectContaining({ message: expect.stringContaining('Cannot have both debounce and throttle') })
        })
      );

      // onBeforeOnFail must NOT have been called — it is only for beforeOn failures
      expect(onBeforeOnFail).not.toHaveBeenCalled();

      // run must NOT have been called — activation aborted
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
        __dev__: true,
      });

      const { on, off } = component.claim();

      // ── First activation cycle ──
      on();
      off();

      const readTrigger = subscribeSpy.mock.calls[0][0] as any;

      // Drop 99 late callbacks — only the 1st should warn
      for (let i = 0; i < 99; i++) {
        readTrigger({ data: 1, prevData: 0, version: 1, writeFn: undefined, writeParamsObj: undefined });
      }
      expect(warnSpy).toHaveBeenCalledTimes(1); // Only the 1st

      // ── Second activation cycle ──
      on();  // droppedRunCount resets to 0
      off();

      const readTrigger2 = subscribeSpy.mock.calls[1][0] as any;

      // Drop 1 late callback — counter was reset, so this IS the 1st → must warn
      readTrigger2({ data: 1, prevData: 0, version: 1, writeFn: undefined, writeParamsObj: undefined });
      expect(warnSpy).toHaveBeenCalledTimes(2); // Previous 1 + this new 1st

      // Drop a 2nd late callback — 2nd since reset, not 100th → must NOT warn
      readTrigger2({ data: 1, prevData: 0, version: 1, writeFn: undefined, writeParamsObj: undefined });
      expect(warnSpy).toHaveBeenCalledTimes(2); // Still 2

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
        run: (_i, r) => snapshots.push({ data: r.data, prevData: r.prevData }),
        notify: noop,
        __dev__: false,
      });

      const { on, off } = component.claim();
      on(); // Initial run: data=0, prevData=0 (no prior result)

      trigger(incrementCounterByTeam, { team: 'right' });
      await wait();

      trigger(incrementCounterByTeam, { team: 'right' });
      await wait();

      // Initial run
      expect(snapshots[0].data).toBe(0);

      // First trigger: counter went 0 → 1
      expect(snapshots[1].data).toBe(1);
      expect(snapshots[1].prevData).toBe(0);

      // Second trigger: counter went 1 → 2
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
        run: (_i, r) => { capturedResult = r; },
        notify: noop,
        __dev__: false,
      });

      const { on, off } = component.claim();
      on();

      trigger(incrementTeam, undefined);
      await wait();

      // data and prevData must be distinct references
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
        run: (_i, r) => snapshots.push({ writeFn: r.writeFn, writeParamsObj: r.writeParamsObj }),
        notify: noop,
        __dev__: false,
      });

      const { on, off } = component.claim();
      on(); // Initial run — writeFn is undefined (no trigger yet)

      trigger(incrementCounterByTeam, { team: 'right' });
      await wait();

      // Initial run has no associated write
      expect(snapshots[0].writeFn).toBeUndefined();
      expect(snapshots[0].writeParamsObj).toBeUndefined();

      // Triggered run carries the write identity
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
        __dev__: true,
      });

      const { on, off } = component.claim();
      on();
      trigger(incrementCounterByTeam, { team: 'right' });

      expect(notify).toHaveBeenCalledWith(
        'WARN_reentrant_run',
        expect.objectContaining({ componentId: 'warn-notify-01' })
      );

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
        __dev__: true,
      });

      const { on, off } = component.claim();
      on();
      off();

      const readTrigger = subscribeSpy.mock.calls[0][0] as any;
      readTrigger({ data: 1, prevData: 0, version: 1, writeFn: undefined, writeParamsObj: undefined });

      expect(notify).toHaveBeenCalledWith(
        'WARN_late_callback',
        expect.objectContaining({
          componentId: 'warn-notify-02',
          totalDropped: 1,
        })
      );

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
        beforeOn: () => {
          // Dangerous: called before subscribe() and sub.on().
          // adax-core silently drops this notification since the subscription
          // is not yet mounted. dx must not crash.
          trigger(incrementCounterByTeam, { team: 'right' });
        },
        __dev__: false,
      });

      const { on, off } = component.claim();

      // Must not throw
      expect(() => on()).not.toThrow();

      // No errors should have been routed to notify
      expect(notify).not.toHaveBeenCalled();

      // The initial run still fires (state was mutated silently before subscribe)
      expect(run).toHaveBeenCalledTimes(1);
      expect(run).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: 1 }), // mutation happened, snapshot captures it
        expect.anything()
      );

      off();
    });
  });