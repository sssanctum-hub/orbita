import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {assertCurrentNative} from './android-artifacts.mjs';
const root=path.resolve(import.meta.dirname,'..');
const tools=path.join(root,'.tools','android');
const paths=JSON.parse(await fs.readFile(path.join(tools,'paths.json'),'utf8'));
const env={...process.env,JAVA_HOME:paths.javaHome,ANDROID_HOME:paths.androidHome,ANDROID_SDK_ROOT:paths.androidHome,
 PATH:[path.join(paths.javaHome,'bin'),path.join(root,'.tools','node'),path.join(process.env.USERPROFILE,'.cargo','bin'),process.env.PATH].join(';')};
try{env.NDK_HOME=path.join(paths.androidHome,'ndk',(await fs.readdir(path.join(paths.androidHome,'ndk'))).sort().at(-1));}catch{}
const host='1.99.0-x86_64-pc-windows-gnu';
const hostBin=path.join(process.env.USERPROFILE,'.rustup','toolchains',host,'lib','rustlib','x86_64-pc-windows-gnu','bin','self-contained');
env.RUSTUP_TOOLCHAIN=host;
env.ORBIT_HOST_LINKER=path.join(tools,"ld.lld.exe");
env.CARGO_TARGET_DIR=path.join(root,".tools","android","target-lld");
env.RUSTC_WRAPPER=path.join(tools,'rustc-wrapper-lld.exe');
env.CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=path.join(hostBin,'x86_64-w64-mingw32-gcc.exe');
env.PATH=hostBin+';'+env.PATH;
const mode=process.argv[2];
let command,args,answers=false;let cwd=root;
if(mode==='init'){command=process.execPath;args=['node_modules/@tauri-apps/cli/tauri.js','android','init','--ci','--skip-targets-install'];}
else if(mode==='sdk-list'){command='cmd.exe';args=['/d','/c',path.join(paths.androidHome,'cmdline-tools','latest','bin','sdkmanager.bat'),'--sdk_root='+paths.androidHome,'--list'];}
else if(mode==='sdk-install'){command=path.join(paths.androidHome,'cmdline-tools','latest','bin','android.exe');args=['--no-metrics','--sdk='+paths.androidHome,'sdk','install',...process.argv.slice(3)];answers=true;}
else if(mode==='package'||mode==='package-aab'){
 const library=path.join(env.CARGO_TARGET_DIR,'aarch64-linux-android','release','libpersonal_assistant_lib.so');
 await assertCurrentNative(root,library);
 const destination=path.join(root,'src-tauri','gen','android','app','src','main','jniLibs','arm64-v8a');
 await fs.mkdir(destination,{recursive:true});
 await fs.copyFile(library,path.join(destination,'libpersonal_assistant_lib.so'));
 cwd=path.join(root,'src-tauri','gen','android');
 command='cmd.exe';args=['/d','/c','gradlew.bat',mode==='package-aab'?':app:bundleArm64Release':':app:assembleArm64Release','-x',':app:rustBuildArm64Release','-PabiList=arm64-v8a','-ParchList=arm64','-PtargetList=aarch64','--console=plain','--no-daemon'];
}
else if(mode==='widget-test'){
 cwd=path.join(root,'src-tauri','gen','android');
 command='cmd.exe';args=['/d','/c','gradlew.bat',':app:testArm64DebugUnitTest','-x',':app:rustBuildArm64Debug','-PabiList=arm64-v8a','-ParchList=arm64','-PtargetList=aarch64','--console=plain','--no-daemon'];
}
else if(mode==='test'){
 command=process.execPath;args=['scripts/test-rust-storage.mjs'];
}
else if(mode==='build'){
 env.NDK_HOME=path.join(paths.androidHome,'ndk',(await fs.readdir(path.join(paths.androidHome,'ndk'))).sort().at(-1));
 command=process.execPath;args=['node_modules/@tauri-apps/cli/tauri.js','android','build','--apk','--target','aarch64',...process.argv.slice(3)];
}
else throw Error('Unknown Android tool action');
const child=spawn(command,args,{cwd,env,windowsHide:true,stdio:[answers?'pipe':'inherit','inherit','inherit']});
if(answers)child.stdin.end('y\n'.repeat(40));
child.on('error',e=>{console.error(e.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code||0;});
