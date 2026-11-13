import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {createVault,seal,unseal,recoveryProof} from '../src/vaultCrypto.ts';
const endpoint='https://functions.yandexcloud.net/d4ej4ac4vfdmgtuhc506';
async function request(path,method='GET',body,token){
 const r=await fetch(endpoint+'?route='+encodeURIComponent(path),{method,headers:{'Content-Type':'application/json',...(token?{'X-Orbita-Token':token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 const value=await r.json();if(!r.ok)throw Error(path+': '+r.status+' '+JSON.stringify(value));return value;
}
assert.equal((await request('/health')).protocol,2);
console.log('PASS public health');
const email='orbita-test-'+randomBytes(8).toString('hex')+'@example.com',password=randomBytes(32).toString('hex'),accountId=crypto.randomUUID();
const vault=await createVault(randomBytes(32).toString('hex'),accountId);
const input={email,password,recoveryProof:await recoveryProof(vault.recoveryCode),vault:{accountId,salt:vault.salt,wrappedKey:vault.wrappedKey,recoveryKey:vault.recoveryKey}};
const registered=await request('/register','POST',input),token=registered.token;
console.log('PASS registration');
const login=await request('/login','POST',{email,password});assert(login.token);
console.log('PASS login');
const original=new TextEncoder().encode(JSON.stringify({tasks:[{title:'Synthetic private test'}],customAreas:['Synthetic area'],photo:randomBytes(512).toString('base64')}));
const cipher=await seal(vault.key,original,accountId+':data:v1'),text=JSON.stringify(cipher),digest=createHash('sha256').update(text).digest('hex');
const upload=await request('/data/upload','POST',{revision:0,bytes:text.length,digest},token);
for(let index=0;index<Math.ceil(text.length/upload.chunkSize);index++)await request('/data/upload/chunk','PUT',{blob:upload.blob,index,text:text.slice(index*upload.chunkSize,(index+1)*upload.chunkSize)},token);
await request('/data/commit','POST',{blob:upload.blob},token);
const manifest=await request('/data/manifest','GET',undefined,login.token);assert.equal(manifest.revision,1);
let downloaded='';for(let index=0;index<manifest.document.chunks;index++)downloaded+=(await request('/data/chunk','POST',{blob:manifest.document.blob,index},login.token)).text;
assert.deepEqual(await unseal(vault.key,JSON.parse(downloaded),accountId+':data:v1'),original);
console.log('PASS encrypted backup restored in second session');
let result;do{result=await request('/account','DELETE',{password},token);}while(result.pending);
console.log('PASS disposable test account and encrypted copy removed');
