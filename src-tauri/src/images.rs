use std::{fs,io::Write,path::{Path,PathBuf}};
use crate::storage::Result;
fn path(dir:&Path,id:&str)->Result<PathBuf>{
 let id=uuid::Uuid::parse_str(id).map_err(|_|"Некорректное изображение.")?;
 Ok(dir.join(format!("{id}.jpg")))
}
pub fn save(dir:&Path,bytes:&[u8])->Result<String>{
 if bytes.len()>1_000_000 || bytes.len()<4 || !bytes.starts_with(&[0xff,0xd8,0xff]) {return Err("Изображение не удалось подготовить.".into());}
 fs::create_dir_all(dir).map_err(|e|e.to_string())?;
 let id=uuid::Uuid::new_v4().to_string();
 let mut file=fs::OpenOptions::new().write(true).create_new(true).open(path(dir,&id)?).map_err(|e|e.to_string())?;
 file.write_all(bytes).and_then(|_|file.sync_all()).map_err(|e|e.to_string())?;
 Ok(id)
}
pub fn read(dir:&Path,id:&str)->Result<Vec<u8>>{
 let p=path(dir,id)?;
 if fs::metadata(&p).map_err(|e|e.to_string())?.len()>1_000_000 {return Err("Изображение слишком большое.".into());}
 fs::read(p).map_err(|e|e.to_string())
}
pub fn remove(dir:&Path,id:&str){if let Ok(p)=path(dir,id){let _=fs::remove_file(p);}}
#[cfg(test)] mod tests {
 use super::*;
 #[test] fn images_round_trip_and_reject_paths(){
 let dir=tempfile::tempdir().unwrap();let bytes=[0xff,0xd8,0xff,0xd9];
 let id=save(dir.path(),&bytes).unwrap();assert_eq!(read(dir.path(),&id).unwrap(),bytes);
 assert!(read(dir.path(),"../secret").is_err());assert!(save(dir.path(),b"hello").is_err());remove(dir.path(),&id);assert!(read(dir.path(),&id).is_err());
 }
}
