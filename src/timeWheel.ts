export const wrapWheel=(value:number,count:number)=>((value%count)+count)%count;
export const wheelValue=(row:number,count:number)=>wrapWheel(count-1-Math.round(row),count);
export const wheelStart=(value:number,count:number)=>count*2+count-1-value;
