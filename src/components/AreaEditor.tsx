import { useEffect, useRef, useState } from "react";
import { areaMiniatures } from "../areaAppearance";
import { ArrowLeft, Plus } from "lucide-react";
type Props = {
  edit?: { name: string; icon: string };
  busy: boolean;
  error: string;
  ready: boolean;
  native: boolean;
  close: () => void;
  save: (name: string, icon: string) => void;
  enableDemo: () => void;
};
export default function AreaEditor({
  edit,
  busy,
  error,
  ready,
  native,
  close,
  save,
  enableDemo,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(edit?.icon ?? "circle");
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="area-editor"
      aria-labelledby="new-area-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy && icon) save(name, icon);
        }}
      >
        <header>
          <button
            type="button"
            aria-label="Закрыть редактор сферы"
            disabled={busy}
            onClick={close}
          >
            <ArrowLeft size={22} />
          </button>
          <h2 id="new-area-title">{edit ? "Иконка сферы" : "Новая сфера"}</h2>
          {!edit && <Plus size={24} />}
        </header>
        {edit ? <p>{edit.name}</p> : <label>
          Название
          <input
            autoFocus
            required
            maxLength={40}
            placeholder="Например, Путешествия"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>}
        <fieldset className="miniature-picker">
          <legend>Иконка</legend>
          <div>
            {areaMiniatures.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={icon === item.id}
                disabled={busy}
                onClick={() => setIcon(item.id)}
              >
                <item.icon size={25} strokeWidth={1.6} />
              </button>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert">{error.replace(/^Error:\s*/, "")}</p>}
        {!ready && (
          <p>
            {native
              ? "Дождитесь загрузки данных."
              : "Сейчас доступно демо. Его изменения сбросятся после обновления страницы."}
          </p>
        )}
        {!ready && !native ? (
          <button className="task-save" type="button" onClick={enableDemo}>
            Посмотреть демо
          </button>
        ) : (
          <button className="task-save" disabled={busy || !ready || !icon} type="submit">
            {edit ? "Сохранить иконку" : "Добавить сферу"}
          </button>
        )}
      </form>
    </dialog>
  );
}
