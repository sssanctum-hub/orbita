import type { Data } from "./domain";
import { readPhoto, restorePhoto } from "./attachments";
import { encode, decode } from "./vaultCrypto";
import { createVault, unlockVault, seal, unseal, recoveryProof, rotateWithRecovery, type Ciphertext } from "./vaultCrypto";
const endpoint=(import.meta.env.VITE_ACCOUNT_API||"").replace(/\/$/,"");
export const accountsAvailable=!!endpoint;
export type AccountSession={token:string;email:string;key:CryptoKey;accountId:string};
export class AccountError extends Error { constructor(message:string,public status:number){super(message);} }
export async function accountRequest(session:AccountSession|null,path:string,method="GET",body?:unknown){
 if(!endpoint.startsWith("https://")&&!endpoint.startsWith("http://localhost:"))throw Error("Для аккаунтов требуется HTTPS.");
 const response=await fetch(endpoint.includes("functions.yandexcloud.net/") ? endpoint+"?route="+encodeURIComponent(path) : endpoint+path,{method,headers:{"Content-Type":"application/json",...(session?{"X-Orbita-Token":session.token}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(20000)});
 const result=await response.json();if(!response.ok)throw new AccountError(result.error||"Ошибка сервера",response.status);return result;
}
async function loginProof(email:string,password:string){
 const encoder=new TextEncoder();
 const material=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
 const bytes=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",iterations:600000,salt:encoder.encode("orbita-auth-v1:"+email)},material,256));
 return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
export async function authenticate(email:string,password:string,register:boolean){
 email=email.trim().toLowerCase();
 const accountId=crypto.randomUUID();
 const vault=register?await createVault(password,accountId):null;
 const result=await accountRequest(null,register?"/register":"/login","POST",{email,password:await loginProof(email,password),...(vault?{recoveryProof:await recoveryProof(vault.recoveryCode),vault:{accountId,salt:vault.salt,wrappedKey:vault.wrappedKey,recoveryKey:vault.recoveryKey}}:{})});
 const key=vault?.key||await unlockVault(password,result.vault.salt,result.vault.wrappedKey,result.vault.accountId);
 return {session:{token:result.token,email,key,accountId:result.vault.accountId} as AccountSession,recoveryCode:vault?.recoveryCode};
}
export async function pullAccount(session:AccountSession):Promise<{revision:number;data:Data|null}>{
 const result=await accountRequest(session,"/data/manifest");
 if(!result.document)return {revision:result.revision,data:null};
 const doc=result.document;
 if(!Number.isInteger(doc.chunks)||doc.chunks<1||doc.chunks>220)throw Error("Некорректный размер копии.");
 let text="";
 for(let index=0;index<doc.chunks;index++){const part=await accountRequest(session,"/data/chunk","POST",{blob:doc.blob,index});text+=part.text;if(text.length>25*1024*1024)throw Error("Копия превышает лимит.");}
 if(doc.digest){const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,"0")).join("");if(digest!==doc.digest)throw Error("Нарушена целостность копии.");}
 const bytes=await unseal(session.key,JSON.parse(text) as Ciphertext,session.accountId+":data:v1");
 const value=JSON.parse(new TextDecoder().decode(bytes));
 const data:Data=value.backupVersion===1?value.data:value;
 if(!Array.isArray(data.tasks)||!Array.isArray(data.projects)||!Array.isArray(data.notes))throw Error("Некорректная облачная копия.");
 if(value.backupVersion===1){
  const restored=new Map<string,string>();
  for(const task of data.tasks)for(const image of task.images||[]){
   if(!restored.has(image.id)){const photo=value.photos?.[image.id];if(typeof photo!=="string"||photo.length>1400000)throw Error("Фотография в копии повреждена.");const bytes=decode(photo);if(bytes.length>1000000)throw Error("Фотография превышает лимит.");restored.set(image.id,await restorePhoto(bytes));}
   image.id=restored.get(image.id)!;
  }
 }
 return {revision:result.revision,data};
}
export async function pushAccount(session:AccountSession,revision:number,data:Data){
 const photos:Record<string,string>=Object.create(null);let size=0;
 for(const task of data.tasks)for(const image of task.images||[])if(!photos[image.id]){const bytes=await readPhoto(image.id);size+=bytes.length;if(size>13*1024*1024)throw Error("Фотографии превышают лимит резервной копии — 13 МБ. Локальные данные сохранены.");photos[image.id]=encode(bytes);}
 const encrypted=await seal(session.key,new TextEncoder().encode(JSON.stringify({backupVersion:1,data,photos})),session.accountId+":data:v1");
 const text=JSON.stringify(encrypted);
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,"0")).join("");
 for(let i=0;i<20;i++){const cleanup=await accountRequest(session,"/data/cleanup","POST");if(!cleanup.pending)break;if(i===19)throw Error("Очистка копии ещё выполняется. Повторите синхронизацию.");}
 const upload=await accountRequest(session,"/data/upload","POST",{revision,bytes:text.length,digest});
 try{
  for(let index=0;index<Math.ceil(text.length/upload.chunkSize);index++)await accountRequest(session,"/data/upload/chunk","PUT",{blob:upload.blob,index,text:text.slice(index*upload.chunkSize,(index+1)*upload.chunkSize)});
  return await accountRequest(session,"/data/commit","POST",{blob:upload.blob});
 }catch(error){await accountRequest(session,"/data/upload","DELETE",{blob:upload.blob}).catch(()=>{});throw error;}
}

export async function restoreAccount(email:string,code:string,password:string){
 if(password.length<12||password.length>128)throw Error("Пароль: от 12 до 128 символов.");
 email=email.trim().toLowerCase();
 const start=await accountRequest(null,"/recovery/start","POST",{email,recoveryProof:await recoveryProof(code)});
 const rotated=await rotateWithRecovery(code,password,start.vault);
 await accountRequest(null,"/recovery/complete","POST",{email,recoveryToken:start.recoveryToken,password:await loginProof(email,password),vault:rotated.vault,recoveryProof:rotated.recoveryProof});
 return rotated.recoveryCode;
}
export async function deleteAccount(session:AccountSession,password:string){
 const proof=await loginProof(session.email,password);
 for(let i=0;i<30;i++){const result=await accountRequest(session,"/account","DELETE",{password:proof});if(!result.pending)return;}
 throw Error("Удаление ещё выполняется. Повторите действие для завершения.");
}
