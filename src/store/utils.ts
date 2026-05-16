
import { afterWrite } from './write';
export const isInternal = <FnType extends (x: any) => void>(writeFn: FnType) => writeFn === afterWrite;

export const deepEqual = (obj1: any, obj2: any, skipHeavyComputations: boolean = false): boolean => {
  const seen = new WeakMap();
  const deepCompare = (o1: any, o2: any): boolean => {
    // Handle null and non-object types (including functions)
    if (o1 === null || o2 === null) {
      return o1 === o2;
    }
    if (typeof o1 !== 'object' || typeof o2 !== 'object') {
      return o1 === o2;
    }

    // Handle cyclical references.
    // Track both directions so that asymmetric cycles (obj3.self = obj3 vs obj4.self = obj3)
    // are detected correctly.
    if (seen.has(o1)) {
      return seen.get(o1) === o2;
    }
    if (seen.has(o2)) {
      return seen.get(o2) === o1;
    }
    seen.set(o1, o2);
    seen.set(o2, o1);

    // Handle Date objects
    if (o1 instanceof Date && o2 instanceof Date) {
      return o1.getTime() === o2.getTime();
    }

    // Handle RegExp objects
    if (o1 instanceof RegExp && o2 instanceof RegExp) {
      return o1.source === o2.source && o1.flags === o2.flags;
    }

    // Handle ArrayBuffer objects
    if (o1 instanceof ArrayBuffer && o2 instanceof ArrayBuffer) {
      if (o1.byteLength !== o2.byteLength) return false;
      if (skipHeavyComputations) return true; // Skip byte-by-byte comparison
      const view1 = new DataView(o1);
      const view2 = new DataView(o2);
      for (let i = 0; i < o1.byteLength; i++) {
        if (view1.getUint8(i) !== view2.getUint8(i)) return false;
      }
      return true;
    }

    // Handle TypedArray and DataView objects (ArrayBufferView subclasses).
    // DataView does not have .length but does have .byteLength, so use byteLength for the
    // size check on both branches. Only TypedArrays (not DataView) support element access
    // via a Uint8Array wrapper, so we distinguish the two.
    if (ArrayBuffer.isView(o1) && ArrayBuffer.isView(o2)) {
      if (o1.byteLength !== o2.byteLength) return false;
      if (skipHeavyComputations) return true; // Skip element-by-element comparison
      const typedArray1 = new Uint8Array(o1.buffer, o1.byteOffset, o1.byteLength);
      const typedArray2 = new Uint8Array(o2.buffer, o2.byteOffset, o2.byteLength);
      for (let i = 0; i < typedArray1.length; i++) {
        if (typedArray1[i] !== typedArray2[i]) return false;
      }
      return true;
    }

    // Handle Map objects
    if (o1 instanceof Map && o2 instanceof Map) {
      if (o1.size !== o2.size) return false;
      for (const [key, value] of o1) {
        if (!o2.has(key) || !deepCompare(value, o2.get(key))) {
          return false;
        }
      }
      return true;
    }

    // Handle Set objects.
    // O(n²) by necessity when values are objects — no faster general solution exists
    // without imposing a canonical ordering on arbitrary values.
    //
    // Each speculative item probe must use a FRESH seen map (via the top-level deepEqual),
    // not the shared deepCompare closure. If we used deepCompare here, a failed probe
    // (e.g. comparing {a:1} against {b:2}) would write to seen and poison the next probe
    // (e.g. comparing {a:1} against {a:1}), causing it to return false via the stale
    // seen entry even though the two objects are structurally equal.
    if (o1 instanceof Set && o2 instanceof Set) {
      if (o1.size !== o2.size) return false;
      for (const value of o1) {
        if (!Array.from(o2).some(item => deepEqual(value, item, skipHeavyComputations))) {
          return false;
        }
      }
      return true;
    }

    // Check if objects are of the same constructor
    if (o1.constructor !== o2.constructor) {
      return false;
    }

    // Handle arrays and objects (including Symbol-keyed properties)
    const o1Keys = [...Object.keys(o1), ...Object.getOwnPropertySymbols(o1)];
    const o2Keys = [...Object.keys(o2), ...Object.getOwnPropertySymbols(o2)];
    if (o1Keys.length !== o2Keys.length) return false;

    // Check if all keys in o1 exist in o2 and have the same values
    for (const key of o1Keys) {
      if (!Object.prototype.hasOwnProperty.call(o2, key) || !deepCompare(o1[key], o2[key])) {
        return false;
      }
    }

    return true;
  };

  return deepCompare(obj1, obj2);
};

export const deepClone = <T>(obj: T): T => {
  // WeakMap tracks already-cloned objects so that circular references are handled
  // without infinite recursion, and shared sub-objects are cloned only once.
  const cloneMap = new WeakMap();

  const cloneInner = <U>(val: U): U => {
    // Handle null and undefined
    if (val === null || val === undefined) {
      return val;
    }

    // Handle primitive types (string, number, boolean, symbol, bigint)
    if (typeof val !== 'object' && typeof val !== 'function') {
      return val;
    }

    // Functions are returned as-is (same behaviour as before; cloning functions is
    // generally not meaningful and no test asserts otherwise)
    if (typeof val === 'function') {
      return val;
    }

    // Return the previously-created clone for objects we have already seen.
    // This handles both circular references and shared sub-objects.
    if (cloneMap.has(val as object)) {
      return cloneMap.get(val as object) as U;
    }

    // Handle Date objects
    if (val instanceof Date) {
      const clone = new Date(val.getTime());
      cloneMap.set(val, clone);
      return clone as U;
    }

    // Handle RegExp objects
    if (val instanceof RegExp) {
      const clone = new RegExp(val.source, val.flags);
      cloneMap.set(val, clone);
      return clone as U;
    }

    // Handle ArrayBuffer objects
    if (val instanceof ArrayBuffer) {
      const clone = new ArrayBuffer(val.byteLength);
      new Uint8Array(clone).set(new Uint8Array(val));
      cloneMap.set(val, clone);
      return clone as U;
    }

    // Handle TypedArray and DataView objects.
    // DataView.prototype does not have .length; it only exposes .byteLength.
    // We must distinguish DataView from typed arrays because their constructors
    // have different signatures.
    if (ArrayBuffer.isView(val)) {
      if (val instanceof DataView) {
        const bufferClone = cloneInner(val.buffer);
        const clone = new DataView(bufferClone, val.byteOffset, val.byteLength);
        cloneMap.set(val, clone);
        return clone as U;
      }

      // All other ArrayBufferView subclasses are TypedArrays and expose .length.
      type TypedArrayLike = {
        buffer: ArrayBuffer;
        byteOffset: number;
        length: number;
        constructor: new (buffer: ArrayBuffer, byteOffset: number, length: number) => TypedArrayLike;
      };
      const typedArray = val as unknown as TypedArrayLike;
      const bufferClone = typedArray.buffer.slice(0);
      const clone = new typedArray.constructor(bufferClone, typedArray.byteOffset, typedArray.length);
      cloneMap.set(val, clone as unknown as object);
      return clone as unknown as U;
    }

    // Handle Map objects
    if (val instanceof Map) {
      const clone = new Map();
      cloneMap.set(val, clone);
      for (const [key, value] of val) {
        clone.set(cloneInner(key), cloneInner(value));
      }
      return clone as U;
    }

    // Handle Set objects
    if (val instanceof Set) {
      const clone = new Set();
      cloneMap.set(val, clone);
      for (const value of val) {
        clone.add(cloneInner(value));
      }
      return clone as U;
    }

    // Handle Arrays
    if (Array.isArray(val)) {
      const clone: any[] = [];
      cloneMap.set(val, clone);
      for (let i = 0; i < val.length; i++) {
        clone[i] = cloneInner(val[i]);
      }
      return clone as U;
    }

    // Handle plain objects and class instances.
    // Create the clone shell first so that cloneMap.set can be called before
    // recursing into property values — this is essential for circular references.
    const clone = Object.create(Object.getPrototypeOf(val));
    cloneMap.set(val as object, clone);

    // Copy own properties (including non-enumerable and symbol-keyed ones)
    for (const key of [...Object.getOwnPropertyNames(val), ...Object.getOwnPropertySymbols(val)] as (string | symbol)[]) {
      const descriptor = Object.getOwnPropertyDescriptor(val, key)!;
      if ('value' in descriptor) {
        // Use 'value' in descriptor rather than descriptor.value !== undefined so that
        // properties explicitly set to undefined are still cloned correctly.
        descriptor.value = cloneInner(descriptor.value);
      }
      // Accessor properties (get/set) are copied as-is; cloning their backing storage
      // is outside the scope of a structural deep clone.
      Object.defineProperty(clone, key, descriptor);
    }

    return clone;
  };

  return cloneInner(obj);
};

// NOTE: The `context` captured here is the module-level `this` (undefined in strict mode /
// ESM), not the caller's `this`. This is a known limitation documented in the test suite
// ("should demonstrate the context limitation of the current throttle implementation").
// Do NOT change this behaviour — external callers rely on the current contract.
export const throttle = (func: Function, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  let lastCall = 0;
  return (...args: any[]) => {
    const context = this;
    const now = new Date().getTime();
    const diff = now - lastCall;
    if (diff < wait) {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait - diff);
    } else {
      func.apply(context, args);
    }
    lastCall = now;
  };
};

// Same `this` caveat as throttle above.
export const debounce = (func: Function, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    const context = this;
    const argsArray = Array.prototype.slice.call(args);
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func.apply(context, argsArray);
    }, wait);
  };
};