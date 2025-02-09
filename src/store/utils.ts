
import { afterWrite } from './write';
export const isInternal = <FnType extends (x: any) => void>(writeFn: FnType) => writeFn === afterWrite;

export const deepEqual = (obj1: any, obj2: any, skipHeavyComputations: boolean = false): boolean => {
  const seen = new WeakMap();
  const deepCompare = (o1: any, o2: any): boolean => {
    if (o1 === o2) return true;

    // Handle null and non-object types
    if (typeof o1 !== 'object' || typeof o2 !== 'object' || o1 === null || o2 === null) {
      return false;
    }

    // Handle cyclical references
    if (seen.has(o1)) {
      return seen.get(o1) === o2; // Check if o1 has already been mapped to o2
    }
    seen.set(o1, o2);

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

    // Handle TypedArray objects (e.g., Uint8Array, Float32Array, etc.)
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

    // Handle Set objects
    if (o1 instanceof Set && o2 instanceof Set) {
      if (o1.size !== o2.size) return false;
      for (const value of o1) {
        if (!o2.has(value)) {
          return false;
        }
      }
      return true;
    }

    // Handle arrays and objects
    const o1Keys = [...Object.keys(o1), ...Object.getOwnPropertySymbols(o1)];
    const o2Keys = [...Object.keys(o2), ...Object.getOwnPropertySymbols(o2)];
    if (o1Keys.length !== o2Keys.length) return false;

    // Check if all keys in o1 exist in o2
    for (const key of o1Keys) {
      if (!Object.hasOwnProperty.call(o2, key)) {
        return false;
      }
    }

    // Recursively compare values
    for (const key of o1Keys) {
      if (!deepCompare(o1[key], o2[key])) {
        return false;
      }
    }

    return true;
  };

  return deepCompare(obj1, obj2);
};

export const throttle = (func: Function, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  let lastCall = 0;
  return (...args:any[]) => {
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
