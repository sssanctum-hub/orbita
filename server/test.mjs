import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'orbita-auth-'));
const server=spawn(process.execPath,['server/server.mjs'],{env:{...process.env,ACCOUNT_STORAGE_KEY:'11'.repeat(32),PORT:'18148',DATABASE_PATH:join(dir,'test.sqlite')},stdio:'pipe'});
const call=async(path,method='GET',body,token)=>{const res=await fetch('http://localhost:18148'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json()};};
try{
 for(let i=0;i<50;i++){try{await call('/health');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 const cipher={version:1,iv:Buffer.alloc(12,1).toString('base64'),ciphertext:Buffer.alloc(32,2).toString('base64')};
 const input={email:'one@example.com',password:'derived-proof-123456',vault:{accountId:'a',salt:'salt',wrappedKey:cipher,recoveryKey:cipher}};
 const one=await call('/register','POST',input);assert.equal(one.status,200);const token=one.body.token;
 const two=await call('/register','POST',{...input,email:'two@example.com',vault:{...input.vault,accountId:'b'}});assert.equal(two.status,200);
 assert.equal((await call('/data')).status,401);
 assert.equal((await call('/data','PUT',{revision:0,data:{tasks:[],projects:[],notes:[]}},token)).status,400);
 assert.equal((await call('/data','PUT',{revision:0,data:cipher},token)).status,200);
 assert.equal((await call('/data','PUT',{revision:0,data:cipher},token)).status,409);
 assert.equal((await call('/data','GET',undefined,two.body.token)).body.data,null);
 assert.deepEqual((await call('/data','GET',undefined,token)).body.data,cipher);
 assert.equal((await call('/login','POST',{email:input.email,password:'incorrect-123456'})).status,401);
 assert.equal((await call('/login','POST',input)).status,200);
 await call('/session','DELETE',undefined,token);assert.equal((await call('/data','GET',undefined,token)).status,401);
 console.log('PASS: registration, login, isolation, ciphertext-only storage, conflict protection, logout');
}finally{server.kill();await new Promise(r=>server.once('exit',r));await rm(dir,{recursive:true,force:true});}
