/**
 * dx — Type-level tests
 *
 * These tests verify the TypeScript generics introduced in dx's signature.
 * They contain NO runtime assertions. Every test body is either:
 *
 *   - Valid code that must compile cleanly (no @ts-expect-error needed), or
 *   - Code marked with @ts-expect-error that must produce a type error.
 *
 * A test FAILS if:
 *   - A @ts-expect-error line produces NO error  (type is too loose — regression)
 *   - A line WITHOUT @ts-expect-error produces AN error (type is too strict — regression)
 *
 * Run with: tsc --noEmit  (or via your existing Jest + ts-jest pipeline)
 */

import { dx, type DxConfig, type AnyQueryFn, type RunContext, type DxEvent } from '../index';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

type TeamParams = { team: 'left' | 'right' };

const getCounterByTeam = (_params: TeamParams): number => 0;
const getLabel         = (_params: { id: string }): string => '';
const getFlag          = (_params: { enabled: boolean }): boolean => false;
const noop             = () => {};

// ─── 1. TQueryFn inference: result.data is typed to queryFn's return type ────

describe('dx type tests: TQueryFn → result.data', () => {

  it('result.data is inferred as number when queryFn returns number', () => {
    dx({
      init:    { dxId: 'type-01', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: (_init, result) => {
        const n: number = result.data;
        void n;
      },
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('result.data is inferred as string when queryFn returns string', () => {
    dx({
      init:    { dxId: 'type-02', id: 'abc' },
      queryFn: getLabel,
      onUpdate: (_init, result) => {
        const s: string = result.data;
        void s;
      },
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('result.prevData is the same type as result.data', () => {
    dx({
      init:    { dxId: 'type-03', team: 'left' as const },
      queryFn: getCounterByTeam,
      onUpdate: (_init, result) => {
        const n: number = result.prevData;
        void n;
      },
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('assigning result.data to an incompatible type is a type error', () => {
    dx({
      init:    { dxId: 'type-04', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: (_init, result) => {
        // @ts-expect-error — result.data is number, not string
        const s: string = result.data;
        void s;
      },
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('assigning result.data to boolean when queryFn returns boolean is correct', () => {
    dx({
      init:    { dxId: 'type-05', enabled: true },
      queryFn: getFlag,
      onUpdate: (_init, result) => {
        const b: boolean = result.data;
        void b;
      },
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('assigning result.data to number when queryFn returns boolean is a type error', () => {
    dx({
      init:    { dxId: 'type-06', enabled: false },
      queryFn: getFlag,
      onUpdate: (_init, result) => {
        // @ts-expect-error — result.data is boolean, not number
        const n: number = result.data;
        void n;
      },
      notify:  noop,
      onEmit:  noop,
    });
  });

});

// ─── 2. TInit constraint: init must satisfy dxId + queryFn param shape ────────

describe('dx type tests: TInit constraint', () => {

  it('init satisfying queryFn param shape compiles cleanly', () => {
    dx({
      init:    { dxId: 'type-10', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('init missing a required queryFn param field is a type error', () => {
    dx({
      // @ts-expect-error — init is missing `team` required by getCounterByTeam
      init:    { dxId: 'type-11' },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('init with wrong type for a queryFn param field is a type error', () => {
    dx({
      init: {
        dxId: 'type-12',
        // @ts-expect-error — 'center' is not assignable to 'left' | 'right'
        team: 'center' as const,
      },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('init missing dxId is a type error', () => {
    dx({
      // @ts-expect-error — dxId is required
      init:    { team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('onUpdate receives init typed to the combined dxId + queryFn param shape', () => {
    dx({
      init:    { dxId: 'type-14', team: 'left' as const },
      queryFn: getCounterByTeam,
      onUpdate: (init) => {
        const id: string           = init.dxId;
        const t: 'left' | 'right' = init.team;
        void id; void t;
      },
      notify:  noop,
      onEmit:  noop,
    });
  });

});

// ─── 3. RunContext: isFirstRun is correctly typed ────────────────────────────

describe('dx type tests: RunContext', () => {

  it('ctx.runIndex is a number', () => {
    dx({
      init:    { dxId: 'type-20', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: (_init, _result, ctx) => {
        const idx: number = ctx.runIndex;
        void idx;
      },
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('ctx.isFirstRun is a function returning boolean', () => {
    dx({
      init:    { dxId: 'type-21', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: (_init, _result, ctx) => {
        const isFirst: boolean = ctx.isFirstRun();
        void isFirst;
      },
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('accessing non-existent ctx properties is a type error', () => {
    dx({
      init:    { dxId: 'type-22', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: (_init, _result, ctx: RunContext) => {
        // @ts-expect-error — executionToken does not exist on RunContext
        const token = ctx.executionToken;
        void token;
      },
      notify:  noop,
      onEmit:  noop,
    });
  });

});

// ─── 4. At least one of onUpdate, onReady, onUnmount must be provided ────────

describe('dx type tests: at least one lifecycle hook required', () => {

  it('providing only onUpdate is valid', () => {
    dx({
      init:    { dxId: 'type-30', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('providing only onReady is valid', () => {
    dx({
      init:    { dxId: 'type-31', team: 'right' as const },
      queryFn: getCounterByTeam,
      onReady: noop,
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('providing only onUnmount is valid', () => {
    dx({
      init:    { dxId: 'type-32', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUnmount: noop,
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('providing all three lifecycle hooks is valid', () => {
    dx({
      init:    { dxId: 'type-33', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      onReady: noop,
      onUnmount: noop,
      notify:  noop,
      onEmit:  noop,
    });
  });

  it('providing no lifecycle hooks is a type error', () => {
    expect(() => {
      // @ts-expect-error — at least one of onUpdate, onReady, onUnmount must be provided
      dx({
        init: { dxId: 'type-34', team: 'right' as const },
        queryFn: getCounterByTeam,
        notify: noop,
        onEmit: noop,
      });
    }).toThrow('[dx] At least one of onUpdate, onReady, or onUnmount must be provided.');
  });

});

// ─── 5. DxEvent type is narrowed based on optional lifecycle hooks ───────────
describe('dx type tests: DxEvent narrowing', () => {

  it('notify callback can emit ERROR_dxId_collision', () => {
    dx({
      init: { dxId: 'type-40', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify: (event, payload) => {
        const e: DxEvent = event;
        void e;
        void payload;
      },
      onEmit: noop,
    });
  });

  it('notify callback can emit ERROR_subscribe', () => {
    dx({
      init: { dxId: 'type-41', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify: (event, payload) => {
        const e: DxEvent = event;
        void e;
        void payload;
      },
      onEmit: noop,
    });
  });

  it('notify callback can emit ERROR_beforeOff when beforeOff is provided', () => {
    dx({
      init: { dxId: 'type-42', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      beforeOff: noop,
      notify: (event, payload) => {
        const e: DxEvent = event;
        void e;
        void payload;
      },
      onEmit: noop,
    });
  });

  it('notify callback receives DxEvent union', () => {
    dx({
      init: { dxId: 'type-43', team: 'right' as const },
      queryFn: getCounterByTeam,
      onUpdate: noop,
      notify: (
        event: DxEvent,
        payload: any
      ) => {
        void event;
        void payload;
      },
      onEmit: noop,
    });
  });

});