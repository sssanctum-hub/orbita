import { useExitMotion } from "../useExitMotion";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ImagePlus, Link2, Plus, X, ExternalLink } from "lucide-react";
import type { Task } from "../domain";
import {
  discardImage,
  imageUrl,
  importImage,
  linksInText,
  MAX_IMAGES,
  normalizeLink,
  openLink,
} from "../attachments";

type Props = {
  task: Task;
  disabled: boolean;
  change: (patch: Partial<Task>) => void;
  busyChange: (busy: boolean) => void;
};
export default function AttachmentsEditor({
  task,
  disabled,
  change,
  busyChange,
}: Props) {
  const [adding, setAdding] = useState(false),
    [error, setError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState(""),
    [label, setLabel] = useState("");
  const [selected, setSelected] = useState<string | null>(null),
    [full, setFull] = useState("");
  const input = useRef<HTMLInputElement>(null),
    viewer = useRef<HTMLDialogElement>(null);
  const dismissViewer = useExitMotion(viewer);
  const closeViewer = () => dismissViewer(() => setSelected(null));
  const created = useRef<string[]>([]);
  const images = task.images || [],
    links = task.links || [];
  useEffect(
    () => () => {
      for (const id of created.current) void discardImage(id).catch(() => {});
    },
    [],
  );
  useEffect(() => {
    let active = true,
      objectUrl = "";
    setFull("");
    if (selected) {
      viewer.current?.showModal();
      void imageUrl(selected)
        .then((url) => {
          objectUrl = url;
          if (active) setFull(url);
          else URL.revokeObjectURL(url);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    } else viewer.current?.close();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected]);
  async function add(files: FileList | null) {
    if (!files?.length || disabled || adding) return;
    if (files.length + images.length > MAX_IMAGES) {
      setError("Можно прикрепить до 10 изображений.");
      return;
    }
    setAdding(true);
    busyChange(true);
    setError("");
    const next = [...images];
    try {
      const failures: string[] = [];
      for (const file of Array.from(files)) {
        try {
          const image = await importImage(file);
          created.current.push(image.id);
          next.push(image);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(files.length > 1 ? file.name + " — " + message : message);
        }
      }
      if (next.length > images.length) change({ images: next });
      if (failures.length) setError(failures.join(" "));
    } finally {
      setAdding(false);
      busyChange(false);
      if (input.current) input.current.value = "";
    }
  }
  function addLink() {
    try {
      if (links.length >= 30) throw Error("Можно прикрепить до 30 ссылок.");
      const value = normalizeLink(url);
      if (links.some((l) => l.url === value))
        throw Error("Эта ссылка уже прикреплена.");
      change({
        links: [
          ...links,
          {
            id: crypto.randomUUID(),
            label: label.trim().slice(0, 200),
            url: value,
          },
        ],
      });
      setLinkOpen(false);
      setUrl("");
      setLabel("");
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  const noteLinks = linksInText(task.notes).filter(
    (url) => !links.some((l) => l.url === url),
  );
  return (
    <section className="attachments-editor" aria-label="Изображения и ссылки">
      {!!images.length && <header>
        <h3>Наклейки</h3>
        <span>{images.length} / 10</span>
      </header>}
      <div className="sticker-grid">
        {images.map((image, i) => (
          <div
            className="sticker-slot"
            key={image.id}
            style={
              { "--sticker-angle": (i % 2 ? 3 : -3) + "deg" } as CSSProperties
            }
          >
            <button
              type="button"
              className="image-sticker"
              aria-label={"Открыть изображение: " + image.name}
              onClick={() => setSelected(image.id)}
            >
              <img
                src={image.thumbnail}
                width={image.width}
                height={image.height}
                loading="lazy"
                decoding="async"
                alt={image.name}
              />
            </button>
            <button
              type="button"
              className="sticker-remove"
              aria-label={"Убрать изображение: " + image.name}
              disabled={disabled || adding}
              onClick={() =>
                change({ images: images.filter((i) => i.id !== image.id) })
              }
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        aria-label="Выбрать изображения"
        disabled={disabled || adding || images.length >= 10}
        onChange={(e) => void add(e.target.files)}
      />
      <button
        type="button"
        className="attachment-add"
        disabled={disabled || adding || images.length >= 10}
        onClick={() => input.current?.click()}
      >
        <ImagePlus size={20} />
        {adding ? "Готовим наклейки…" : "Прикрепить изображения"}
      </button>
      {!!(links.length || noteLinks.length) && <h3 className="links-heading">
        <Link2 size={18} /> Ссылки
      </h3>}
      <div className="attached-links">
        {[
          ...links,
          ...noteLinks.map((url, i) => ({ id: "note-" + i, label: "", url })),
        ].map((link) => (
          <div className="attached-link" key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                void openLink(link.url).catch((e) => setError(String(e)));
              }}
            >
              <ExternalLink size={16} />
              <span>{link.label || link.url}</span>
            </a>
            {!link.id.startsWith("note-") && (
              <button
                type="button"
                disabled={disabled}
                aria-label={"Убрать ссылку: " + (link.label || link.url)}
                onClick={() =>
                  change({ links: links.filter((l) => l.id !== link.id) })
                }
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" className="attachment-add attachment-link-toggle" disabled={disabled} aria-expanded={linkOpen} onClick={() => setLinkOpen(!linkOpen)}>
        <Plus size={20} /> Прикрепить ссылку
      </button>
      <div className="link-fields" hidden={!linkOpen}>
        <input
          type="text"
          inputMode="url"
          aria-label="Адрес ссылки"
          placeholder="https://…"
          value={url}
          disabled={disabled}
          onChange={(e) => setUrl(e.target.value)}
        />
        <input
          aria-label="Подпись ссылки"
          placeholder="Название ссылки (необязательно)"
          value={label}
          maxLength={200}
          disabled={disabled}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          type="button"
          className="attachment-add attachment-link-save"
          disabled={disabled || !url.trim()}
          onClick={addLink}
        >
          <Plus size={18} />
          Сохранить
        </button>
      </div>
      {error && (
        <p className="attachment-error" role="alert">
          {error.replace(/^Error:\s*/, "")}
        </p>
      )}
      <dialog
        ref={viewer}
        className="sticker-viewer"
        aria-label="Просмотр изображения"
        onCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          closeViewer();
        }}
        onClose={() => setSelected(null)}
      >
        <button
          type="button"
          className="viewer-close"
          aria-label="Закрыть изображение"
          onClick={closeViewer}
        >
          <X size={22} />
        </button>
        {full ? (
          <img
            src={full}
            alt={
              images.find((i) => i.id === selected)?.name ||
              "Прикреплённое изображение"
            }
          />
        ) : (
          <p>Загружаем изображение…</p>
        )}
      </dialog>
    </section>
  );
}
