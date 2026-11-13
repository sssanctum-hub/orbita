import path from 'node:path';import {spawnSync} from 'node:child_process';
const [compiler,...args]=process.argv.slice(2);
const root=path.resolve(import.meta.dirname,'..');
const ndk=process.env.NDK_HOME;
const targetIndex=args.indexOf('--target');
if(targetIndex<0 || args[targetIndex+1]==='x86_64-pc-windows-gnu'){
 args.push('-C','dlltool='+path.join(ndk,'toolchains','llvm','prebuilt','windows-x86_64','bin','llvm-dlltool.exe'));
}
if(targetIndex>=0 && args[targetIndex+1]==='aarch64-linux-android')args.push('-C','link-arg=-Wl,-z,max-page-size=16384');
const result=spawnSync(compiler,args,{stdio:'inherit',windowsHide:true});
if(result.error)console.error(result.error.message);process.exit(result.status??1);
