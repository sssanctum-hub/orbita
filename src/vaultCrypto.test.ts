import {describe,it,expect} from "vitest";
import {createVault,unlockVault,recoverVault,seal,unseal} from "./vaultCrypto";
describe("encrypted vault",()=>{
 it("opens the same encrypted photo using password or recovery code",async()=>{
 const vault=await createVault("long test password","account-a");
 const photo=new Uint8Array([255,216,255,0,42]);
 const encrypted=await seal(vault.key,photo,"account-a:photo:1");
 expect(encrypted.ciphertext).not.toContain("password");
 const password=await unlockVault("long test password",vault.salt,vault.wrappedKey,"account-a");
 const recovery=await recoverVault(vault.recoveryCode,vault.recoveryKey,"account-a");
 expect(await unseal(password,encrypted,"account-a:photo:1")).toEqual(photo);
 expect(await unseal(recovery,encrypted,"account-a:photo:1")).toEqual(photo);
 await expect(unseal(password,encrypted,"account-b:photo:1")).rejects.toThrow();
 await expect(unlockVault("wrong password",vault.salt,vault.wrappedKey,"account-a")).rejects.toThrow();
 const tampered={...encrypted,ciphertext:encrypted.ciphertext.slice(0,-4)+"AAAA"};
 await expect(unseal(password,tampered,"account-a:photo:1")).rejects.toThrow();
 const again=await seal(vault.key,photo,"account-a:photo:1");
 expect(again.iv).not.toBe(encrypted.iv);
 });
});
