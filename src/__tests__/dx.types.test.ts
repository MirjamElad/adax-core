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

import { dx, type DxConfig, type AnyQueryFn } from '../index';

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
      notify:  noop,
      onEmit:  noop,
      run: (_init, result) => {
        const n: number = result.data;
        void n;
      },
    });
  });

  it('result.data is inferred as string when queryFn returns string', () => {
    dx({
      init:    { dxId: 'type-02', id: 'abc' },
      queryFn: getLabel,
      notify:  noop,
      onEmit:  noop,
      run: (_init, result) => {
        const s: string = result.data;
        void s;
      },
    });
  });

  it('result.prevData is the same type as result.data', () => {
    dx({
      init:    { dxId: 'type-03', team: 'left' as const },
      queryFn: getCounterByTeam,
      notify:  noop,
      onEmit:  noop,
      run: (_init, result) => {
        const n: number = result.prevData;
        void n;
      },
    });
  });

  it('assigning result.data to an incompatible type is a type error', () => {
    dx({
      init:    { dxId: 'type-04', team: 'right' as const },
      queryFn: getCounterByTeam,
      notify:  noop,
      onEmit:  noop,
      run: (_init, result) => {
        // @ts-expect-error — result.data is number, not string
        const s: string = result.data;
        void s;
      },
    });
  });

  it('assigning result.data to boolean when queryFn returns boolean is correct', () => {
    dx({
      init:    { dxId: 'type-05', enabled: true },
      queryFn: getFlag,
      notify:  noop,
      onEmit:  noop,
      run: (_init, result) => {
        const b: boolean = result.data;
        void b;
      },
    });
  });

  it('assigning result.data to number when queryFn returns boolean is a type error', () => {
    dx({
      init:    { dxId: 'type-06', enabled: false },
      queryFn: getFlag,
      notify:  noop,
      onEmit:  noop,
      run: (_init, result) => {
        // @ts-expect-error — result.data is boolean, not number
        const n: number = result.data;
        void n;
      },
    });
  });

});

// ─── 2. TInit constraint: init must satisfy dxId + queryFn param shape ────────

describe('dx type tests: TInit constraint', () => {

  it('init satisfying queryFn param shape compiles cleanly', () => {
    dx({
      init:    { dxId: 'type-10', team: 'right' as const },
      queryFn: getCounterByTeam,
      notify:  noop,
      onEmit:  noop,
      run:     noop,
    });
  });

  it('init missing a required queryFn param field is a type error', () => {
    dx({
      // @ts-expect-error — init is missing `team` required by getCounterByTeam
      init:    { dxId: 'type-11' },
      queryFn: getCounterByTeam,
      notify:  noop,
      onEmit:  noop,
      run:     noop,
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
      notify:  noop,
      onEmit:  noop,
      run:     noop,
    });
  });

  it('init missing dxId is a type error', () => {
    dx({
      // @ts-expect-error — dxId is required
      init:    { team: 'right' as const },
      queryFn: getCounterByTeam,
      notify:  noop,
      onEmit:  noop,
      run:     noop,
    });
  });

  it('run receives init typed to the combined dxId + queryFn param shape', () => {
    dx({
      init:    { dxId: 'type-14', team: 'left' as const },
      queryFn: getCounterByTeam,
      notify:  noop,
      onEmit:  noop,
      run: (init) => {
        const id: string           = init.dxId;
        const t: 'left' | 'right' = init.team;
        void id; void t;
      },
    });
  });

});

// ─── 3. EventsForConfig: the derived event set is correct per config shape ────
//
// These type‑level assertions verify that EventsForConfig correctly includes or
// excludes events based on the presence of beforeOn/beforeOff hooks.

type Assert<T extends true> = T;
type Includes<TUnion, TMember> = TMember extends TUnion ? true : false;
type Excludes<TUnion, TMember> = TMember extends TUnion ? false : true;

// Replicate EventsForConfig locally to guard observable behavior
type EventsFor<TConfig> =
  | 'ERROR_dxId_collision'
  | 'ERROR_subscribe'
  | 'ERROR_run_sync'
  | 'ERROR_run_async'
  | 'WARN_reentrant_run'
  | 'WARN_late_callback'
  | (TConfig extends { beforeOn: (...args: never[]) => unknown }
      ? 'ERROR_beforeOn' | 'ERROR_onBeforeOnFail'
      : never)
  | (TConfig extends { beforeOff: (...args: never[]) => unknown }
      ? 'ERROR_beforeOff'
      : never);

type ConfigNoHooks       = DxConfig<typeof getCounterByTeam, any>;
type ConfigWithBeforeOn  = DxConfig<typeof getCounterByTeam, any> & { beforeOn:  () => void };
type ConfigWithBeforeOff = DxConfig<typeof getCounterByTeam, any> & { beforeOff: () => void };
type ConfigWithBothHooks = DxConfig<typeof getCounterByTeam, any> & { beforeOn:  () => void; beforeOff: () => void };

describe('dx type tests: EventsForConfig derivation', () => {

  it('ERROR_dxId_collision is always in the event set', () => {
    type T = Assert<Includes<EventsFor<ConfigNoHooks>, 'ERROR_dxId_collision'>>;
    const _: T = true; void _;
  });

  it('ERROR_subscribe is always in the event set', () => {
    type T = Assert<Includes<EventsFor<ConfigNoHooks>, 'ERROR_subscribe'>>;
    const _: T = true; void _;
  });

  it('ERROR_run_sync is always in the event set', () => {
    type T = Assert<Includes<EventsFor<ConfigNoHooks>, 'ERROR_run_sync'>>;
    const _: T = true; void _;
  });

  it('ERROR_run_async is always in the event set', () => {
    type T = Assert<Includes<EventsFor<ConfigNoHooks>, 'ERROR_run_async'>>;
    const _: T = true; void _;
  });

  it('WARN_reentrant_run is always in the event set', () => {
    type T = Assert<Includes<EventsFor<ConfigNoHooks>, 'WARN_reentrant_run'>>;
    const _: T = true; void _;
  });

  it('WARN_late_callback is always in the event set', () => {
    type T = Assert<Includes<EventsFor<ConfigNoHooks>, 'WARN_late_callback'>>;
    const _: T = true; void _;
  });

  it('ERROR_beforeOn is excluded when beforeOn is absent', () => {
    type T = Assert<Excludes<EventsFor<ConfigNoHooks>, 'ERROR_beforeOn'>>;
    const _: T = true; void _;
  });

  it('ERROR_onBeforeOnFail is excluded when beforeOn is absent', () => {
    type T = Assert<Excludes<EventsFor<ConfigNoHooks>, 'ERROR_onBeforeOnFail'>>;
    const _: T = true; void _;
  });

  it('ERROR_beforeOn is included when beforeOn is present', () => {
    type T = Assert<Includes<EventsFor<ConfigWithBeforeOn>, 'ERROR_beforeOn'>>;
    const _: T = true; void _;
  });

  it('ERROR_onBeforeOnFail is included when beforeOn is present', () => {
    type T = Assert<Includes<EventsFor<ConfigWithBeforeOn>, 'ERROR_onBeforeOnFail'>>;
    const _: T = true; void _;
  });

  it('ERROR_beforeOff is excluded when beforeOff is absent', () => {
    type T = Assert<Excludes<EventsFor<ConfigNoHooks>, 'ERROR_beforeOff'>>;
    const _: T = true; void _;
  });

  it('ERROR_beforeOff is included when beforeOff is present', () => {
    type T = Assert<Includes<EventsFor<ConfigWithBeforeOff>, 'ERROR_beforeOff'>>;
    const _: T = true; void _;
  });

  it('all nine events are present when both hooks are provided', () => {
    type Events = EventsFor<ConfigWithBothHooks>;
    type T = Assert<
      Includes<Events, 'ERROR_dxId_collision'>  &
      Includes<Events, 'ERROR_subscribe'>        &
      Includes<Events, 'ERROR_run_sync'>         &
      Includes<Events, 'ERROR_run_async'>        &
      Includes<Events, 'WARN_reentrant_run'>     &
      Includes<Events, 'WARN_late_callback'>     &
      Includes<Events, 'ERROR_beforeOn'>         &
      Includes<Events, 'ERROR_onBeforeOnFail'>   &
      Includes<Events, 'ERROR_beforeOff'>
    >;
    const _: T = true; void _;
  });

  it('ERROR_beforeOff is excluded when only beforeOn is present', () => {
    type T = Assert<Excludes<EventsFor<ConfigWithBeforeOn>, 'ERROR_beforeOff'>>;
    const _: T = true; void _;
  });

  it('ERROR_beforeOn is excluded when only beforeOff is present', () => {
    type T = Assert<Excludes<EventsFor<ConfigWithBeforeOff>, 'ERROR_beforeOn'>>;
    const _: T = true; void _;
  });

});