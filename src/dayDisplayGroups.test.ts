import {expect,it} from 'vitest';
import {dayDisplayGroups,layoutDay} from './daySchedule';
import {newTask} from './domain';
const task=(id:string,time='09:00')=>({...newTask(),id,dueTime:time,minutes:30});
it('uses icons only when overlapping columns cannot fit readable cards',()=>{const p=layoutDay([task('a'),task('b')],88); expect(dayDisplayGroups(p,280)[0]?.compact).toBe(true); expect(dayDisplayGroups(p,720)[0]?.compact).toBe(false);});
it('keeps separate time intervals separate and retains every task',()=>{const p=layoutDay([task('a'),task('b'),task('c','12:00')],88);const g=dayDisplayGroups(p,280);expect(g).toHaveLength(2);expect(g.flatMap(x=>x.entries.map(p=>p.task.id))).toEqual(['a','b','c']); expect(g[1]?.compact).toBe(false);});
it('reserves enough space for bubbles when the timeline is zoomed out',()=>{const p=layoutDay([task('a'),task('b'),task('c','10:00')],16);const g=dayDisplayGroups(p,280); expect(g[0]?.height).toBeGreaterThanOrEqual(64);expect(g.flatMap(x=>x.entries)).toHaveLength(3);});
