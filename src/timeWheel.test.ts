import {expect,it} from 'vitest';
import {wheelStart,wheelValue,wrapWheel} from './timeWheel';
it('keeps wheel seed and values through repeated cycles',()=>{for(const count of [24,60])for(let value=0;value<count;value++){const row=wheelStart(value,count);expect(wheelValue(row,count)).toBe(value);expect(wheelValue(row+count*9,count)).toBe(value);expect(wheelValue(row-count*9,count)).toBe(value);}});
it('wraps both boundaries in both directions',()=>{expect(wrapWheel(24,24)).toBe(0);expect(wrapWheel(-1,24)).toBe(23);expect(wrapWheel(60,60)).toBe(0);expect(wrapWheel(-1,60)).toBe(59);});
