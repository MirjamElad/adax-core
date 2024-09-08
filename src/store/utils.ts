
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
