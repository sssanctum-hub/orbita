use std::{env,path::PathBuf,process::{Command,exit}};
fn main(){
 let mut args=env::args_os().skip(1);let compiler=args.next().expect("compiler");
 let mut args:Vec<_>=args.collect();
 let target=args.iter().position(|arg|arg=="--target").and_then(|i|args.get(i+1)).map(|s|s.to_string_lossy().into_owned());
 if target.as_deref().is_none_or(|t|t=="x86_64-pc-windows-gnu"){
  let tool=PathBuf::from(env::var_os("NDK_HOME").expect("NDK_HOME")).join("toolchains/llvm/prebuilt/windows-x86_64/bin/llvm-dlltool.exe");
  args.push("-C".into());args.push(format!("dlltool={}",tool.display()).into());
  let rust=PathBuf::from(env::var_os("ORBIT_HOST_LINKER").expect("ORBIT_HOST_LINKER"));
  args.push("-C".into());args.push(format!("linker={}",rust.display()).into());
  args.push("-C".into());args.push("linker-flavor=ld".into());
  args.push("-C".into());args.push("link-self-contained=yes".into());
 }
 if target.as_deref()==Some("aarch64-linux-android"){args.push("-C".into());args.push("link-arg=-Wl,-z,max-page-size=16384".into());}
 let status=Command::new(compiler).args(args).status().expect("rustc");exit(status.code().unwrap_or(1));
}
