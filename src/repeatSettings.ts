import {shiftDate,daysBetween,nextRepeatDate,type Task} from './domain';
import {repeatsOn} from './series';
const weekday=(d:string)=>(new Date(d+'T12:00:00').getDay()+6)%7;
function nextWeekly(t:Task,date:string){
 const days=[...(t.repeatWeekdays || [weekday(t.due)])].sort((a,b)=>a-b);
 if(!days.length) throw Error('Выберите дни недели.');
 const base=t.repeatAnchor||t.due,monday=shiftDate(base,-weekday(base)),week=Math.floor(daysBetween(monday,date)/7),interval=t.repeatInterval||1;
 const later=week%interval===0?days.find(d=>d>weekday(date)):undefined;
 return later!==undefined?shiftDate(date,later-weekday(date)):shiftDate(monday,(Math.floor(week/interval)+1)*interval*7+days[0]!);
}
export function normalizeRepeatSettings(task:Task):Task {
 if(!task.repeat) return {...task,repeatCount:undefined,repeatUntil:''};
 if(task.repeatCount===undefined) return task;
 const count=task.repeatCount,interval=task.repeatInterval||1;
 if(!Number.isInteger(count)||count<1||count>999) throw Error('Количество повторений — от 1 до 999.');
 if(!Number.isInteger(interval)||interval<1||interval>365) throw Error('Интервал — от 1 до 365.');
 if(!task.due) throw Error('Выберите первую дату.');
 let current={...task,repeatUntil:'',repeatCount:undefined,repeatAnchor:task.repeatAnchor||task.due,repeatDay:task.repeatDay||Number(task.due.slice(8))};
 let date=task.due;
 if(!repeatsOn(current,date)) date=task.repeat==='weekly'?nextWeekly(current,date):nextRepeatDate(current);
 if(task.repeat==='daily') date=shiftDate(date,(count-1)*interval);
 else for(let i=1;i<count;i++) { date=task.repeat==='weekly'?nextWeekly(current,date):nextRepeatDate({...current,due:date}); }
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('Дата завершения выходит за пределы календаря. Уменьшите число повторений.');
 return {...task,repeatUntil:date};
}
