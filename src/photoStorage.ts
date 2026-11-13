function open(): Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{const r=indexedDB.open("orbita-photos",1);r.onupgradeneeded=()=>r.result.createObjectStore("photos");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error("Не удалось открыть хранилище фотографий."));});
}
export async function localPhoto(id:string,value?:Blob):Promise<Blob|undefined>{
 const db=await open();
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction("photos",value?"readwrite":"readonly"),store=tx.objectStore("photos"),request=value?store.put(value,id):store.get(id);tx.oncomplete=()=>resolve(value||request.result);tx.onabort=()=>reject(Error("Не удалось сохранить или прочитать фотографию."));tx.onerror=()=>reject(Error("Хранилище фотографий недоступно."));});}finally{db.close();}
}
