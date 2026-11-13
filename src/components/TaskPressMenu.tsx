import { useExitMotion } from "../useExitMotion";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { isEvent, isFact, type Task } from "../domain";

type Selection = { id: string; date?: string };
type Props = {
  children: ReactNode;
  tasks: Task[];
  busy: boolean;
  error: string;
  act: (task: Task, date: string | undefined, remove: boolean) => Promise<void>;
};
export default function TaskPressMenu({
  children,
  tasks,
  busy,
  error,
  act,
}: Props) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useExitMotion(dialog);
  const closeMenu = () => dismiss(() => setSelected(null));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const suppress = useRef(0);
  const task = tasks.find((t) => t.id === selected?.id);
  const done =
    !!task &&
    (task.status === "done" ||
      !!(
        selected?.date &&
        task.repeat &&
        task.repeatCompleted?.includes(selected.date)
      ));
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  useEffect(() => () => cancel(), []);
  useEffect(() => {
    if (selected && task) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected, task?.id]);
  const target = (node: EventTarget | null) =>
    node instanceof Element && !node.closest("[data-task-control]")
      ? node.closest<HTMLElement>('[data-task-id]:not([data-day-drag="true"])')
      : null;
  const open = (node: HTMLElement) => {
    cancel();
    suppress.current = Date.now() + 1200;
    setSelected({
      id: node.dataset.taskId!,
      date: node.dataset.taskDate || undefined,
    });
  };
  function down(e: PointerEvent) {
    cancel();
    if (!e.isPrimary || e.button !== 0 || busy) return;
    const node = target(e.target);
    if (!node) return;
    const item=tasks.find(t=>t.id===node.dataset.taskId);
    if(!item || isEvent(item) || isFact(item)) return;
    start.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => open(node), 550);
  }
  async function run(remove: boolean) {
    if (!task || busy) return;
    try {
      await act(
        { ...task, status: done ? "done" : "todo" },
        selected?.date,
        remove,
      );
      closeMenu();
    } catch {
      /* The app supplies the error to the open menu. */
    }
  }
  return (
    <div
      className="task-press-host"
      onPointerDownCapture={down}
      onPointerMoveCapture={(e) => {
        if (
          start.current &&
          Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) >
            10
        )
          cancel();
      }}
      onPointerUpCapture={cancel}
      onPointerCancelCapture={cancel}
      onScrollCapture={cancel}
      onClickCapture={(e) => {
        if (Date.now() < suppress.current && target(e.target)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onContextMenuCapture={(e) => {
        const node = target(e.target);
        if (node && tasks.some(t=>t.id===node.dataset.taskId && !isEvent(t) && !isFact(t))) {
          e.preventDefault();
          e.stopPropagation();
          open(node);
        }
      }}
    >
      {children}
      <dialog
        className="task-quick-menu"
        ref={dialog}
        aria-label="Действия с делом"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) closeMenu();
        }}
        onClose={() => setSelected(null)}
      >
        <header>
          <h2>{task?.title}</h2>
          <button
            aria-label="Закрыть действия"
            disabled={busy}
            onClick={closeMenu}
          >
            <X size={20} />
          </button>
        </header>
        <div className="task-quick-buttons">
          {task && !isFact(task) && !isEvent(task) && <button className="quick-complete" disabled={busy} onClick={()=>void run(false)}>
            {done ? <RotateCcw size={22}/> : <Check size={22}/>}
            <span>{done ? "Вернуть в дела" : "Дело сделано"}</span>
          </button>}
        </div>
        {error && <p role="alert">{error}</p>}
      </dialog>
    </div>
  );
}
