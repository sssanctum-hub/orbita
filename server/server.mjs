import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt, timingSafeEqual, createHash, createHmac, createCipheriv } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const storageKey=Buffer.from(process.env.ACCOUNT_STORAGE_KEY||'', 'hex');
if(storageKey.length!==32)throw Error('ACCOUNT_STORAGE_KEY must be 32 random bytes encoded as hex');
const emailId=email=>createHmac('sha256',storageKey).update(email).digest('hex');
function encryptEmail(email){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',storageKey,iv);const bytes=Buffer.concat([cipher.update(email,'utf8'),cipher.final()]);return JSON.stringify({iv:iv.toString('base64'),data:bytes.toString('base64'),tag:cipher.getAuthTag().toString('base64')});}
const db = new DatabaseSync(process.env.DATABASE_PATH || './orbita.sqlite');
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,password TEXT,salt TEXT); CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT,expires INTEGER); CREATE TABLE IF NOT EXISTS documents(user_id TEXT PRIMARY KEY,revision INTEGER,body TEXT);');
db.exec('CREATE TABLE IF NOT EXISTS private_profiles(user_id TEXT PRIMARY KEY,email_cipher TEXT)');
db.exec('CREATE TABLE IF NOT EXISTS vault_keys(user_id TEXT PRIMARY KEY,account_id TEXT,salt TEXT,wrapped TEXT,recovery TEXT)');
const hash = value => createHash('sha256').update(value).digest('hex');
const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:1420').split(',');
const attempts = new Map();
function limited(key) { const now=Date.now(); for(const [k,v] of attempts) if(v.until<now) attempts.delete(k); const v=attempts.get(key)||{count:0,until:now+900000}; v.count++; attempts.set(key,v); return v.count>30; }
async function body(req) { let text=''; for await(const chunk of req) { text+=chunk; if(Buffer.byteLength(text)>20000000) throw {status:413,message:'Слишком много данных.'}; } try{return JSON.parse(text);}catch{throw {status:400,message:'Некорректный JSON.'};} }
function validCipher(value){return value?.version===1 && typeof value.iv==='string' && Buffer.from(value.iv,'base64').length===12 && typeof value.ciphertext==='string' && value.ciphertext.length>=24;}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin && !origins.includes(origin)){res.writeHead(403);res.end();return;}
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
 res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
 const send=(status,value)=>{res.writeHead(status);res.end(JSON.stringify(value));};
 try {
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.url==='/health'){send(200,{ok:true});return;}
 if(req.method==='POST' && ['/register','/login'].includes(req.url)){
  if(limited(req.socket.remoteAddress))throw {status:429,message:'Слишком много попыток. Повторите позже.'};
  const input=await body(req),email=String(input.email||'').trim().toLowerCase(),password=String(input.password||'');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>254||password.length<12||password.length>128)throw {status:400,message:'Укажите почту и пароль от 12 до 128 символов.'};
  let user=db.prepare('SELECT * FROM users WHERE email=?').get(emailId(email));
  if(req.url==='/register'){
   if(user)throw {status:409,message:'Регистрация недоступна для этого адреса.'};
   if(!input.vault || typeof input.vault.accountId!=='string' || !validCipher(input.vault.wrappedKey) || !validCipher(input.vault.recoveryKey) || typeof input.vault.salt!=='string')throw {status:400,message:'Требуется зашифрованное хранилище.'};
   const salt=randomBytes(16).toString('hex'),id=randomBytes(16).toString('hex');
   db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,emailId(email),(await derive(password,salt,64)).toString('hex'),salt);
   db.prepare('INSERT INTO private_profiles VALUES(?,?)').run(id,encryptEmail(email));
   db.prepare('INSERT INTO vault_keys VALUES(?,?,?,?,?)').run(id,input.vault.accountId,input.vault.salt,JSON.stringify(input.vault.wrappedKey),JSON.stringify(input.vault.recoveryKey));
   user={id,email};
  }else{
   const derived=await derive(password,user?.salt||'dummy-salt',64);
   if(!user||!timingSafeEqual(derived,Buffer.from(user.password,'hex')))throw {status:401,message:'Неверная почта или пароль.'};
  }
  const token=randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),user.id,Date.now()+30*86400000);
  const vault=db.prepare('SELECT * FROM vault_keys WHERE user_id=?').get(user.id);
  if(!vault)throw {status:409,message:'Старый аккаунт требует миграции.'};
  send(200,{token,email,vault:{accountId:vault.account_id,salt:vault.salt,wrappedKey:JSON.parse(vault.wrapped),recoveryKey:JSON.parse(vault.recovery)}});return;
 }
 const token=(req.headers.authorization||'').replace(/^Bearer /,'');
 const session=db.prepare('SELECT * FROM sessions WHERE hash=? AND expires>?').get(hash(token),Date.now());
 if(!session)throw {status:401,message:'Войдите в аккаунт повторно.'};
 if(req.url==='/session'&&req.method==='DELETE'){db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(token));send(200,{ok:true});return;}
 if(req.url==='/data'&&req.method==='GET'){const row=db.prepare('SELECT * FROM documents WHERE user_id=?').get(session.user_id);send(200,row?{revision:row.revision,data:JSON.parse(row.body)}:{revision:0,data:null});return;}
 if(req.url==='/data'&&req.method==='PUT'){
  const input=await body(req),data=input.data;
  if(!validCipher(data)||!Number.isSafeInteger(input.revision)||input.revision<0)throw {status:400,message:'Некорректные данные.'};
  db.exec('BEGIN IMMEDIATE');
  try{const row=db.prepare('SELECT revision FROM documents WHERE user_id=?').get(session.user_id);if((row?.revision||0)!==input.revision)throw {status:409,message:'Данные изменились на другом устройстве. Сначала загрузите актуальную копию.'};
   const revision=input.revision+1;db.prepare('INSERT INTO documents VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,body=excluded.body').run(session.user_id,revision,JSON.stringify(data));db.exec('COMMIT');send(200,{revision});return;
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 send(404,{error:'Не найдено.'});
 }catch(error){send(error.status||500,{error:error.status?error.message:'Ошибка сервера.'});}
});
server.listen(Number(process.env.PORT||8080),'0.0.0.0');
