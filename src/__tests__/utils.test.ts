import { deepEqual } from '../store/utils';

describe('deepEqual', () => {
  it('should return true for identical objects', () => {
    const obj1 = { a: 1, b: { c: 2 } };
    const obj2 = { a: 1, b: { c: 2 } };
    expect(deepEqual(obj1, obj2)).toBe(true);
  });

  it('should return false for different primitive types', () => {
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(true, 1)).toBe(false);
  });

  it('should handle null and non-object types', () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual(undefined, null)).toBe(false);
    expect(deepEqual(42, '42')).toBe(false);
  });

  it('should handle cyclical references', () => {
    const obj1: any = {};
    obj1.self = obj1;
    const obj2: any = {};
    obj2.self = obj2;
    //TODO: Re-consider: Should we really consider obj1, obj2 to be equal even though self key points to diff objects? 
    //      NB: obj1, obj2 are structurally equivalent
    expect(deepEqual(obj1, obj2)).toBe(true); // Structurally equivalent

    const obj3: any = {};
    obj3.self = obj3;
    const obj4: any = {};
    obj4.self = obj3; // Different reference
    //TODO: Re-consider: Should we really consider obj3, obj4 to be equal even though they are structurally NOT  equivalent? 
    expect(deepEqual(obj3, obj4)).toBe(true); // Reference mismatch
  });

  it('should handle Date objects', () => {
    const date1 = new Date('2023-01-01');
    const date2 = new Date('2023-01-01');
    const date3 = new Date('2023-01-02');
    expect(deepEqual(date1, date2)).toBe(true);
    expect(deepEqual(date1, date3)).toBe(false);
  });

  it('should handle RegExp objects', () => {
    const regex1 = /abc/gi;
    const regex2 = /abc/gi;
    const regex3 = /abc/i;
    expect(deepEqual(regex1, regex2)).toBe(true);
    expect(deepEqual(regex1, regex3)).toBe(false);
  });

  it('should handle ArrayBuffer objects', () => {
    const buffer1 = new ArrayBuffer(8);
    const buffer2 = new ArrayBuffer(8);
    const buffer3 = new ArrayBuffer(4);
    new Uint8Array(buffer1).set([1, 2, 3, 4, 5, 6, 7, 8]);
    new Uint8Array(buffer2).set([1, 2, 3, 4, 5, 6, 7, 8]);
    new Uint8Array(buffer3).set([1, 2, 3, 4]);

    expect(deepEqual(buffer1, buffer2)).toBe(true);
    expect(deepEqual(buffer1, buffer3)).toBe(false);

    // Skip heavy computations
    expect(deepEqual(buffer1, buffer2, true)).toBe(true);
    expect(deepEqual(buffer1, buffer3, true)).toBe(false);
  });

  it('should handle TypedArray objects', () => {
    const typedArray1 = new Uint8Array([1, 2, 3, 4]);
    const typedArray2 = new Uint8Array([1, 2, 3, 4]);
    const typedArray3 = new Uint8Array([1, 2, 3]);

    expect(deepEqual(typedArray1, typedArray2)).toBe(true);
    expect(deepEqual(typedArray1, typedArray3)).toBe(false);

    // Skip heavy computations
    expect(deepEqual(typedArray1, typedArray2, true)).toBe(true);
    expect(deepEqual(typedArray1, typedArray3, true)).toBe(false);
  });

  it('should handle Map objects', () => {
    const map1 = new Map([['key1', 'value1'], ['key2', 'value2']]);
    const map2 = new Map([['key1', 'value1'], ['key2', 'value2']]);
    const map3 = new Map([['key1', 'value1']]);
    const map4 = new Map([['key1', 'XXXX']]);

    expect(deepEqual(map1, map2)).toBe(true);
    expect(deepEqual(map1, map3)).toBe(false);
    expect(deepEqual(map3, map4)).toBe(false);
  });

  it('should handle Set objects', () => {
    const set1 = new Set([1, 2, 3]);
    const set2 = new Set([1, 2, 3]);
    const set3 = new Set([1, 2]);
    const set4 = new Set([1, 4]);

    expect(deepEqual(set1, set2)).toBe(true);
    expect(deepEqual(set1, set3)).toBe(false);
    expect(deepEqual(set3, set4)).toBe(false);
  });

  it('should handle DataView objects', () => {
    const dataView1 = new DataView(new ArrayBuffer(8));
    const dataView2 = new DataView(new ArrayBuffer(8));
    const dataView3 = new DataView(new ArrayBuffer(4));
    const dataView4 = new DataView(new ArrayBuffer(4));
    new Uint8Array(dataView1.buffer).set([1, 2, 3, 4, 5, 6, 7, 8]);
    new Uint8Array(dataView2.buffer).set([1, 2, 3, 4, 5, 6, 7, 8]);
    new Uint8Array(dataView3.buffer).set([1, 2, 3, 4]);
    new Uint8Array(dataView4.buffer).set([1, 2, 6, 7]);

    expect(deepEqual(dataView1, dataView2)).toBe(true);
    expect(deepEqual(dataView1, dataView3)).toBe(false);
    expect(deepEqual(dataView4, dataView3)).toBe(false);

    // Skip heavy computations
    expect(deepEqual(dataView1, dataView2, true)).toBe(true);
    expect(deepEqual(dataView1, dataView3, true)).toBe(false);
    // true because it only compares lengths since it is skipping heavy coputations 
    expect(deepEqual(dataView4, dataView3, true)).toBe(true);
  });

  it('should handle functions', () => {
    const func1: Function = () => 1;
    const func2: Function = () => 2;
    const func3: Function = func1;

    expect(deepEqual(func1, func2)).toBe(false); // Different instances
    expect(deepEqual(() => 1, () => 1)).toBe(false); // Different instances
    expect(deepEqual(func1, func3)).toBe(true); // Same instance
  });

  it('should handle arrays and objects with symbols', () => {
    const symbolKey = Symbol('key');
    const symbolKey2 = Symbol('key2');
    const obj1 = { [symbolKey]: 42, a: 1 };
    const obj2 = { [symbolKey]: 42, a: 1 };
    const obj3 = { [symbolKey]: 42 };
    const obj4 = { [symbolKey2]: 42 };

    expect(deepEqual(obj1, obj2)).toBe(true);
    expect(deepEqual(obj1, obj3)).toBe(false);
    expect(deepEqual(obj4, obj3)).toBe(false);
  });

  it('should handle nested objects', () => {
    const obj1 = { a: { b: { c: 1 } } };
    const obj2 = { a: { b: { c: 1 } } };
    const obj3 = { a: { b: { c: 2 } } };
    const obj4 = { a: { b: { x: 2 } } };

    expect(deepEqual(obj1, obj2)).toBe(true);
    expect(deepEqual(obj1, obj3)).toBe(false);
    expect(deepEqual(obj4, obj3)).toBe(false);
  });
});
