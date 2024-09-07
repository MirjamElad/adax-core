
import { afterWrite } from './write';
export const isInternal = <FnType extends (x: any) => void>(writeFn: FnType) => writeFn === afterWrite;

export const _Equal = (x: Object, y: Object) => {
  try {
    return JSON.stringify(x) === JSON.stringify(y);
  } catch (err) {
    return false;
  }
}

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
// consider:  https://github.com/pixa-pics/joyson#readme
//            https://github.com/ungap/structured-clone/#readme
// export const clone: <T>(obj: T) => T = <T>(obj: T) => {
//   const simplifyStructure= (obj: any, asKey: boolean = false): any => {
//     if (typeof obj === 'function') {
//       return asKey ? obj.name :{[obj.name]: obj.toString()};
//     }
//     if (Array.isArray(obj)) {
//       return obj.map((x) => simplifyStructure(x, false));
//     }
//     if (obj instanceof Map || obj instanceof WeakMap) {
//       const serializedMap: any = {};
//       for (const [key, value] of obj) {
//         serializedMap[simplifyStructure(key, true)] = simplifyStructure(value);
//       }
//       return serializedMap;
//     }
//     if (obj instanceof Set || obj instanceof WeakSet) {
//       const serializedSet: any = [];
//       for (const value of obj) {
//         serializedSet.push(simplifyStructure(value));
//       }
//       return serializedSet;
//     }
//     if (typeof obj !== 'object' || obj === null) return obj;
//     const clonedObj: any = {};
//     for (const key in obj) {
//       clonedObj[key] = simplifyStructure(obj[key]);
//     }
//     return clonedObj;
//   };
//   const s = simplifyStructure(obj);
//   return structuredClone(s);
// }