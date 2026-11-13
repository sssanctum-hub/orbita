import { vibrationKey } from "../haptics";
import LauncherIconPicker from "./LauncherIconPicker";
import CharacterPicker, { CharacterPortrait } from "./CharacterPicker";
import { characterLevel, type CharacterClass } from "../character";
import { useEffect, useRef, useState } from "react";
import { UserRound, X, ShieldCheck, CloudUpload } from "lucide-react";
import type { Data } from "../domain";
import { accountsAvailable, authenticate, accountRequest, pullAccount, pushAccount, restoreAccount, deleteAccount, type AccountSession } from "../accountClient";
import { backupDue } from "../backupSchedule";
const fingerprint=(data:Data)=>JSON.stringify({...data,revision:0});
export default function AccountPanel({data,busy,restore}:{data:Data;busy:boolean;restore:(data:Data)=>Promise<void>}){
 const [registering,setRegistering]=useState(false);
 const [chosenClass,setChosenClass]=useState<CharacterClass>("Учёный");
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const open=()=>dialog.current?.showModal();window.addEventListener("orbita:open-account",open);return()=>window.removeEventListener("orbita:open-account",open);},[]);
 const backdropPress=useRef(false);
 function closePanel(){dialog.current?.close();setPassword("");setRecoveryInput("");}
 function logout(){
  const previous=session;
  generation.current++;base.current=null;owner.current=null;
  setSession(null);setPassword("");setRecovery("");setConflict(false);
  setMessage("Вы вышли. Записи остаются на этом устройстве.");
  if(previous)void accountRequest(previous,"/session","DELETE").catch(()=>{});
 }
 const [session,setSession]=useState<AccountSession|null>(null),[email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [working,setWorking]=useState(false),[message,setMessage]=useState(""),[recovery,setRecovery]=useState("");
 const [conflict,setConflict]=useState(false);
 const [recovering,setRecovering]=useState(false),[recoveryInput,setRecoveryInput]=useState("");
 const latest=useRef({data,busy,restore});latest.current={data,busy,restore};
 const syncLock=useRef(false),base=useRef<string|null>(null),revision=useRef(0),generation=useRef(0);
 async function run(action:()=>Promise<void>){if(workLock.current||syncLock.current||latest.current.busy)return;workLock.current=true;setWorking(true);try{await action();}catch(error){setMessage(String(error));}finally{workLock.current=false;setWorking(false);}}
 const [lastBackup,setLastBackup]=useState(0);
 const owner=useRef<string|null>(null),lastSuccess=useRef(0),workLock=useRef(false);
 async function createBackup(current:AccountSession,manual=false){
  if(workLock.current||syncLock.current||latest.current.busy||!navigator.onLine||recovery||owner.current!==current.accountId)return;
  const snapshot=latest.current.data,text=fingerprint(snapshot);
  if(!manual&&!backupDue(Date.now(),lastSuccess.current,text!==base.current))return;
  syncLock.current=true;
  try{
   const head=await accountRequest(current,"/revision");
   if(head.revision!==revision.current)throw Error("На сервере появилась копия с другого устройства. Откройте аккаунт и сначала выберите восстановление или создание своей копии.");
   const result=await pushAccount(current,revision.current,snapshot);
   if(owner.current!==current.accountId)return;
   revision.current=result.revision;base.current=text;lastSuccess.current=Date.now();setLastBackup(lastSuccess.current);
   setMessage("Зашифрованная резервная копия создана.");
  }catch(error){setMessage("Резервное копирование: "+String(error));}finally{syncLock.current=false;}
 }
 useEffect(()=>{
  if(!session||recovery)return;
  const update=()=>{if(document.visibilityState==="visible")void createBackup(session);};
  const timer=setInterval(update,60000);window.addEventListener("online",update);document.addEventListener("visibilitychange",update);
  update();return()=>{clearInterval(timer);window.removeEventListener("online",update);document.removeEventListener("visibilitychange",update);};
 },[session,recovery]);
 async function auth(register:boolean){await run(async()=>{
 if(password.length<12||password.length>128)throw Error("Пароль: от 12 до 128 символов.");
 if(register&&!latest.current.data.character)await latest.current.restore({...latest.current.data,character:{className:chosenClass,xp:0,rewarded:[]}});
 const result=await authenticate(email,password,register),cloud=await accountRequest(result.session,"/data/manifest");
 // Existing device records are never silently uploaded into another account.
 generation.current++;base.current=null;revision.current=cloud.revision;setSession(result.session);setPassword("");setRecovery(result.recoveryCode||"");setConflict(true);owner.current=null;lastSuccess.current=0;setLastBackup(cloud.document?.createdAt||0);
 setMessage(cloud.document?"На сервере есть резервная копия. Восстановите её или привяжите записи устройства для копирования.":"Подтвердите привязку записей устройства к этому аккаунту.");
 });}
 async function chooseCloud(){if(!session)return;await run(async()=>{
 if(!confirm("Восстановить резервную копию с заменой локальных записей? Сначала сохраните нужные записи отдельно."))return;
 const localRevision=latest.current.data.revision;const cloud=await pullAccount(session);if(latest.current.data.revision!==localRevision)throw Error("За время загрузки записи изменились. Повторите восстановление.");if(!cloud.data){setMessage("Облако пустое. Отправьте записи устройства.");return;}

 await latest.current.restore({...cloud.data,revision:latest.current.data.revision});revision.current=cloud.revision;base.current=fingerprint(cloud.data);setConflict(false);owner.current=session.accountId;lastSuccess.current=Date.now();setMessage("Копия восстановлена локально. Автоматическое копирование включено.");
 });}
 async function chooseLocal(){if(!session)return;await run(async()=>{
 if(!confirm("Привязать записи устройства к этому аккаунту? Следующая резервная копия заменит прежнюю копию на сервере."))return;
 const head=await accountRequest(session,"/revision");revision.current=head.revision;owner.current=session.accountId;base.current=null;setConflict(false);setMessage("Записи привязаны. Копия будет создана автоматически, когда приложение открыто и есть интернет.");
 });}
 function backup(){const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="orbita-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <><button type="button" className="account-trigger" aria-label="Открыть профиль и резервные копии" title="Профиль и резервные копии" onClick={()=>dialog.current?.showModal()}><UserRound size={21}/></button>
 <dialog ref={dialog} className="account-dialog" onCancel={()=>{setPassword("");setRecoveryInput("");}} onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect();backdropPress.current=e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;}} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();if(backdropPress.current&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))closePanel();backdropPress.current=false;}}><header className="account-heading"><div className="account-avatar"><UserRound size={25}/></div><div><span className="account-eyebrow">ОРБИТА · ЛИЧНОЕ</span><h2>Мой профиль</h2></div><button type="button" className="account-close" aria-label="Закрыть профиль" onClick={closePanel}><X size={20}/><span>Назад</span></button></header>
 {data.character&&<section className="character-card"><CharacterPortrait name={data.character.className}/><h3>{data.character.className}</h3><p>Уровень {characterLevel(data.character.xp)} · {data.character.xp} опыта</p><progress aria-label="Опыт до следующего уровня" value={data.character.xp-100*(characterLevel(data.character.xp)-1)**2} max={100*characterLevel(data.character.xp)**2-100*(characterLevel(data.character.xp)-1)**2}/><p>+25 опыта за выполненное дело</p></section>}
 {!accountsAvailable?<p>Сервер аккаунтов ещё не подключён.</p>:!session?<form onSubmit={e=>{e.preventDefault();if(recovering){void run(async()=>{const code=await restoreAccount(email,recoveryInput,password);setRecovery(code);setRecoveryInput("");setPassword("");setRecovering(false);setMessage("Пароль изменён. Сохраните новый код восстановления и войдите с новым паролем.");});}else void auth(registering);}}>
 {!recovering&&<><div className="account-auth-tabs" role="group" aria-label="Действие с аккаунтом"><button type="button" aria-pressed={!registering} onClick={()=>{setRegistering(false);setPassword("");setMessage("");}}>Войти</button><button type="button" aria-pressed={registering} onClick={()=>{setRegistering(true);setPassword("");setMessage("");}}>Создать аккаунт</button></div><p>{registering?"Выберите своего персонажа и сохраните доступ к резервным копиям.":"Войдите, чтобы сохранять и восстанавливать зашифрованные копии."}</p></>}
 {registering&&!recovering&&<CharacterPicker value={chosenClass} onChange={setChosenClass}/>}
 <label>Почта<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>{registering||recovering?"Новый пароль":"Пароль"}<input type="password" required minLength={12} maxLength={128} autoComplete={registering||recovering?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)}/></label>
 {recovering&&<label>Секретный код восстановления<input required autoComplete="off" value={recoveryInput} onChange={e=>setRecoveryInput(e.target.value)}/></label>}
 {(registering||recovering)&&<p className="account-field-hint">От 12 до 128 символов. Сохраните пароль в надёжном месте.</p>}
 <button className="account-auth-submit" type="submit" disabled={working}>{working?"Подождите…":recovering?"Восстановить доступ":registering?"Создать аккаунт":"Войти"}</button>
 <button type="button" disabled={working} onClick={()=>{setRecovering(!recovering);setPassword("");setRecoveryInput("");}}>{recovering?"Вернуться ко входу":"Забыли пароль?"}</button>
 {recovery&&<section><p>Сохраните новый код. Прежний код больше не действует.</p><code style={{overflowWrap:"anywhere"}}>{recovery}</code><button type="button" onClick={()=>setRecovery("")}>Я сохранил код</button></section>}
 </form>:<><p className="account-email">{session.email}</p><section className="account-backup-card"><div className="account-card-title"><ShieldCheck size={20}/><h3>Резервная копия</h3></div><p>Записи остаются на устройстве. При изменениях сохраняем зашифрованную копию раз в сутки, пока Орбита открыта.</p><p className="account-last-backup">Последняя копия: {lastBackup?new Date(lastBackup).toLocaleString("ru-RU"):"ещё не создана"}</p><button disabled={working||busy||conflict||!!recovery} className="account-primary" onClick={()=>session&&void createBackup(session,true)}><CloudUpload size={18}/> Создать копию сейчас</button><button disabled={working||busy||!!recovery} onClick={()=>void chooseCloud()}>Восстановить из копии</button></section>
 {recovery&&<section><p>Сохраните код восстановления в надёжном месте. Без пароля и кода записи восстановить невозможно.</p><code style={{overflowWrap:"anywhere"}}>{recovery}</code><button onClick={()=>setRecovery("")}>Я сохранил код</button></section>}
 {conflict&&<section className="account-binding"><p>Для начала выберите: сохранить записи этого устройства в аккаунт или восстановить последнюю копию.</p><button disabled={working||busy||!!recovery} onClick={()=>void chooseLocal()}>Сохранять записи этого устройства</button></section>}
 <button type="button" className="account-logout" onClick={logout}>Выйти из аккаунта</button>
 <details className="account-danger"><summary>Удаление аккаунта</summary><p>Аккаунт, облачные записи и фотографии будут удалены без возможности восстановления. Локальные записи на устройствах останутся.</p><label>Подтвердите пароль<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={working||busy||!password} onClick={()=>void run(async()=>{if(!confirm("Безвозвратно удалить аккаунт и все его облачные данные?"))return;generation.current++;base.current=null;await deleteAccount(session,password);setSession(null);setPassword("");setRecovery("");setConflict(false);setMessage("Аккаунт и облачные данные удалены.");})}>Удалить аккаунт</button></details></>}
 {session&&<><button className="account-export" onClick={backup}>Скачать записи файлом</button><p className="account-export-note">Экспорт JSON содержит записи без шифрования.</p></>}{message&&<p className="account-status" role="status">{message}</p>}<VibrationSetting/><LauncherIconPicker/><footer className="account-footer"><button type="button" onClick={closePanel}>Готово</button></footer></dialog></>;
}

function VibrationSetting() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(vibrationKey) !== "off");
  return <label className="account-vibration">
    <input type="checkbox" checked={enabled} onChange={event => {
      const checked = event.target.checked;
      localStorage.setItem(vibrationKey, checked ? "on" : "off");
      setEnabled(checked);
    }} />
    Вибрация
  </label>;
}
