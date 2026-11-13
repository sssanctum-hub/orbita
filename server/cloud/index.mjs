import {randomBytes,scrypt,timingSafeEqual,createHash,createHmac,createCipheriv} from 'node:crypto';
import {promisify} from 'node:util';
import {ydbStore} from './ydb-store.mjs';
const derive=promisify(scrypt),hash=v=>createHash('sha256').update(v).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const equal=(a,b)=>hex(a)&&hex(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const base64=(s,n)=>typeof s==='string'&&s.length<=n*2+4&&Buffer.from(s,'base64').length===n&&Buffer.from(s,'base64').toString('base64')===s;
const validCipher=v=>v?.version===1&&base64(v.iv,12)&&typeof v.ciphertext==='string'&&v.ciphertext.length>=24&&/^[A-Za-z0-9+/]+={0,2}$/.test(v.ciphertext);
const validVault=v=>v&&typeof v.accountId==='string'&&v.accountId.length>0&&v.accountId.length<=100&&base64(v.salt,32)&&validCipher(v.wrappedKey)&&base64(v.wrappedKey.ciphertext,48)&&validCipher(v.recoveryKey)&&base64(v.recoveryKey.ciphertext,48);
export const CHUNK_SIZE=120000,MAX_SNAPSHOT=25*1024*1024;
const put=(key,value,expected)=>({type:'put',key,value,expected});
const del=key=>({type:'delete',key});
const chunkKey=(user,blob,index)=>'chunk:'+user.id+':'+blob+':'+index;
const now=()=>Date.now();
export function createHandler(store,key,origins){
 if(key.length!==32)throw Error('Missing storage key');
 const emailId=v=>createHmac('sha256',key).update(v).digest('hex');
 const encryptEmail=email=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);return {iv:iv.toString('base64'),ciphertext:Buffer.concat([c.update(email,'utf8'),c.final()]).toString('base64'),tag:c.getAuthTag().toString('base64')};};
 async function rateLimit(id){
  const name='limit:'+hash(id);
  for(let i=0;i<5;i++){const old=await store.get(name),active=old&&old.expires>now();if(active&&old.count>=20)fail(429,'Слишком много попыток. Повторите через 15 минут.');
   if(await store.put(name,{version:(old?.version||0)+1,count:(active?old.count:0)+1,expires:active?old.expires:now()+900000},old?old.version:null))return;
  }fail(429,'Повторите позже.');
 }
 async function checkPassword(user,proof){
  if(!hex(proof))fail(400,'Некорректные данные входа.');
  const derived=await derive(proof,user?.salt||'dummy-salt',64);
  if(!user||!timingSafeEqual(derived,Buffer.from(user.password,'hex')))fail(401,'Неверная почта или пароль.');
 }
 async function saveUser(userKey,user,next,extra=[]){
  next={...next,version:user.version+1};
  if(!await store.transact([put(userKey,next,user.version),...extra]))fail(409,'Данные изменились. Повторите действие.');
  return next;
 }
 async function migrate(userKey,user){
  if(user.document!==undefined)return user;
  const oldDoc=await store.get('document:'+user.id);
  return saveUser(userKey,user,{...user,authEpoch:user.authEpoch||1,sessions:[],document:oldDoc||null,garbage:[]},oldDoc?[del('document:'+user.id)]:[]);
 }
 // At most 20 small operations per request. Progress is durable and retries are safe.
 async function cleanup(userKey,user){
  const garbage=[...(user.garbage||[])];const operations=[];
  while(garbage.length&&operations.length<20){
   const first={...garbage[0]},index=first.offset||0;
   if(index>=first.chunks){garbage.shift();continue;}
   operations.push(del(chunkKey(user,first.blob,index)));first.offset=index+1;garbage[0]=first;
  }
  while(garbage.length&&(garbage[0].offset||0)>=garbage[0].chunks)garbage.shift();
  return saveUser(userKey,user,{...user,garbage},operations);
 }
 return async(event)=>{
  const headers=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
  const origin=headers.origin,method=event.httpMethod||'GET',path=(event.queryStringParameters?.route||event.path||'/').replace(/\/$/,'')||'/';
  const outHeaders={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,X-Orbita-Token',...(origin&&origins.includes(origin)?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{})};
  const response=(statusCode,value)=>({statusCode,headers:outHeaders,body:JSON.stringify(value)});
  try{
   if(origin&&!origins.includes(origin))fail(403,'Источник не разрешён.');
   if(method==='OPTIONS')return response(204,null);
   if(path==='/health')return response(200,{ok:true,protocol:2,maxSnapshot:MAX_SNAPSHOT});
   const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString('utf8'):event.body||'{}';
   if(Buffer.byteLength(raw)>3000000)fail(413,'Превышен размер запроса.');
   let input;try{input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw Error();}catch{fail(400,'Некорректный JSON.');}
   const ip=event.requestContext?.identity?.sourceIp;
   if(method==='POST'&&['/register','/login','/recovery/start','/recovery/complete'].includes(path)){
    const email=String(input.email||'').trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>254)fail(400,'Проверьте почту.');
    const userKey='user:'+emailId(email);await rateLimit(userKey);if(ip)await rateLimit('ip:'+ip);
    let user=await store.get(userKey);
    if(path==='/recovery/start'){
     if(!user||user.deleting||!equal(input.recoveryProof,user.recoveryProof))fail(401,'Неверная почта или код восстановления.');
     const recoveryToken=randomBytes(32).toString('hex');
     user=await saveUser(userKey,user,{...user,recovery:{hash:hash(recoveryToken),expires:now()+600000}});
     return response(200,{recoveryToken,vault:user.vault});
    }
    if(path==='/recovery/complete'){
     if(!user||user.deleting||!hex(input.recoveryToken)||user.recovery?.expires<=now()||!equal(hash(input.recoveryToken),user.recovery?.hash))fail(401,'Восстановление истекло. Начните заново.');
     if(!validVault(input.vault)||input.vault.accountId!==user.vault.accountId||!hex(input.recoveryProof)||!hex(input.password))fail(400,'Некорректное хранилище.');
     const salt=randomBytes(16).toString('hex'),password=(await derive(input.password,salt,64)).toString('hex');
     user=await saveUser(userKey,user,{...user,salt,password,vault:input.vault,recoveryProof:input.recoveryProof,recovery:null,authEpoch:(user.authEpoch||1)+1,sessions:[]},(user.sessions||[]).map(s=>del('session:'+s.hash)));
     return response(200,{ok:true});
    }
    if(path==='/register'){
     if(!hex(input.password)||!hex(input.recoveryProof)||!validVault(input.vault))fail(400,'Некорректное хранилище.');
     const salt=randomBytes(16).toString('hex');
     user={version:1,id:randomBytes(16).toString('hex'),email:encryptEmail(email),salt,password:(await derive(input.password,salt,64)).toString('hex'),vault:input.vault,recoveryProof:input.recoveryProof,authEpoch:1,sessions:[],document:null,garbage:[]};
     if(!await store.put(userKey,user,null))fail(409,'Регистрация для этого адреса недоступна.');
    }else await checkPassword(user,input.password);
    if(user.deleting)fail(409,'Удаление аккаунта уже начато. Завершите его в прежней сессии.');
    user=await migrate(userKey,user);
    const token=randomBytes(32).toString('hex'),tokenHash=hash(token),expires=now()+30*86400000;
    const active=(user.sessions||[]).filter(s=>s.expires>now()).slice(-9),keep=new Set(active.map(s=>s.hash));
    const removed=(user.sessions||[]).filter(s=>!keep.has(s.hash));
    await saveUser(userKey,user,{...user,sessions:[...active,{hash:tokenHash,expires}]},[...removed.map(s=>del('session:'+s.hash)),put('session:'+tokenHash,{version:1,userKey,userId:user.id,authEpoch:user.authEpoch,expires},null)]);
    return response(200,{token,email,vault:user.vault,recoveryEnabled:!!user.recoveryProof});
   }
   const token=headers['x-orbita-token']||(headers.authorization||'').replace(/^Bearer /,'');if(!hex(token))fail(401,'Войдите в аккаунт.');
   const tokenHash=hash(token),sessionKey='session:'+tokenHash,session=await store.get(sessionKey);
   if(!session||!session.userKey||session.expires<=now())fail(401,'Войдите в аккаунт повторно.');
   const userKey=session.userKey;let user=await store.get(userKey);
   if(!user||user.id!==session.userId||user.authEpoch!==session.authEpoch||!user.sessions?.some(s=>s.hash===tokenHash&&s.expires>now()))fail(401,'Войдите в аккаунт повторно.');
   if(path==='/session'&&method==='DELETE'){
    await saveUser(userKey,user,{...user,sessions:user.sessions.filter(s=>s.hash!==tokenHash)},[del(sessionKey)]);return response(200,{ok:true});
   }
   if(path==='/account'&&method==='DELETE'){
    if(!user.deleting){await rateLimit(userKey+':delete');await checkPassword(user,input.password);
     const garbage=[...(user.garbage||[]),...(user.document?[user.document]:[]),...(user.upload?[{blob:user.upload.blob,chunks:user.upload.received}]:[])];
     user=await saveUser(userKey,user,{...user,deleting:true,document:null,upload:null,recovery:null,garbage,sessions:user.sessions.filter(s=>s.hash===tokenHash)},user.sessions.filter(s=>s.hash!==tokenHash).map(s=>del('session:'+s.hash)));
    }
    if(user.garbage.length)user=await cleanup(userKey,user);
    if(user.garbage.length)return response(202,{pending:true});
    if(!await store.transact([{type:'delete',key:userKey,expected:user.version},del(sessionKey)]))fail(409,'Повторите удаление.');
    return response(200,{ok:true});
   }
   if(user.deleting)fail(410,'Аккаунт удаляется.');
   if(path==='/recovery/enroll'&&method==='POST'){
    await rateLimit(userKey+':enroll');await checkPassword(user,input.password);
    if(!validVault(input.vault)||input.vault.accountId!==user.vault.accountId||!hex(input.recoveryProof))fail(400,'Некорректное хранилище.');
    await saveUser(userKey,user,{...user,vault:input.vault,recoveryProof:input.recoveryProof,recovery:null});return response(200,{ok:true});
   }
   if(path==='/revision'&&method==='GET')return response(200,{revision:user.document?.version||0});
   if(path==='/data/manifest'&&method==='GET')return response(200,{revision:user.document?.version||0,document:user.document});
   if(path==='/data/chunk'&&method==='POST'){
    const doc=user.document;
    if(!doc||input.blob!==doc.blob)fail(409,'Облачная копия обновлена. Загрузите её снова.');
    if(!Number.isInteger(input.index)||input.index<0||input.index>=doc.chunks)fail(400,'Некорректная часть.');
    const part=await store.get(chunkKey(user,doc.blob,input.index));if(!part)fail(409,'Копия обновляется. Повторите загрузку.');return response(200,{text:part.text});
   }
   if(path==='/data/cleanup'&&method==='POST'){
    if(user.garbage?.length)user=await cleanup(userKey,user);return response(200,{pending:!!user.garbage?.length});
   }
   if(path==='/data/upload'&&method==='POST'){
    if(user.garbage?.length)fail(409,'Нужно завершить очистку предыдущей копии.');
    if(user.upload){
     if(user.upload.expires>now())fail(409,'Передача с другого устройства ещё выполняется. Повторите через несколько минут.');
     await saveUser(userKey,user,{...user,upload:null,garbage:[{blob:user.upload.blob,chunks:user.upload.received}]});fail(409,'Предыдущая передача прервана. Повторите синхронизацию.');
    }
    if(!Number.isSafeInteger(input.bytes)||input.bytes<24||input.bytes>MAX_SNAPSHOT||input.revision!==(user.document?.version||0)||!hex(input.digest))fail(input.bytes>MAX_SNAPSHOT?413:409,'Проверьте размер копии и повторите синхронизацию. Лимит — 25 МБ зашифрованных данных.');
    const upload={blob:randomBytes(16).toString('hex'),bytes:input.bytes,digest:input.digest,chunks:Math.ceil(input.bytes/CHUNK_SIZE),received:0,revision:input.revision,expires:now()+3600000};
    await saveUser(userKey,user,{...user,upload});return response(200,{blob:upload.blob,chunkSize:CHUNK_SIZE});
   }
   if(path==='/data/upload/chunk'&&method==='PUT'){
    const u=user.upload;
    if(!u||u.blob!==input.blob||u.expires<=now())fail(409,'Передача истекла. Повторите синхронизацию.');
    if(!Number.isInteger(input.index)||input.index<0||input.index>=u.chunks||typeof input.text!=='string'||/[^\x20-\x7E]/.test(input.text)||input.text.length!==(input.index===u.chunks-1?u.bytes-input.index*CHUNK_SIZE:CHUNK_SIZE))fail(400,'Некорректная часть копии.');
    const name=chunkKey(user,u.blob,input.index);
    if(input.index<u.received){const old=await store.get(name);if(old?.text===input.text)return response(200,{ok:true});fail(409,'Часть уже записана.');}
    if(input.index!==u.received)fail(409,'Нарушен порядок частей.');
    await saveUser(userKey,user,{...user,upload:{...u,received:u.received+1}},[put(name,{version:1,text:input.text},null)]);return response(200,{ok:true});
   }
   if(path==='/data/upload'&&method==='DELETE'){
    const u=user.upload;if(u&&u.blob===input.blob)await saveUser(userKey,user,{...user,upload:null,garbage:[...(user.garbage||[]),{blob:u.blob,chunks:u.received}]});return response(200,{ok:true});
   }
   if(path==='/data/commit'&&method==='POST'){
    const u=user.upload;if(!u||u.blob!==input.blob||u.received!==u.chunks||u.expires<=now()||u.revision!==(user.document?.version||0))fail(409,'Копия неполная или уже обновлена.');
    // Ciphertext integrity is checked by AES-GCM and digest on the receiving device.
    const doc={version:u.revision+1,blob:u.blob,chunks:u.chunks,bytes:u.bytes,digest:u.digest,createdAt:now()};
    await saveUser(userKey,user,{...user,document:doc,upload:null,garbage:user.document?[user.document]:[]});return response(200,{revision:doc.version});
   }
   // The old full-body API stays read-only: old clients must not bypass v2 quota/atomicity.
   if(path==='/data'&&method==='GET'){
    const doc=user.document;if(!doc)return response(200,{revision:0,data:null});
    if(doc.bytes>2500000)fail(426,'Обновите приложение для загрузки фотографий.');
    const parts=[];for(let i=0;i<doc.chunks;i++){const part=await store.get(chunkKey(user,doc.blob,i));if(!part)fail(409,'Копия обновилась.');parts.push(part.text);}
    return response(200,{revision:doc.version,data:JSON.parse(parts.join(''))});
   }
   if(path==='/data'&&method==='PUT')fail(426,'Обновите приложение для синхронизации.');
   return response(404,{error:'Не найдено.'});
  }catch(error){return response(error.status||503,{error:error.status?error.message:'Сервис временно недоступен. Повторите позже.'});}
 };
}
export async function handler(event,context){
 const token=context.token?.access_token;
 if(!token)return {statusCode:503,body:JSON.stringify({error:'Сервисный аккаунт не подключён.'})};
 return createHandler(ydbStore(process.env.YDB_ENDPOINT,token),Buffer.from(process.env.ACCOUNT_STORAGE_KEY||'','hex'),(process.env.ALLOWED_ORIGINS||'').split(','))(event);
}
