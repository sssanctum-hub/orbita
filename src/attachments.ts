import { invoke } from "@tauri-apps/api/core";
import { desktop } from "./api";
import type { TaskImage } from "./domain";
import { localPhoto } from "./photoStorage";
const demoImages = new Map<string, Blob>();
export const MAX_IMAGES = 10;
export function normalizeLink(value: string): string {
  const text = value.trim();
  const url = new URL(
    /^[a-z][a-z\d+.-]*:/i.test(text) ? text : "https://" + text,
  );
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.href.length > 2048
  )
    throw Error("Укажите ссылку http или https.");
  return url.href;
}
export function linksInText(text: string): string[] {
  return [
    ...new Set(
      (text.match(/https?:\/\/[^\s<>]+/gi) || [])
        .map((s) => s.replace(/[.,;!?)}\]]+$/, ""))
        .flatMap((s) => {
          try {
            return [normalizeLink(s)];
          } catch {
            return [];
          }
        }),
    ),
  ].slice(0, 30);
}
const jpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(Error("Не удалось подготовить изображение.")),
      "image/jpeg",
      quality,
    ),
  );
async function decodeImage(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
  } catch {
    // Some formats can render in an image element even when bitmap decoding fails.
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw Error();
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, dispose: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw Error("Не удалось открыть фото. Попробуйте выбрать его копию в JPEG или PNG.");
    }
  }
}
export async function importImage(file: File): Promise<TaskImage> {
  if (file.size > 25 * 1024 * 1024)
    throw Error("Выберите изображение размером до 25 МБ.");
  const bitmap = await decodeImage(file);
  const canvas = document.createElement("canvas");
  try {
    const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap.source, 0, 0, canvas.width, canvas.height);
    let blob = await jpeg(canvas, 0.82);
    if (blob.size > 900000) blob = await jpeg(canvas, 0.62);
    if (blob.size > 1000000)
      throw Error("Изображение слишком сложное. Выберите другое.");
    const thumb = document.createElement("canvas");
    const scale = Math.min(1, 192 / Math.max(canvas.width, canvas.height));
    thumb.width = Math.max(1, Math.round(canvas.width * scale));
    thumb.height = Math.max(1, Math.round(canvas.height * scale));
    thumb.getContext("2d")!.drawImage(canvas, 0, 0, thumb.width, thumb.height);
    const thumbnail = thumb.toDataURL("image/jpeg", 0.72);
    thumb.width = thumb.height = 0;
    const id = desktop
      ? await invoke<string>("save_image", {
          bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
        })
      : crypto.randomUUID();
    if (!desktop) { await localPhoto(id,blob); demoImages.set(id, blob); }
    return {
      id,
      name: file.name.slice(0, 200),
      thumbnail,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    bitmap.dispose();
    canvas.width = canvas.height = 0;
  }
}
export async function imageUrl(id: string): Promise<string> {
  const blob = desktop
    ? new Blob([new Uint8Array(await invoke<number[]>("read_image", { id }))], {
        type: "image/jpeg",
      })
    : demoImages.get(id) || await localPhoto(id);
  if (!blob) throw Error("Изображение недоступно.");
  return URL.createObjectURL(blob);
}
export async function discardImage(id: string) {
  if (desktop) await invoke("discard_image", { id });
}
export async function readPhoto(id:string):Promise<Uint8Array>{
 if(desktop)return new Uint8Array(await invoke<number[]>("read_image",{id}));
 const blob=demoImages.get(id)||await localPhoto(id);
 if(!blob)throw Error("Оригинал фотографии недоступен. Копия не создана.");
 return new Uint8Array(await blob.arrayBuffer());
}
export async function restorePhoto(bytes:Uint8Array):Promise<string>{
 if(desktop)return invoke<string>("save_image",{bytes:Array.from(bytes)});
 const id=crypto.randomUUID();await localPhoto(id,new Blob([new Uint8Array(bytes)],{type:"image/jpeg"}));return id;
}
export async function openLink(url: string) {
  const normalized = normalizeLink(url);
  if (desktop) await invoke("open_link", { url: normalized });
  else window.open(normalized, "_blank", "noopener,noreferrer");
}
