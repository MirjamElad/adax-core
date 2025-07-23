import { deepEqual, deepClone } from '../store/utils';

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