import {expect,it} from "vitest";
import {awardExperience,characterLevel} from "./character";
import {emptyData,type Task} from "./domain";
it("awards once, including after reopening and completing again",()=>{
 const task={id:"a",status:"todo"} as Task;
 const before={...emptyData(),character:{className:"Бард" as const,xp:0,rewarded:[]},tasks:[task]};
 const done=awardExperience(before,{...before,tasks:[{...task,status:"done"}]});
 expect(done.character?.xp).toBe(25);
 const reopened={...done,tasks:[task]};
 expect(awardExperience(reopened,{...reopened,tasks:[{...task,status:"done"}]}).character?.xp).toBe(25);
 expect(characterLevel(99)).toBe(1);expect(characterLevel(100)).toBe(2);
});
it("awards separate repeat dates and ignores events",()=>{
 const task={id:"a",status:"todo",repeat:"daily",repeatCompleted:[]} as unknown as Task;
 const before={...emptyData(),character:{className:"Бард" as const,xp:0,rewarded:[]},tasks:[task]};
 const done=awardExperience(before,{...before,tasks:[{...task,repeatCompleted:["2026-11-05","2026-11-06"]}]});
 expect(done.character?.xp).toBe(50);
 expect(awardExperience({...before,tasks:[{...task,kind:"event"}]},{...before,tasks:[{...task,kind:"event",status:"done"}]}).character?.xp).toBe(0);
});
