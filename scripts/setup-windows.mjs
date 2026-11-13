import { mkdir, writeFile, readFile, rename, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, '.tools');
await mkdir(dir, { recursive: true });
async function exists(p) { try { await access(p); return true; } catch { return false; } }
async function fetchOk(url) { const r = await fetch(url); if (!r.ok) throw Error(`${r.status}: ${url}`); return r; }
async function download(url, name) { console.log('Downloading', url); const bytes = Buffer.from(await (await fetchOk(url)).arrayBuffer()); await writeFile(path.join(dir, name), bytes); return bytes; }
function run(exe, args) { return new Promise((resolve,reject)=> { const child=spawn(exe,args,{stdio:'inherit',windowsHide:true}); child.on('error',reject); child.on('exit',code=> code===0 || code===3010 ? resolve(code) : reject(Error(`${path.basename(exe)} exit ${code}`))); }); }
const nodeDir=path.join(dir,'node');
if (!await exists(path.join(nodeDir,'node.exe'))) {
 const releases=await (await fetchOk('https://nodejs.org/dist/index.json')).json();
 const release=releases.find(r=>r.lts && r.version.startsWith('v24.'));
 if(!release) throw Error('Node 24 LTS not found');
 const name=`node-${release.version}-win-x64`;
 const bytes=await download(`https://nodejs.org/dist/${release.version}/${name}.zip`,`${name}.zip`);
 const sums=await (await fetchOk(`https://nodejs.org/dist/${release.version}/SHASUMS256.txt`)).text();
 const expected=sums.split('\n').find(l=>l.trim().endsWith(`${name}.zip`))?.split(/\s+/)[0];
 if(createHash('sha256').update(bytes).digest('hex')!==expected) throw Error('Node checksum mismatch');
 await run('tar.exe',['-xf',path.join(dir,`${name}.zip`),'-C',dir]);
 await rename(path.join(dir,name),nodeDir);
}
await run(path.join(nodeDir,'node.exe'),['--version']);
if(!process.argv.includes('--skip-cpp') && !await exists('C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe')) {
 await download('https://aka.ms/vs/17/release/vs_BuildTools.exe','vs_BuildTools.exe');
 console.log('Starting Microsoft Build Tools installer. UAC consent may be requested. No restart.');
 await run(path.join(dir,'vs_BuildTools.exe'),['--passive','--wait','--norestart','--add','Microsoft.VisualStudio.Workload.VCTools','--includeRecommended']);
}
const cargo=path.join(homedir(),'.cargo/bin/cargo.exe');
if(!await exists(cargo)) {
 const url='https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe';
 const bytes=await download(url,'rustup-init.exe');
 const hash=(await (await fetchOk(`${url}.sha256`)).text()).trim().split(/\s+/)[0];
 if(createHash('sha256').update(bytes).digest('hex')!==hash) throw Error('Rustup checksum mismatch');
 await run(path.join(dir,'rustup-init.exe'),['-y','--profile','minimal','--default-toolchain','stable','--default-host','x86_64-pc-windows-msvc','--no-modify-path']);
}
await run(cargo,['--version']);
console.log('Setup completed.');
