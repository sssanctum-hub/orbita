import { emptyData, type Data } from "./domain";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("orbita", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("data");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error("Не удалось открыть хранилище браузера."));
  });
}
export async function loadWebData(): Promise<Data> {
  const db = await database();
  try {
    return await new Promise<Data>((resolve, reject) => {
      const tx = db.transaction("data", "readonly");
      const request = tx.objectStore("data").get("main");
      tx.oncomplete = () => resolve(request.result ?? emptyData());
      tx.onabort = () => reject(Error("Не удалось прочитать данные."));
    });
  } finally { db.close(); }
}
export async function storeWebData(data: Data): Promise<Data> {
  const db = await database();
  try {
    return await new Promise<Data>((resolve, reject) => {
      const tx = db.transaction("data", "readwrite");
      const store = tx.objectStore("data");
      const request = store.get("main");
      let saved: Data;
      request.onsuccess = () => {
        const previous = request.result as Data | undefined;
        if (previous && previous.revision !== data.revision) { tx.abort(); return; }
        saved = { ...data, revision: data.revision + 1 };
        store.put(saved, "main");
      };
      tx.oncomplete = () => resolve(saved);
      tx.onabort = () => reject(Error("Не удалось сохранить данные. Проверьте свободное место или перезагрузите приложение, если оно открыто в другом окне."));
    });
  } finally { db.close(); }
}
