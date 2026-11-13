import type { Data } from "./domain";
export const characterClasses = ["Бард", "Учёный", "Варвар", "Воин", "Монах", "Друид", "Жрец", "Следопыт"] as const;
export type CharacterClass = typeof characterClasses[number];
export interface Character { className: CharacterClass; xp: number; rewarded: string[] }
export function characterLevel(xp:number){return Math.floor(Math.sqrt(Math.max(0,xp)/100))+1;}
export function awardExperience(previous:Data,next:Data):Data{
 if(!previous.character)return next;
 const rewarded=new Set(previous.character.rewarded);let gained=0;
 for(const task of next.tasks){
  const old=previous.tasks.find(t=>t.id===task.id);
  if(!old||task.kind==="event"||task.kind==="fact"||task.birthday)continue;
  const keys=task.repeat?(task.repeatCompleted||[]).filter(d=>!(old.repeatCompleted||[]).includes(d)).map(d=>task.id+"@"+d):task.status==="done"&&old.status!=="done"?[task.id]:[];
  for(const key of keys)if(!rewarded.has(key)){rewarded.add(key);gained+=25;}
 }
 return {...next,character:{...previous.character,xp:previous.character.xp+gained,rewarded:[...rewarded]}};
}
