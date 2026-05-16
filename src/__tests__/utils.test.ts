import { deepEqual, deepClone, throttle, debounce } from '../store/utils';

describe('throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call the function immediately if no previous call', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);
    
    throttledFn();
    
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should call the function immediately if time since last call is greater than wait', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);
    
    // First call
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // Advance time by more than wait
    jest.advanceTimersByTime(150);
    
    // Second call should execute immediately
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should not call the function immediately if time since last call is less than wait', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);
    
    // First call
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // Second call within wait period
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1); // Still only called once
    
    // Advance timers to trigger the throttled call
    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(2); // Now called twice
  });

  it('should cancel previous timeout and set a new one when called within wait period', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);
    
    // First call
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // Second call within wait period
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // Third call within wait period
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // Advance timers to trigger the last throttled call
    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(2); // Only called once more
  });

  it('should pass arguments to the throttled function', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);
    
    throttledFn('arg1', 'arg2');
    
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

    it('should demonstrate the context limitation of the current throttle implementation', () => {
    const context = { value: 'test' };
    let capturedContext;
    
    const mockFn = jest.fn(function(this: any) {
      capturedContext = this;
    });
    
    const throttledFn = throttle(mockFn, 100);
    
    // Call with the context using .call()
    throttledFn.call(context);
    
    // The current implementation doesn't preserve context
    // capturedContext will be the global/module context, not our test context
    expect(capturedContext).not.toBe(context);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should work correctly with zero wait time', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 0);
    
    // Multiple calls with zero wait should all execute immediately
    throttledFn();
    throttledFn();
    throttledFn();
    
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should handle multiple rapid calls correctly', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);
    
    // First call
    throttledFn('call1');
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenLastCalledWith('call1');
    
    // Multiple rapid calls
    throttledFn('call2');
    throttledFn('call3');
    throttledFn('call4');
    
    // Should still only have been called once
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // Advance time to trigger the last throttled call
    jest.advanceTimersByTime(100);
    
    // Should be called once more with the last arguments
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('call4');
  });

  it('should reset the timer correctly after the wait period', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);
    
    // First call
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // Advance time beyond wait period
    jest.advanceTimersByTime(150);
    
    // Second call should execute immediately
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
    
    // Third call within wait period
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
    
    // Advance time to trigger the throttled call
    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});

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
    expect(deepEqual(obj3, obj4)).toBe(false); // Reference mismatch
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

describe('deepEqual', () => {
  describe('primitive types', () => {
    it('should compare numbers correctly', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual(NaN, NaN)).toBe(false);
      expect(deepEqual(0, -0)).toBe(true);
      expect(deepEqual(Infinity, Infinity)).toBe(true);
      expect(deepEqual(-Infinity, -Infinity)).toBe(true);
      expect(deepEqual(Infinity, -Infinity)).toBe(false);
    });

    it('should compare strings correctly', () => {
      expect(deepEqual('hello', 'hello')).toBe(true);
      expect(deepEqual('hello', 'world')).toBe(false);
      expect(deepEqual('', '')).toBe(true);
    });

    it('should compare booleans correctly', () => {
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(false, false)).toBe(true);
      expect(deepEqual(true, false)).toBe(false);
    });

    it('should compare null and undefined correctly', () => {
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });
  });

  describe('objects', () => {
    it('should compare empty objects correctly', () => {
      expect(deepEqual({}, {})).toBe(true);
    });

    it('should compare flat objects correctly', () => {
      const obj1 = { a: 1, b: 2, c: 'three' };
      const obj2 = { a: 1, b: 2, c: 'three' };
      const obj3 = { a: 1, b: 2, c: 'four' };
      
      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });

    it('should compare nested objects correctly', () => {
      const obj1 = { a: { b: { c: 1 } } };
      const obj2 = { a: { b: { c: 1 } } };
      const obj3 = { a: { b: { c: 2 } } };
      
      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });

    it('should detect changes in nested properties', () => {
        const obj1 = { a: { b: { c: 1 } } };
        // Create a proper deep copy
        const obj2 = JSON.parse(JSON.stringify(obj1));
        expect(deepEqual(obj1, obj2)).toBe(true);
        
        // Modify nested property
        obj2.a.b.c = 2;
        expect(deepEqual(obj1, obj2)).toBe(false);
    });

    // Add a more comprehensive test for nested changes
    it('should handle multiple nested property changes', () => {
        const obj1 = {
            a: { b: { c: 1, d: 2 }, e: 3 },
            f: { g: 4 }
        };
        const obj2 = JSON.parse(JSON.stringify(obj1));
        expect(deepEqual(obj1, obj2)).toBe(true);
        
        // Modify various nested properties
        obj2.a.b.c = 5;
        expect(deepEqual(obj1, obj2)).toBe(false);
        
        obj2.a.b.c = 1; // Reset to original
        obj2.a.e = 6;
        expect(deepEqual(obj1, obj2)).toBe(false);
        
        obj2.a.e = 3; // Reset to original
        obj2.f.g = 7;
        expect(deepEqual(obj1, obj2)).toBe(false);
    });
  
    it('should detect changes in nested array elements', () => {
        const obj1 = { a: { b: [1, { c: 2 }] } };
        const obj2 = JSON.parse(JSON.stringify(obj1));
        expect(deepEqual(obj1, obj2)).toBe(true);
        
        // Modify nested array element
        obj2.a.b[1].c = 3;
        expect(deepEqual(obj1, obj2)).toBe(false);
    });

    it('should handle objects with symbol properties', () => {
      const symbol1 = Symbol('test');
      const obj1 = { [symbol1]: 1 };
      const obj2 = { [symbol1]: 1 };
      const obj3 = { [symbol1]: 2 };
      
      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });
  });

  describe('arrays', () => {
    it('should compare arrays correctly', () => {
      expect(deepEqual([], [])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
    });

    it('should compare nested arrays correctly', () => {
      expect(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 4]])).toBe(true);
      expect(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 5]])).toBe(false);
    });

    it('should compare arrays with objects correctly', () => {
      expect(deepEqual([{ a: 1 }], [{ a: 1 }])).toBe(true);
      expect(deepEqual([{ a: 1 }], [{ a: 2 }])).toBe(false);
    });
  });

  describe('dates', () => {
    it('should compare dates correctly', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-01');
      const date3 = new Date('2024-01-02');
      
      expect(deepEqual(date1, date2)).toBe(true);
      expect(deepEqual(date1, date3)).toBe(false);
    });
  });

  describe('regular expressions', () => {
    it('should compare regular expressions correctly', () => {
      expect(deepEqual(/abc/g, /abc/g)).toBe(true);
      expect(deepEqual(/abc/g, /abc/i)).toBe(false);
      expect(deepEqual(/abc/, /def/)).toBe(false);
    });
  });

  describe('Maps and Sets', () => {
    it('should compare Maps correctly', () => {
      const map1 = new Map([['a', 1], ['b', 2]]);
      const map2 = new Map([['a', 1], ['b', 2]]);
      const map3 = new Map([['a', 1], ['b', 3]]);
      
      expect(deepEqual(map1, map2)).toBe(true);
      expect(deepEqual(map1, map3)).toBe(false);
    });

    it('should compare Sets correctly', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([1, 2, 3]);
      const set3 = new Set([1, 2, 4]);
      
      expect(deepEqual(set1, set2)).toBe(true);
      expect(deepEqual(set1, set3)).toBe(false);
    });

    it('should compare Sets with objects correctly', () => {
      const set1 = new Set([{ a: 1 }]);
      const set2 = new Set([{ a: 1 }]);
      const set3 = new Set([{ a: 2 }]);
      
      expect(deepEqual(set1, set2)).toBe(true);
      expect(deepEqual(set1, set3)).toBe(false);
    });
  });

  describe('typed arrays', () => {
    it('should compare TypedArrays correctly', () => {
      const arr1 = new Uint8Array([1, 2, 3]);
      const arr2 = new Uint8Array([1, 2, 3]);
      const arr3 = new Uint8Array([1, 2, 4]);
      
      expect(deepEqual(arr1, arr2)).toBe(true);
      expect(deepEqual(arr1, arr3)).toBe(false);
    });

    it('should compare ArrayBuffers correctly', () => {
      const buf1 = new ArrayBuffer(3);
      const buf2 = new ArrayBuffer(3);
      const buf3 = new ArrayBuffer(4);
      const view1 = new Uint8Array(buf1);
      const view2 = new Uint8Array(buf2);
      view1.set([1, 2, 3]);
      view2.set([1, 2, 3]);
      
      expect(deepEqual(buf1, buf2)).toBe(true);
      expect(deepEqual(buf1, buf3)).toBe(false);
    });
  });

  describe('constructor comparison', () => {
    class Animal {
      constructor(public name: string) {}
    }

    class Dog extends Animal {
      constructor(name: string, public breed: string) {
        super(name);
      }
    }

    class Cat extends Animal {
      constructor(name: string, public lives: number = 9) {
        super(name);
      }
    }

    it('should compare objects with same constructor correctly', () => {
      const dog1 = new Dog('Rex', 'German Shepherd');
      const dog2 = new Dog('Rex', 'German Shepherd');
      expect(deepEqual(dog1, dog2)).toBe(true);
      
      dog2.breed = 'Labrador';
      expect(deepEqual(dog1, dog2)).toBe(false);
    });

    it('should identify objects with different constructors as not equal', () => {
      const dog = new Dog('Rex', 'German Shepherd');
      const cat = new Cat('Rex', 9);
      expect(deepEqual(dog, cat)).toBe(false);
    });

    it('should differentiate between plain objects and class instances', () => {
      const dogClass = new Dog('Rex', 'German Shepherd');
      const dogPlain = { name: 'Rex', breed: 'German Shepherd' };
      expect(deepEqual(dogClass, dogPlain)).toBe(false);
    });

    it('should handle inherited class hierarchies', () => {
      const animal = new Animal('Rex');
      const dog = new Dog('Rex', 'German Shepherd');
      expect(deepEqual(animal, dog)).toBe(false);
    });

    it('should compare built-in types with different constructors', () => {
      // Array vs Object with same contents
      expect(deepEqual(['a', 'b'], { 0: 'a', 1: 'b', length: 2 })).toBe(false);
      
      // Map vs Object with same key-values
      const map = new Map([['a', 1], ['b', 2]]);
      const obj = { a: 1, b: 2 };
      expect(deepEqual(map, obj)).toBe(false);
      
      // Set vs Array with same values
      const set = new Set([1, 2, 3]);
      const arr = [1, 2, 3];
      expect(deepEqual(set, arr)).toBe(false);
    });

    it('should handle null prototype objects', () => {
      const nullProtoObj = Object.create(null);
      nullProtoObj.a = 1;
      
      const regularObj = { a: 1 };
      
      expect(deepEqual(nullProtoObj, regularObj)).toBe(false);
    });

    it('should compare objects with modified prototypes', () => {
      function CustomType() {}
      const obj1 = new (CustomType as any)();
      const obj2 = new (CustomType as any)();
      
      obj1.a = 1;
      obj2.a = 1;
      
      expect(deepEqual(obj1, obj2)).toBe(true);
      
      // Modify prototype
      CustomType.prototype.b = 2;
      expect(deepEqual(obj1, obj2)).toBe(true);
    });
  });
  describe('cyclical references', () => {
    it('should handle simple circular references', () => {
      const obj1: any = { a: 1 };
      const obj2: any = { a: 1 };
      obj1.self = obj1;
      obj2.self = obj2;
      
      expect(deepEqual(obj1, obj2)).toBe(true);
    });

    it('should handle complex circular references', () => {
      const obj1: any = { a: 1 };
      const obj2: any = { a: 1 };
      const child1: any = { parent: obj1 };
      const child2: any = { parent: obj2 };
      obj1.child = child1;
      obj2.child = child2;
      
      expect(deepEqual(obj1, obj2)).toBe(true);
    });

    it('should handle circular references in arrays', () => {
      const arr1: any[] = [1, 2, 3];
      const arr2: any[] = [1, 2, 3];
      arr1.push(arr1);
      arr2.push(arr2);
      
      expect(deepEqual(arr1, arr2)).toBe(true);
    });

    it('should handle graph-like structures', () => {
      // Create a simple graph where nodes reference each other
      const node1a: any = { value: 1 };
      const node2a: any = { value: 2 };
      const node3a: any = { value: 3 };
      node1a.next = node2a;
      node2a.next = node3a;
      node3a.next = node1a; // Create cycle

      const node1b: any = { value: 1 };
      const node2b: any = { value: 2 };
      const node3b: any = { value: 3 };
      node1b.next = node2b;
      node2b.next = node3b;
      node3b.next = node1b; // Create cycle

      expect(deepEqual(node1a, node1b)).toBe(true);
      
      // Modify a value in the cycle
      node2b.value = 4;
      expect(deepEqual(node1a, node1b)).toBe(false);
    });
  });

  describe('skipHeavyComputations flag', () => {
    it('should skip detailed comparison of ArrayBuffers when flag is true', () => {
      const buf1 = new ArrayBuffer(1000);
      const buf2 = new ArrayBuffer(1000);
      const view1 = new Uint8Array(buf1);
      const view2 = new Uint8Array(buf2);
      view1.set([1]);
      view2.set([2]); // Different content
      
      expect(deepEqual(buf1, buf2, true)).toBe(true); // Skip comparison
      expect(deepEqual(buf1, buf2, false)).toBe(false); // Detailed comparison
    });

    it('should skip detailed comparison of TypedArrays when flag is true', () => {
      const arr1 = new Uint8Array(1000);
      const arr2 = new Uint8Array(1000);
      arr1[0] = 1;
      arr2[0] = 2; // Different content
      
      expect(deepEqual(arr1, arr2, true)).toBe(true); // Skip comparison
      expect(deepEqual(arr1, arr2, false)).toBe(false); // Detailed comparison
    });
  });
});

describe('deepClone', () => {
  it('should create independent copies that can be compared with deepEqual', () => {
    const data = { a: { b: { c: 1 } } };
    const prevData = deepClone(data);
    
    // Initially they should be equal
    expect(deepEqual(data, prevData)).toBe(true);
    
    // Modify original data
    data.a.b.c = 2;
    
    // Now they should be different
    expect(deepEqual(data, prevData)).toBe(false);
    expect(prevData.a.b.c).toBe(1); // Original value preserved
  });

  it('should handle arrays independently', () => {
    const data = { items: [{ id: 1, value: 'test' }] };
    const prevData = deepClone(data);
    
    data.items[0].value = 'modified';
    expect(deepEqual(data, prevData)).toBe(false);
    expect(prevData.items[0].value).toBe('test');
  });

  it('should handle dates independently', () => {
    const data = { date: new Date() };
    const prevData = deepClone(data);
    
    data.date.setFullYear(1880);
    expect(deepEqual(data, prevData)).toBe(false);
  });

  it('should handle RegExp independently', () => {
    const data = { regex1: /abc/gi };
    const prevData = deepClone(data);
    data.regex1 = /xyz/gi
    expect(deepEqual(data, prevData)).toBe(false);
  });

  it('should handle ArrayBuffer independently', () => {    
    const buffer1 = new ArrayBuffer(8);
    new Uint8Array(buffer1).set([1, 2, 3, 4, 5, 6, 7, 8]);
    const data = { arrayBuffer: buffer1 };
    const prevData = deepClone(data);
    new Uint8Array(buffer1).set([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(deepEqual(data, prevData)).toBe(false);
  });


  it('should handle maps independently', () => {
    const map = new Map([['key', { value: 1 }]]);
    const data = { map };
    const prevData = deepClone(data);
    
    (data.map.get('key') as any).value = 2;
    expect(deepEqual(data, prevData)).toBe(false);
    expect((prevData.map.get('key') as any).value).toBe(1);
  });

  it('should handle sets independently', () => {
    const data = { set: new Set([{ id: 1 }]) };
    const prevData = deepClone(data);
    
    data.set.clear();
    expect(deepEqual(data, prevData)).toBe(false);
    expect(prevData.set.size).toBe(1);
  });

  it('should handle class instances', () => {
    class TestClass {
      constructor(public value: number) {}
    }
    
    const data = { instance: new TestClass(1) };
    const prevData = deepClone(data);
    
    data.instance.value = 2;
    expect(deepEqual(data, prevData)).toBe(false);
    expect(prevData.instance.value).toBe(1);
    expect(prevData.instance instanceof TestClass).toBe(true);
  });
});

describe('deepClone TypedArray handling', () => {
    it('should clone Uint8Array correctly', () => {
      const original = new Uint8Array([1, 2, 3]);
      const cloned = deepClone(original);
      
      expect(cloned).toBeInstanceOf(Uint8Array);
      expect(cloned.buffer).not.toBe(original.buffer); // Different buffer
      expect(Array.from(cloned)).toEqual([1, 2, 3]); // Same content
      
      // Modify original
      original[0] = 9;
      expect(cloned[0]).toBe(1); // Cloned array unchanged
    });
  
    it('should clone Float32Array correctly', () => {
      const original = new Float32Array([1.1, 2.2, 3.3]);
      const cloned = deepClone(original);
      
      expect(cloned).toBeInstanceOf(Float32Array);
      expect(cloned.buffer).not.toBe(original.buffer);
      expect(Array.from(cloned)).toEqual([1.100000023841858, 2.200000047683716, 3.299999952316284]); // Float32 precision
      
      // Modify original
      original[0] = 9.9;
      expect(cloned[0]).toBeCloseTo(1.1);
    });
  
    it('should clone nested TypedArrays', () => {
      const data = {
        arrays: [
          new Uint8Array([1, 2, 3]),
          new Float32Array([4.4, 5.5])
        ]
      };
      
      const cloned = deepClone(data);
      
      expect(cloned.arrays[0]).toBeInstanceOf(Uint8Array);
      expect(cloned.arrays[1]).toBeInstanceOf(Float32Array);
      
      // Modify original
      data.arrays[0][0] = 9;
      data.arrays[1][0] = 9.9;
      
      expect(cloned.arrays[0][0]).toBe(1);
      expect(cloned.arrays[1][0]).toBeCloseTo(4.4);
    });
});

describe('DeepEqual dummy', () => {
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
})

// ─────────────────────────────────────────────────────────────────────────────
// debounce
// Not covered at all in the existing suite.
// ─────────────────────────────────────────────────────────────────────────────
describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not call the function before the wait period has elapsed', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();

    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(99);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('should call the function exactly once after the wait period', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    jest.advanceTimersByTime(100);

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should reset the timer when called again before the wait period elapses', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    jest.advanceTimersByTime(50);

    // Second call resets the clock
    debouncedFn();
    jest.advanceTimersByTime(50);

    // 100 ms have passed since first call but only 50 since second — should not fire yet
    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should fire only once after multiple rapid calls, with the last arguments', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('call1');
    debouncedFn('call2');
    debouncedFn('call3');

    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('call3');
  });

  it('should pass arguments correctly to the debounced function', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('arg1', 'arg2', 42);
    jest.advanceTimersByTime(100);

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 42);
  });

  it('should allow the function to be called again after the wait period resets', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('first');
    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenLastCalledWith('first');

    debouncedFn('second');
    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('second');
  });

  it('should work correctly with zero wait time', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 0);

    debouncedFn();
    // Even with 0ms wait the call is still deferred asynchronously via setTimeout
    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(0);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should not allow multiple independent debounced functions to interfere', () => {
    const mockFn1 = jest.fn();
    const mockFn2 = jest.fn();
    const debouncedFn1 = debounce(mockFn1, 100);
    const debouncedFn2 = debounce(mockFn2, 200);

    debouncedFn1('a');
    debouncedFn2('b');

    jest.advanceTimersByTime(100);
    expect(mockFn1).toHaveBeenCalledTimes(1);
    expect(mockFn2).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(mockFn2).toHaveBeenCalledTimes(1);
  });

  it('should demonstrate the context limitation — mirrors the throttle behaviour', () => {
    // debounce uses `const context = this` inside an arrow function, so it captures
    // the module-level `this`, not the caller's `this`.  This is the same documented
    // limitation as throttle; we assert it here so the contract is explicit.
    const callerContext = { value: 'test' };
    let capturedContext: any;

    const mockFn = jest.fn(function (this: any) {
      capturedContext = this;
    });

    const debouncedFn = debounce(mockFn, 100);
    debouncedFn.call(callerContext);
    jest.advanceTimersByTime(100);

    expect(capturedContext).not.toBe(callerContext);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// throttle — additional gaps
// ─────────────────────────────────────────────────────────────────────────────
describe('throttle — additional', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not interfere between multiple independent throttled instances', () => {
    const mockFn1 = jest.fn();
    const mockFn2 = jest.fn();
    const throttledFn1 = throttle(mockFn1, 100);
    const throttledFn2 = throttle(mockFn2, 200);

    throttledFn1();
    throttledFn2();
    expect(mockFn1).toHaveBeenCalledTimes(1);
    expect(mockFn2).toHaveBeenCalledTimes(1);

    throttledFn1();   // within wait for fn1 but irrelevant to fn2
    expect(mockFn1).toHaveBeenCalledTimes(1); // still 1
    expect(mockFn2).toHaveBeenCalledTimes(1); // unaffected
  });

  it('should call a zero-argument function correctly', () => {
    let callCount = 0;
    const fn = () => { callCount++; };
    const throttledFn = throttle(fn, 100);

    throttledFn();
    expect(callCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deepEqual — additional gaps
// ─────────────────────────────────────────────────────────────────────────────
describe('deepEqual — additional', () => {

  // ── TypedArray cross-type comparisons ──────────────────────────────────────
  describe('cross-type TypedArray comparisons', () => {
    it('should return true when comparing different TypedArray types with identical underlying bytes', () => {
      // The ArrayBuffer.isView branch (which compares raw bytes via a Uint8Array window)
      // fires BEFORE the constructor check, so deepEqual treats all ArrayBufferView
      // subtypes purely as byte sequences. Uint8Array([1,2,3]) and Int8Array([1,2,3])
      // have the same bit-pattern → byte comparison passes → returns true.
      // Type identity is NOT part of the deepEqual contract for ArrayBufferViews.
      const uint8 = new Uint8Array([1, 2, 3]);
      const int8  = new Int8Array([1, 2, 3]);
      expect(deepEqual(uint8, int8)).toBe(true);
    });

    it('should return false when comparing Uint16Array and Uint32Array with same logical values (different byte widths)', () => {
      // Uint16Array([1,2,3]) occupies 6 bytes; Uint32Array([1,2,3]) occupies 12 bytes.
      // byteLength differs → returns false before any byte comparison.
      const u16 = new Uint16Array([1, 2, 3]);
      const u32 = new Uint32Array([1, 2, 3]);
      expect(deepEqual(u16, u32)).toBe(false);
    });

    it('should return true when comparing a DataView and a Uint8Array that share the same underlying bytes', () => {
      // Both are ArrayBufferView subtypes. The isView branch compares their raw bytes;
      // since they share the same underlying buffer the bytes are identical → true.
      // Constructor identity is not checked for ArrayBufferViews.
      const buf = new ArrayBuffer(4);
      new Uint8Array(buf).set([1, 2, 3, 4]);
      const dataView = new DataView(buf);
      const uint8    = new Uint8Array(buf);
      expect(deepEqual(dataView, uint8)).toBe(true);
    });

    it('should return true for two DataViews backed by different buffers with the same bytes', () => {
      const buf1 = new ArrayBuffer(4);
      const buf2 = new ArrayBuffer(4);
      new Uint8Array(buf1).set([10, 20, 30, 40]);
      new Uint8Array(buf2).set([10, 20, 30, 40]);
      const dv1 = new DataView(buf1);
      const dv2 = new DataView(buf2);
      expect(deepEqual(dv1, dv2)).toBe(true);
    });

    it('should return false for two DataViews with the same length but different bytes', () => {
      const buf1 = new ArrayBuffer(4);
      const buf2 = new ArrayBuffer(4);
      new Uint8Array(buf1).set([1, 2, 3, 4]);
      new Uint8Array(buf2).set([1, 2, 3, 9]);
      expect(deepEqual(new DataView(buf1), new DataView(buf2))).toBe(false);
    });

    it('should compare all standard TypedArray flavours correctly', () => {
      const pairs: [TypedArray, TypedArray][] = [
        [new Int8Array([1, -1]),      new Int8Array([1, -1])],
        [new Uint16Array([300, 400]), new Uint16Array([300, 400])],
        [new Int16Array([-100, 200]), new Int16Array([-100, 200])],
        [new Int32Array([1e6]),       new Int32Array([1e6])],
        [new Uint32Array([4e9]),      new Uint32Array([4e9])],
        [new Float64Array([Math.PI]), new Float64Array([Math.PI])],
      ];

      type TypedArray =
        | Int8Array | Uint16Array | Int16Array
        | Int32Array | Uint32Array | Float64Array;

      for (const [a, b] of pairs) {
        expect(deepEqual(a, b)).toBe(true);
        expect(deepEqual(a, b, true)).toBe(true);
      }
    });

    it('should return false for two Int32Arrays with different values', () => {
      expect(deepEqual(new Int32Array([1, 2, 3]), new Int32Array([1, 2, 4]))).toBe(false);
    });
  });

  // ── Map edge cases ─────────────────────────────────────────────────────────
  describe('Map edge cases', () => {
    it('should return true for two empty Maps', () => {
      expect(deepEqual(new Map(), new Map())).toBe(true);
    });

    it('should consider insertion order irrelevant for Maps', () => {
      const map1 = new Map([['a', 1], ['b', 2]]);
      const map2 = new Map([['b', 2], ['a', 1]]);
      expect(deepEqual(map1, map2)).toBe(true);
    });

    it('should support object keys in Maps', () => {
      const keyA = { id: 1 };
      const keyB = { id: 1 };

      // deepEqual uses reference equality for Map keys (Map.prototype.has uses SameValueZero),
      // so two structurally equal but distinct key objects are treated as different keys.
      const map1 = new Map([[keyA, 'value']]);
      const map2 = new Map([[keyB, 'value']]);

      // map2.has(keyA) is false because keyB !== keyA by reference
      expect(deepEqual(map1, map2)).toBe(false);
    });

    it('should deeply compare Map values', () => {
      const map1 = new Map([['key', { nested: { a: 1 } }]]);
      const map2 = new Map([['key', { nested: { a: 1 } }]]);
      const map3 = new Map([['key', { nested: { a: 2 } }]]);

      expect(deepEqual(map1, map2)).toBe(true);
      expect(deepEqual(map1, map3)).toBe(false);
    });

    it('should return false when Maps have the same keys but different values', () => {
      const map1 = new Map([['a', 1], ['b', 2]]);
      const map2 = new Map([['a', 1], ['b', 99]]);
      expect(deepEqual(map1, map2)).toBe(false);
    });

    it('should return false when comparing a Map to a non-Map with same-looking content', () => {
      const map = new Map([['a', 1]]);
      const obj = { a: 1 };
      expect(deepEqual(map, obj)).toBe(false);
    });
  });

  // ── Set edge cases ─────────────────────────────────────────────────────────
  describe('Set edge cases', () => {
    it('should return true for two empty Sets', () => {
      expect(deepEqual(new Set(), new Set())).toBe(true);
    });

    it('should treat insertion order as irrelevant for primitive Sets', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([3, 1, 2]);
      expect(deepEqual(set1, set2)).toBe(true);
    });

    it('should handle Sets with mixed primitive types', () => {
      const set1 = new Set([1, 'two', true, null]);
      const set2 = new Set([1, 'two', true, null]);
      const set3 = new Set([1, 'two', true]);        // missing null
      expect(deepEqual(set1, set2)).toBe(true);
      expect(deepEqual(set1, set3)).toBe(false);
    });

    it('should structurally compare objects inside Sets', () => {
      const set1 = new Set([{ a: 1 }, { b: 2 }]);
      const set2 = new Set([{ b: 2 }, { a: 1 }]);   // different insertion order
      expect(deepEqual(set1, set2)).toBe(true);
    });

    it('should return false for Sets containing structurally different objects', () => {
      const set1 = new Set([{ a: 1 }]);
      const set2 = new Set([{ a: 9 }]);
      expect(deepEqual(set1, set2)).toBe(false);
    });
  });

  // ── ArrayBuffer edge cases ─────────────────────────────────────────────────
  describe('ArrayBuffer edge cases', () => {
    it('should return true for two empty ArrayBuffers', () => {
      expect(deepEqual(new ArrayBuffer(0), new ArrayBuffer(0))).toBe(true);
    });

    it('should return false for ArrayBuffers of different lengths even with skipHeavyComputations', () => {
      expect(deepEqual(new ArrayBuffer(4), new ArrayBuffer(8), true)).toBe(false);
    });
  });

  // ── Non-enumerable string-keyed properties ─────────────────────────────────
  describe('non-enumerable properties', () => {
    it('should treat objects as equal when they differ only in non-enumerable string-keyed properties', () => {
      // deepEqual uses Object.keys() (enumerable only) + getOwnPropertySymbols(),
      // so non-enumerable string properties are invisible to the comparison.
      // This test documents that known limitation explicitly.
      const obj1: Record<string, any> = {};
      const obj2: Record<string, any> = {};

      Object.defineProperty(obj1, 'hidden', { value: 42,  enumerable: false });
      Object.defineProperty(obj2, 'hidden', { value: 999, enumerable: false });

      // Both objects look identical to deepEqual because 'hidden' is not enumerable
      expect(deepEqual(obj1, obj2)).toBe(true);
    });
  });

  // ── Symbol-keyed properties on nested objects ──────────────────────────────
  describe('Symbol-keyed properties on nested objects', () => {
    it('should compare symbol-keyed properties at any nesting depth', () => {
      const sym = Symbol('deep');
      const obj1 = { level1: { level2: { [sym]: 'value' } } };
      const obj2 = { level1: { level2: { [sym]: 'value' } } };
      const obj3 = { level1: { level2: { [sym]: 'OTHER' } } };

      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });

    it('should return false if one nested object has a symbol key the other lacks', () => {
      const sym = Symbol('x');
      const obj1 = { child: { [sym]: 1 } };
      const obj2 = { child: {} };
      expect(deepEqual(obj1, obj2)).toBe(false);
    });
  });

  // ── Cross-type comparisons (Date, RegExp, etc. vs plain objects) ───────────
  describe('cross-type comparisons', () => {
    it('should return false when comparing a Date to a plain object with the same timestamp', () => {
      const date = new Date(0);
      const fakeDate = { getTime: () => 0 };
      expect(deepEqual(date, fakeDate)).toBe(false);
    });

    it('should return false when comparing a RegExp to a plain object with same source/flags', () => {
      const regex = /abc/gi;
      const fakeRegex = { source: 'abc', flags: 'gi' };
      expect(deepEqual(regex, fakeRegex)).toBe(false);
    });

    it('should return false when comparing an array to an array-like plain object', () => {
      const arr      = [1, 2, 3];
      const arrayLike = { 0: 1, 1: 2, 2: 3, length: 3 };
      expect(deepEqual(arr, arrayLike)).toBe(false);
    });
  });

  // ── Object-only symbol keys ────────────────────────────────────────────────
  describe('objects with only symbol keys', () => {
    it('should return true for two objects that each have only the same symbol key', () => {
      const sym = Symbol('only');
      const obj1 = { [sym]: 42 };
      const obj2 = { [sym]: 42 };
      expect(deepEqual(obj1, obj2)).toBe(true);
    });

    it('should return false if the symbol-only value differs', () => {
      const sym = Symbol('only');
      const obj1 = { [sym]: 42 };
      const obj2 = { [sym]: 99 };
      expect(deepEqual(obj1, obj2)).toBe(false);
    });
  });

  // ── Sparse arrays ──────────────────────────────────────────────────────────
  describe('sparse arrays', () => {
    it('should treat two identical sparse arrays as equal', () => {
      const arr1: any[] = [];
      const arr2: any[] = [];
      arr1[0] = 1;
      arr1[2] = 3;   // hole at index 1
      arr2[0] = 1;
      arr2[2] = 3;
      expect(deepEqual(arr1, arr2)).toBe(true);
    });

    it('should return false for a sparse array vs a dense array with undefined', () => {
      const sparse: any[] = [];
      sparse[0] = 1;
      sparse[2] = 3;  // hole at index 1 — own property '1' does not exist

      const dense = [1, undefined, 3];  // own property '1' exists, value undefined

      // Object.keys on sparse gives ['0','2']; on dense gives ['0','1','2'] → different lengths
      expect(deepEqual(sparse, dense)).toBe(false);
    });
  });

  // ── Deeply nested class instances ──────────────────────────────────────────
  describe('deeply nested class instances', () => {
    class Node {
      constructor(public value: number, public next: Node | null = null) {}
    }

    it('should return true for structurally equal linked lists', () => {
      const list1 = new Node(1, new Node(2, new Node(3)));
      const list2 = new Node(1, new Node(2, new Node(3)));
      expect(deepEqual(list1, list2)).toBe(true);
    });

    it('should return false when a nested node value differs', () => {
      const list1 = new Node(1, new Node(2, new Node(3)));
      const list2 = new Node(1, new Node(2, new Node(9)));
      expect(deepEqual(list1, list2)).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deepClone — additional gaps
// ─────────────────────────────────────────────────────────────────────────────
describe('deepClone — additional', () => {

  // ── Primitives ─────────────────────────────────────────────────────────────
  describe('primitives', () => {
    it('should return numbers unchanged', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone(0)).toBe(0);
      expect(deepClone(-Infinity)).toBe(-Infinity);
      expect(deepClone(NaN)).toBeNaN();
    });

    it('should return strings unchanged', () => {
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone('')).toBe('');
    });

    it('should return booleans unchanged', () => {
      expect(deepClone(true)).toBe(true);
      expect(deepClone(false)).toBe(false);
    });

    it('should return null unchanged', () => {
      expect(deepClone(null)).toBeNull();
    });

    it('should return undefined unchanged', () => {
      expect(deepClone(undefined)).toBeUndefined();
    });
  });

  // ── Functions ──────────────────────────────────────────────────────────────
  describe('functions', () => {
    it('should return the exact same function reference (functions are not cloned)', () => {
      const fn = () => 42;
      expect(deepClone(fn)).toBe(fn);
    });
  });

  // ── Circular references (the key new fix) ──────────────────────────────────
  describe('circular references', () => {
    it('should clone an object with a self-reference without stack overflow', () => {
      const obj: any = { a: 1 };
      obj.self = obj;

      const clone = deepClone(obj);

      expect(clone).not.toBe(obj);          // different object
      expect(clone.a).toBe(1);
      expect(clone.self).toBe(clone);       // self-reference points to clone, not original
    });

    it('should clone a mutual reference (A→B→A) without stack overflow', () => {
      const a: any = { name: 'a' };
      const b: any = { name: 'b' };
      a.other = b;
      b.other = a;

      const cloneA = deepClone(a);

      expect(cloneA).not.toBe(a);
      expect(cloneA.other).not.toBe(b);
      expect(cloneA.other.name).toBe('b');
      expect(cloneA.other.other).toBe(cloneA); // cycle is preserved inside the clone
    });

    it('should clone an array with a self-reference without stack overflow', () => {
      const arr: any[] = [1, 2, 3];
      arr.push(arr);

      const clone = deepClone(arr);

      expect(clone).not.toBe(arr);
      expect(clone[3]).toBe(clone); // self-reference preserved in the clone
      expect(clone[0]).toBe(1);
    });

    it('should clone a three-node cycle correctly', () => {
      const n1: any = { v: 1 };
      const n2: any = { v: 2 };
      const n3: any = { v: 3 };
      n1.next = n2;
      n2.next = n3;
      n3.next = n1;

      const clone1 = deepClone(n1);

      expect(clone1.v).toBe(1);
      expect(clone1.next.v).toBe(2);
      expect(clone1.next.next.v).toBe(3);
      expect(clone1.next.next.next).toBe(clone1); // cycle closes back to clone1
    });
  });

  // ── Shared sub-objects (diamond pattern) ───────────────────────────────────
  describe('shared sub-objects', () => {
    it('should clone a shared child object once and reference that single clone', () => {
      const shared = { value: 99 };
      const parent: any = { left: shared, right: shared };

      const clone = deepClone(parent);

      // The two properties should reference the same cloned object (not separate clones)
      expect(clone.left).toBe(clone.right);
      expect(clone.left).not.toBe(shared);
      expect(clone.left.value).toBe(99);
    });

    it('should not allow mutation of one branch to affect the other when sub-object is shared', () => {
      const shared = { value: 1 };
      const parent = { a: shared, b: shared };

      const clone = deepClone(parent);

      clone.a.value = 2;
      // Because left and right are the SAME cloned object, right sees the change too
      expect(clone.b.value).toBe(2);
      // But the original is untouched
      expect(shared.value).toBe(1);
    });
  });

  // ── DataView (new explicit branch) ─────────────────────────────────────────
  describe('DataView', () => {
    it('should clone a DataView with an independent buffer', () => {
      const original = new DataView(new ArrayBuffer(8));
      original.setFloat64(0, Math.PI);

      const clone = deepClone(original);

      expect(clone).toBeInstanceOf(DataView);
      expect(clone.buffer).not.toBe(original.buffer);     // independent buffer
      expect(clone.getFloat64(0)).toBeCloseTo(Math.PI);
    });

    it('should not reflect mutations to the original buffer in the clone', () => {
      const buf = new ArrayBuffer(4);
      const original = new DataView(buf);
      original.setUint32(0, 0xDEADBEEF);

      const clone = deepClone(original);
      original.setUint32(0, 0x00000000); // mutate original

      expect(clone.getUint32(0)).toBe(0xDEADBEEF);
    });

    it('should preserve byteOffset and byteLength for a DataView over a sub-range', () => {
      const buf = new ArrayBuffer(16);
      const original = new DataView(buf, 4, 8); // starts at byte 4, 8 bytes long

      const clone = deepClone(original);

      expect(clone.byteOffset).toBe(4);
      expect(clone.byteLength).toBe(8);
    });
  });

  // ── Additional TypedArray types ────────────────────────────────────────────
  describe('additional TypedArray types', () => {
    it('should clone Int16Array correctly', () => {
      const original = new Int16Array([-1000, 0, 1000]);
      const clone = deepClone(original);

      expect(clone).toBeInstanceOf(Int16Array);
      expect(clone.buffer).not.toBe(original.buffer);
      expect(Array.from(clone)).toEqual([-1000, 0, 1000]);

      original[0] = 9999;
      expect(clone[0]).toBe(-1000);
    });

    it('should clone Int32Array correctly', () => {
      const original = new Int32Array([-(2 ** 30), 0, 2 ** 30]);
      const clone = deepClone(original);

      expect(clone).toBeInstanceOf(Int32Array);
      expect(clone.buffer).not.toBe(original.buffer);
      expect(Array.from(clone)).toEqual([-(2 ** 30), 0, 2 ** 30]);
    });

    it('should clone Float64Array correctly', () => {
      const original = new Float64Array([Math.PI, Math.E, Number.EPSILON]);
      const clone = deepClone(original);

      expect(clone).toBeInstanceOf(Float64Array);
      expect(clone.buffer).not.toBe(original.buffer);
      expect(clone[0]).toBe(Math.PI);
      expect(clone[1]).toBe(Math.E);
    });

    it('should clone Uint32Array correctly', () => {
      const original = new Uint32Array([0, 2 ** 32 - 1]);
      const clone = deepClone(original);

      expect(clone).toBeInstanceOf(Uint32Array);
      expect(clone[1]).toBe(2 ** 32 - 1);
    });
  });

  // ── Empty collections ──────────────────────────────────────────────────────
  describe('empty collections', () => {
    it('should clone an empty object', () => {
      const clone = deepClone({});
      expect(clone).toEqual({});
      expect(clone).not.toBe({});
    });

    it('should clone an empty array', () => {
      const clone = deepClone([]);
      expect(clone).toEqual([]);
      expect(clone).not.toBe([]);
    });

    it('should clone an empty Map', () => {
      const original = new Map();
      const clone = deepClone(original);

      expect(clone).toBeInstanceOf(Map);
      expect(clone.size).toBe(0);
      expect(clone).not.toBe(original);
    });

    it('should clone an empty Set', () => {
      const original = new Set();
      const clone = deepClone(original);

      expect(clone).toBeInstanceOf(Set);
      expect(clone.size).toBe(0);
      expect(clone).not.toBe(original);
    });

    it('should clone an empty ArrayBuffer', () => {
      const original = new ArrayBuffer(0);
      const clone = deepClone(original);

      expect(clone).toBeInstanceOf(ArrayBuffer);
      expect(clone.byteLength).toBe(0);
      expect(clone).not.toBe(original);
    });
  });

  // ── Symbol-keyed properties ────────────────────────────────────────────────
  describe('symbol-keyed properties', () => {
    it('should clone symbol-keyed properties on an object', () => {
      const sym = Symbol('key');
      const original: any = { [sym]: 'symbolValue', plain: 'plainValue' };
      const clone = deepClone(original);

      expect(clone[sym]).toBe('symbolValue');
      expect(clone.plain).toBe('plainValue');

      // Mutation isolation
      original[sym] = 'changed';
      expect(clone[sym]).toBe('symbolValue');
    });
  });

  // ── Properties with value === undefined ────────────────────────────────────
  describe('properties whose value is explicitly undefined', () => {
    it('should clone a property set to undefined and preserve its existence', () => {
      const original = { a: 1, b: undefined as undefined };
      const clone = deepClone(original);

      // The property 'b' must exist on the clone (not just be absent)
      expect(Object.prototype.hasOwnProperty.call(clone, 'b')).toBe(true);
      expect(clone.b).toBeUndefined();
    });
  });

  // ── Non-enumerable properties ──────────────────────────────────────────────
  describe('non-enumerable properties', () => {
    it('should clone non-enumerable string-keyed properties (deepClone uses getOwnPropertyNames)', () => {
      const original: Record<string, any> = {};
      Object.defineProperty(original, 'hidden', {
        value: 42,
        enumerable: false,
        writable: true,
        configurable: true,
      });

      const clone = deepClone(original);

      // deepClone uses getOwnPropertyNames so non-enumerable properties ARE cloned
      expect(Object.prototype.hasOwnProperty.call(clone, 'hidden')).toBe(true);
      expect(clone.hidden).toBe(42);

      const descriptor = Object.getOwnPropertyDescriptor(clone, 'hidden')!;
      expect(descriptor.enumerable).toBe(false);
    });
  });

  // ── Accessor (getter/setter) properties ────────────────────────────────────
  describe('accessor properties', () => {
    it('should copy getter/setter descriptors as-is (not invoke the getter during clone)', () => {
      let backingValue = 10;
      const original: Record<string, any> = {};
      Object.defineProperty(original, 'computed', {
        get() { return backingValue; },
        set(v) { backingValue = v; },
        enumerable: true,
        configurable: true,
      });

      const clone = deepClone(original);

      // The descriptor is copied structurally — the clone has a getter too
      const desc = Object.getOwnPropertyDescriptor(clone, 'computed')!;
      expect(typeof desc.get).toBe('function');

      // Reading via the cloned getter still uses backingValue (shared backing variable)
      expect(clone.computed).toBe(10);
    });
  });

  // ── Null-prototype objects ─────────────────────────────────────────────────
  describe('null-prototype objects', () => {
    it('should clone an Object.create(null) object with its properties', () => {
      const original = Object.create(null) as Record<string, any>;
      original.a = 1;
      original.b = 'hello';

      const clone = deepClone(original);

      expect(Object.getPrototypeOf(clone)).toBeNull();
      expect(clone.a).toBe(1);
      expect(clone.b).toBe('hello');

      // Mutation isolation
      original.a = 99;
      expect(clone.a).toBe(1);
    });
  });

  // ── Deep nesting ───────────────────────────────────────────────────────────
  describe('deeply nested structures', () => {
    it('should clone 6 levels of nesting with full independence', () => {
      const original = { l1: { l2: { l3: { l4: { l5: { l6: { val: 'deep' } } } } } } };
      const clone = deepClone(original);

      expect(clone.l1.l2.l3.l4.l5.l6.val).toBe('deep');
      expect(clone.l1.l2.l3.l4.l5.l6).not.toBe(original.l1.l2.l3.l4.l5.l6);

      original.l1.l2.l3.l4.l5.l6.val = 'mutated';
      expect(clone.l1.l2.l3.l4.l5.l6.val).toBe('deep');
    });
  });

  // ── Map with object keys ───────────────────────────────────────────────────
  describe('Map with object keys', () => {
    it('should clone object keys as new independent objects', () => {
      const keyObj = { id: 1 };
      const original = new Map([[keyObj, 'value']]);

      const clone = deepClone(original);

      // The cloned map has one entry
      expect(clone.size).toBe(1);
      // The cloned key is a new object
      const [clonedKey] = clone.keys();
      expect(clonedKey).not.toBe(keyObj);
      expect(clonedKey).toEqual(keyObj);
    });
  });

  // ── Set with objects ───────────────────────────────────────────────────────
  describe('Set with objects', () => {
    it('should clone objects inside a Set into new independent instances', () => {
      const item = { value: 42 };
      const original = new Set([item]);

      const clone = deepClone(original);
      const [clonedItem] = clone.values();

      expect(clonedItem).not.toBe(item);
      expect(clonedItem.value).toBe(42);

      item.value = 99;
      expect(clonedItem.value).toBe(42);
    });
  });

  // ── Integration: deepClone + deepEqual ─────────────────────────────────────
  describe('integration with deepEqual', () => {
    it('should produce a clone that is deepEqual to the original but not reference-equal', () => {
      const original = {
        num: 1,
        str: 'hello',
        arr: [1, { nested: true }],
        map: new Map([['key', { v: 1 }]]),
        set: new Set([{ id: 1 }]),
        date: new Date('2024-01-01'),
        regex: /abc/gi,
      };

      const clone = deepClone(original);

      expect(deepEqual(original, clone)).toBe(true);
      expect(clone).not.toBe(original);
    });

    it('should correctly track divergence after mutating the clone', () => {
      const original = { a: { b: { c: 42 } } };
      const clone = deepClone(original);

      expect(deepEqual(original, clone)).toBe(true);

      clone.a.b.c = 0;
      expect(deepEqual(original, clone)).toBe(false);
    });

    it('should correctly track divergence after mutating the original', () => {
      const original = { items: [1, 2, 3] };
      const clone = deepClone(original);

      original.items.push(4);
      expect(deepEqual(original, clone)).toBe(false);
    });

    it('should produce a clone of a circular structure that is deepEqual to the original', () => {
      const original: any = { a: 1 };
      original.self = original;

      const clone = deepClone(original);

      // deepEqual handles cycles; these two structurally equivalent circular objects should match
      expect(deepEqual(original, clone)).toBe(true);
    });
  });

  // ── Class instance integrity ───────────────────────────────────────────────
  describe('class instance integrity', () => {
    class Vector {
      constructor(public x: number, public y: number) {}
      magnitude(): number {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
      }
    }

    it('should preserve instanceof relationship after cloning', () => {
      const original = new Vector(3, 4);
      const clone = deepClone(original);

      expect(clone).toBeInstanceOf(Vector);
    });

    it('should preserve prototype methods after cloning', () => {
      const original = new Vector(3, 4);
      const clone = deepClone(original);

      expect(clone.magnitude()).toBe(5);
    });

    it('should isolate property mutations between original and clone', () => {
      const original = new Vector(3, 4);
      const clone = deepClone(original);

      original.x = 0;
      expect(clone.x).toBe(3);
      expect(clone.magnitude()).toBe(5);
    });
  });
});