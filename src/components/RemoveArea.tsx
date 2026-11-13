import AppSelect from "./AppSelect";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { areaLabel, type Data, availableAreas } from "../domain";
type Props = {
  data: Data;
  area: string;
  busy: boolean;
  error: string;
  close: () => void;
  remove: (destination: string) => void;
};
export default function RemoveArea({
  data,
  area,
  busy,
  error,
  close,
  remove,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [destination, setDestination] = useState("");
  const count = data.tasks.filter((t) => t.area === area).length;
  const projects = data.projects.filter((p) => p.area === area).length;
  const hasContent = count > 0 || projects > 0;
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="area-editor"
      aria-labelledby="remove-area-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          remove(destination);
        }}
      >
        <header>
          <button
            type="button"
            aria-label="Оставить сферу"
            disabled={busy}
            onClick={close}
          >
            <ArrowLeft size={22} />
          </button>
          <h2 id="remove-area-title">Удалить сферу?</h2>
          <Trash2 size={23} />
        </header>
        <p className="remove-area-name">{areaLabel(area)}</p>
        {hasContent ? (
          <>
            <p>
              Внутри дел: {count}, проектов: {projects}. Выберите, куда их
              перенести.
            </p>
            <label>
              Перенести в сферу
              <AppSelect
                required
                value={destination}
                disabled={busy}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Выбрать сферу</option>
                {availableAreas(data)
                  .filter((a) => a !== area)
                  .map((a) => (
                    <option key={a} value={a}>
                      {areaLabel(a)}
                    </option>
                  ))}
              </AppSelect>
            </label>
          </>
        ) : (
          <p>Сфера пустая. Она исчезнет с орбиты.</p>
        )}
        {error && <p role="alert">{error.replace(/^Error:\s*/, "")}</p>}
        <button
          type="submit"
          className="task-save"
          disabled={busy || (hasContent && !destination)}
        >
          {hasContent ? "Перенести и удалить сферу" : "Удалить пустую сферу"}
        </button>
      </form>
    </dialog>
  );
}
