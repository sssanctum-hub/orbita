import {useRef,useState,useId,useMemo} from 'react';
import AppSelect from './AppSelect';
import {Repeat2,ChevronDown,ArrowLeft,Check} from 'lucide-react';
import {dayKey,shiftDate,repeatPreview,type Task} from '../domain';
import {normalizeRepeatSettings} from '../repeatSettings';
import {useExitMotion} from '../useExitMotion';
import DatePicker from './DatePicker';
type Props={task:Task;change:(task:Task)=>void;busy:boolean};
const weekdays=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
export default function RepeatEditor({task,change,busy}:Props){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),heading=useId(),radioName=useId();
 const [draft,setDraft]=useState(task),[error,setError]=useState(''),[end,setEnd]=useState<'never'|'date'|'count'>('never');
 const dismiss=useExitMotion(dialog);
 const close=()=>dismiss(()=>trigger.current?.focus({preventScroll:true}));
 const patch=(p:Partial<Task>)=>setDraft(d=>({...d,...p}));
 const selected=draft.repeatWeekdays||[(new Date((draft.due||dayKey(new Date()))+'T12:00:00').getDay()+6)%7];
 function open(){setDraft({...task,repeat:task.repeat||'weekly',due:task.due||dayKey(new Date())});setEnd(task.repeatCount!==undefined?'count':task.repeatUntil?'date':'never');setError('');dialog.current?.showModal();}
 function prepared(){return normalizeRepeatSettings({...draft,repeatUntil:end==='date'?draft.repeatUntil||shiftDate(draft.due,30):'',repeatCount:end==='count'?(draft.repeatCount??1):undefined});}
 function apply(){try{if(draft.repeat==='weekly'&&!selected.length)throw Error('Выберите хотя бы один день недели.');const next=prepared();if(next.repeatUntil&&next.repeatUntil<next.due)throw Error('Дата завершения не может быть раньше первой даты.');change(next);close();}catch(e){setError(String(e).replace(/^Error:\s*/,''));}}
 const preview=useMemo(()=>{try{return repeatPreview(prepared());}catch{return [];}},[draft,end]);
 const rhythm=task.repeat==='daily'?'дн.':task.repeat==='weekly'?'нед.':'мес.';
 return <div className="repeat-settings">
  <button type="button" ref={trigger} className="repeat-settings-trigger" disabled={busy} onClick={open} aria-haspopup="dialog">
   <span><Repeat2 size={19}/>Повторять</span><small>{task.repeat?'Раз в '+(task.repeatInterval||1)+' '+rhythm:'Один раз'}</small><ChevronDown size={19}/>
  </button>
  <dialog ref={dialog} className="repeat-settings-dialog" aria-labelledby={heading} onCancel={e=>{e.preventDefault();e.stopPropagation();close();}}>
   <header><button type="button" aria-label="Назад к делу" onClick={close}><ArrowLeft size={22}/></button><h2 id={heading}>Повторение</h2><button type="button" className="repeat-settings-done" onClick={apply}><Check size={18}/>Готово</button></header>
   <div className="repeat-settings-content">
    <section><h3>Повторяется раз в</h3><div className="repeat-frequency">
      <input aria-label="Интервал повторения" type="number" inputMode="numeric" min="1" max="365" value={draft.repeatInterval??1} disabled={!draft.repeat} onChange={e=>patch({repeatInterval:Number(e.target.value)})}/>
      <AppSelect aria-label="Единица повторения" value={draft.repeat||''} onChange={e=>patch({repeat:e.target.value as Task['repeat'],repeatAnchor:undefined,repeatDay:undefined})}><option value="">Не повторять</option><option value="daily">день</option><option value="weekly">неделю</option><option value="monthly">месяц</option></AppSelect>
    </div></section>
    {draft.repeat==='weekly'&&<section><h3>Когда повторяется</h3><div className="repeat-day-circles" role="group" aria-label="Дни недели">{weekdays.map((label,i)=><button type="button" key={i} aria-label={'Повторять: '+label} aria-pressed={selected.includes(i)} onClick={()=>patch({repeatWeekdays:selected.includes(i)?selected.filter(d=>d!==i):[...selected,i].sort()})}>{label}</button>)}</div></section>}
    {draft.repeat&&<>
      <section className="repeat-first-date"><DatePicker label="Первая дата" value={draft.due} change={due=>{if(due)patch({due,repeatAnchor:undefined,repeatDay:undefined});}}/></section>
      <section><h3>Заканчивается</h3><div className="repeat-ending-options">
        <label><input type="radio" name={radioName} value="never" checked={end==='never'} onChange={()=>setEnd('never')}/><span>Никогда</span></label>
        <div className="repeat-ending-row"><label><input aria-label="Завершить в дату" type="radio" name={radioName} value="date" checked={end==='date'} onChange={()=>{setEnd('date');if(!draft.repeatUntil)patch({repeatUntil:shiftDate(draft.due,30)});}}/><span>В дату</span></label>{end==='date'&&<DatePicker label="Дата завершения" value={draft.repeatUntil||shiftDate(draft.due,30)} change={repeatUntil=>patch({repeatUntil})}/>}</div>
        <div className="repeat-ending-row"><label><input type="radio" name={radioName} value="count" checked={end==='count'} onChange={()=>{setEnd('count');patch({repeatCount:draft.repeatCount||1});}}/><span>После</span></label>{end==='count'&&<><input aria-label="Количество повторений" type="number" inputMode="numeric" min="1" max="999" value={draft.repeatCount??1} onChange={e=>patch({repeatCount:Number(e.target.value)})}/><span>повторений</span></>}</div>
      </div></section>
      {preview.length>0&&<section className="repeat-preview"><h3>Ближайшие даты</h3><div>{preview.map(date=><span key={date}>{new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</span>)}</div></section>}
    </>}
    {error&&<p role="alert" className="task-editor-error">{error}</p>}
   </div>
  </dialog>
 </div>;
}
