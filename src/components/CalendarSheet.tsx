import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Task } from "../domain";
import Calendar from "./Calendar";
type Props = {
  tasks: Task[];
  ready: boolean;
  canCreate?: boolean;
  demo: boolean;
  native: boolean;
  close: () => void;
  select: (task: Task) => void;
  create: (date: string, time?: string) => void;
  enableDemo: () => void;
};
export default function CalendarSheet({
  tasks,
  ready,
  canCreate = true,
  demo,
  native,
  close,
  select,
  create,
  enableDemo,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="calendar-sheet"
      aria-label="Календарь"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <button
        className="planner-close"
        aria-label="Закрыть календарь"
        onClick={close}
      >
        <X size={22} />
      </button>
      <Calendar
        tasks={tasks}
        select={select}
        create={create}
        ready={ready && canCreate}
      />
      {ready && !canCreate && (
        <p className="planner-notice">
          Добавьте сферу жизни через «+» на орбите, чтобы создавать дела.
        </p>
      )}
      {!ready && (
        <div className="planner-notice">
          {native ? (
            "Загрузка данных…"
          ) : (
            <>
              <p>
                В браузере доступны примеры без сохранения после обновления
                страницы.
              </p>
              <button onClick={enableDemo}>Посмотреть демо</button>
            </>
          )}
        </div>
      )}
      {demo && (
        <p className="planner-demo">
          Демо · изменения хранятся только до обновления страницы
        </p>
      )}
    </dialog>
  );
}
