import fs from 'node:fs/promises';
import path from 'node:path';import {randomBytes,createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const tools=path.join(root,'.tools','android');
const {javaHome,androidHome}=JSON.parse(await fs.readFile(path.join(tools,'paths.json'),'utf8'));
const buildTools=path.join(androidHome,'build-tools','37.0.0');
async function find(dir){let list=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())list.push(...await find(file));else if(file.endsWith('.apk')&&!file.includes('debug'))list.push(file);}return list;}
const candidates=await find(path.join(root,'src-tauri','gen','android','app','build','outputs','apk'));
const source=candidates.find(file=>file.includes('arm64')&&file.includes('unsigned'))||candidates.find(file=>file.includes('unsigned'))||candidates[0];
if(!source)throw Error('No release APK was built');
function run(command,args){const result=spawnSync(command,args,{encoding:'utf8',windowsHide:true});if(result.error)throw result.error;if(result.status!==0)throw Error(result.stdout+'\n'+result.stderr);return result.stdout+result.stderr;}
const signing=path.join(tools,'signing');await fs.mkdir(signing,{recursive:true});
const store=path.join(signing,'orbita-release.p12'),password=path.join(signing,'store-password.txt');
try{await fs.access(store);}catch{
 try{await fs.access(password);}catch{await fs.writeFile(password,randomBytes(36).toString('base64url'),{flag:'wx'});}
 run(path.join(javaHome,'bin','keytool.exe'),['-genkeypair','-keystore',store,'-storetype','PKCS12','-storepass:file',password,'-alias','orbita','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Orbita Personal App','-noprompt']);
}
const output=path.join(root,'outputs','releases');await fs.mkdir(output,{recursive:true});
const aligned=path.join(tools,'orbita-aligned.apk');
const {version}=JSON.parse(await fs.readFile(path.join(root,'src-tauri','tauri.conf.json'),'utf8'));
const sourceManifest=run(path.join(buildTools,'aapt2.exe'),['dump','badging',source]);
if(!sourceManifest.includes("versionName='"+version+"'"))throw Error('APK version does not match project version');
const apk=path.join(output,'orbita-'+version+'-arm64.apk');
try {await fs.access(apk);throw Error('This release already exists. Increment the version before publishing another update.');} catch(e) {if(e.code!=='ENOENT')throw e;}
run(path.join(buildTools,'zipalign.exe'),['-P','16','-f','4',source,aligned]);
run(path.join(javaHome,'bin','java.exe'),['-jar',path.join(buildTools,'lib','apksigner.jar'),'sign','--ks',store,'--ks-key-alias','orbita','--ks-pass','file:'+password,'--out',apk,aligned]);
const signature=run(path.join(javaHome,'bin','java.exe'),['-jar',path.join(buildTools,'lib','apksigner.jar'),'verify','--verbose','--print-certs',apk]);
run(path.join(buildTools,'zipalign.exe'),['-c','-P','16','4',apk]);
const manifest=run(path.join(buildTools,'aapt2.exe'),['dump','badging',apk]);
await fs.writeFile(path.join(output,'APK-VERIFICATION.txt'),signature+'\n'+manifest);
await fs.writeFile(apk+'.verification.txt',signature+'\n'+manifest);
const hash=createHash('sha256').update(await fs.readFile(apk)).digest('hex');
await fs.writeFile(apk+'.sha256',hash+'  '+path.basename(apk)+'\n');
console.log('APK:',apk);console.log('Size:',(await fs.stat(apk)).size);console.log('SHA-256:',hash);
console.log(manifest.split('\n').filter(line=>line.startsWith('package:')||line.startsWith('native-code:')||line.startsWith('sdkVersion:')||line.startsWith('targetSdkVersion:')).join('\n'));
console.log('APK signature and 16 KB ZIP alignment verified.');
