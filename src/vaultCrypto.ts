// Versioned encryption primitives; no key or plaintext is sent to the server.
export type Ciphertext = { version: 1; iv: string; ciphertext: string };
const encoder = new TextEncoder();
export const encode = (bytes: Uint8Array) => { let text=""; for(const byte of bytes) text+=String.fromCharCode(byte); return btoa(text); };
export const decode = (text: string) => Uint8Array.from(atob(text), c=>c.charCodeAt(0));
export const randomSecret = () => encode(crypto.getRandomValues(new Uint8Array(32)));
export async function importVaultKey(secret: string) {
 const bytes=decode(secret); if(bytes.length!==32)throw Error("Некорректный ключ.");
 return crypto.subtle.importKey("raw",bytes,"AES-GCM",false,["encrypt","decrypt"]);
}
export async function seal(key: CryptoKey, bytes: Uint8Array, context: string): Promise<Ciphertext> {
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:encoder.encode(context)},key,new Uint8Array(bytes));
 return {version:1,iv:encode(iv),ciphertext:encode(new Uint8Array(ciphertext))};
}
export async function unseal(key: CryptoKey, value: Ciphertext, context: string): Promise<Uint8Array> {
 if(value.version!==1||decode(value.iv).length!==12)throw Error("Неизвестный формат шифрования.");
 return new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(value.iv),additionalData:encoder.encode(context)},key,decode(value.ciphertext)));
}
export async function passwordKey(password: string, salt: string) {
 const bytes=decode(salt); if(bytes.length!==32)throw Error("Некорректная соль.");
 const material=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveKey"]);
 return crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",iterations:600000,salt:bytes},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
export async function createVault(password: string, accountId: string) {
 const secret=randomSecret(),salt=randomSecret(),recoveryCode=randomSecret();
 const wrappedKey=await seal(await passwordKey(password,salt),decode(secret),accountId+":password-key:v1");
 const recoveryKey=await seal(await importVaultKey(recoveryCode),decode(secret),accountId+":recovery-key:v1");
 return {key:await importVaultKey(secret),salt,wrappedKey,recoveryKey,recoveryCode};
}
export async function unlockVault(password:string,salt:string,wrappedKey:Ciphertext,accountId:string) {
 return importVaultKey(encode(await unseal(await passwordKey(password,salt),wrappedKey,accountId+":password-key:v1")));
}
export async function recoverVault(code:string,wrappedKey:Ciphertext,accountId:string) {
 return importVaultKey(encode(await unseal(await importVaultKey(code),wrappedKey,accountId+":recovery-key:v1")));
}

export type VaultMetadata = { accountId: string; salt: string; wrappedKey: Ciphertext; recoveryKey: Ciphertext };
// The server receives only a domain-separated verifier; the code itself stays on the device.
export async function recoveryProof(code: string) {
 const normalized=encode(decode(code.trim()));
 if(decode(normalized).length!==32)throw Error("Проверьте код восстановления.");
 return [...new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode("orbita-recovery-v1:"+normalized)))].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function wrapSecret(secret: Uint8Array, password: string, accountId: string) {
 if(secret.length!==32)throw Error("Некорректный ключ.");
 const salt=randomSecret(), recoveryCode=randomSecret();
 const wrappedKey=await seal(await passwordKey(password,salt),secret,accountId+":password-key:v1");
 const recoveryKey=await seal(await importVaultKey(recoveryCode),secret,accountId+":recovery-key:v1");
 return {key:await importVaultKey(encode(secret)),vault:{accountId,salt,wrappedKey,recoveryKey},recoveryCode,recoveryProof:await recoveryProof(recoveryCode)};
}
export async function rotateWithRecovery(code: string, password: string, vault: VaultMetadata) {
 const secret=await unseal(await importVaultKey(code.trim()),vault.recoveryKey,vault.accountId+":recovery-key:v1");
 try{return await wrapSecret(secret,password,vault.accountId);}finally{secret.fill(0);}
}
export async function rotateWithPassword(password: string, vault: VaultMetadata) {
 const secret=await unseal(await passwordKey(password,vault.salt),vault.wrappedKey,vault.accountId+":password-key:v1");
 try{return await wrapSecret(secret,password,vault.accountId);}finally{secret.fill(0);}
}
