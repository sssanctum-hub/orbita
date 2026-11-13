import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const target=path.join(root,'.tools','android');
await fs.mkdir(target,{recursive:true});
async function download(url,file,algorithm,expected){
 try {await fs.access(file);console.log('Already downloaded',path.basename(file));}catch{
  console.log('Download',url);
  const response=await fetch(url);if(!response.ok)throw Error(response.status+' '+url);
  await pipeline(Readable.fromWeb(response.body),createWriteStream(file+'.part'));
  await fs.rename(file+'.part',file);
 }
 if(expected){const digest=createHash(algorithm).update(await fs.readFile(file)).digest('hex');if(digest!==expected.toLowerCase())throw Error('Checksum mismatch '+file);}
}
function unpack(file,to){const r=spawnSync('tar.exe',['-xf',file,'-C',to],{stdio:'inherit',windowsHide:true});if(r.status!==0)throw Error('Unpack failed '+file);}
const locked=JSON.parse(await fs.readFile(path.join(root,'scripts','android-tools.lock.json'),'utf8'));
const jdkZip=path.join(target,'jdk17.zip');
await download(locked.jdk.url,jdkZip,'sha256',locked.jdk.sha256);
const dirs=await fs.readdir(target);
if(!dirs.some(name=>name.startsWith('jdk-')))unpack(jdkZip,target);
const cmdZip=path.join(target,'commandline-tools.zip');
await download(locked.commandline.url,cmdZip,'sha256',locked.commandline.sha256);
const sdk=path.join(target,'sdk');
await fs.mkdir(path.join(sdk,'cmdline-tools'),{recursive:true});
try{await fs.access(path.join(sdk,'cmdline-tools','latest','bin','sdkmanager.bat'));}
catch{unpack(cmdZip,target);await fs.cp(path.join(target,'cmdline-tools'),path.join(sdk,'cmdline-tools','latest'),{recursive:true});}
const jdkHome=path.join(target,(await fs.readdir(target)).find(name=>name.startsWith('jdk-')));
await fs.writeFile(path.join(target,'paths.json'),JSON.stringify({javaHome:jdkHome,androidHome:sdk},null,2));
console.log('Portable JDK and SDK command line tools ready.');
