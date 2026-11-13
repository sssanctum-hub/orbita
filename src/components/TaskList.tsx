import RollingNumber from "./RollingNumber";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  Reorder,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  animate,
} from "motion/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  forwardRef,
  type CSSProperties,
} from "react";
import { GripVertical, Trash2 } from "lucide-react";
import {
  areaLabel,
  eventTimeLabel,
  isEvent,
  isFact,
  type Task,
} from "../domain";
import { colorForArea, sphereIcon } from "../areaAppearance";
import { motionTokens } from "../motionTokens";
import { haptic } from "../haptics";
import { useTaskActions } from "../taskMotion";
import AnimatedCheck from "./AnimatedCheck";

type Props = {
  tasks: Task[];
  date?: string;
  select: (task: Task) => void;
  areaIcons: Record<string, string>;
  hideCompleted?: boolean;
};
export default function TaskList({
  tasks,
  date,
  select,
  areaIcons,
  hideCompleted = false,
}: Props) {
  const { reorder } = useTaskActions();
  const reduce = useReducedMotion();
  const [settledDone, setSettledDone] = useState(
    () =>
      new Set(
        tasks
          .filter((t) => !isEvent(t) && t.status === "done")
          .map((t) => t.id),
      ),
  );
  const doneKey = tasks
    .filter((t) => !isEvent(t) && t.status === "done")
    .map((t) => t.id)
    .join("|");
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setSettledDone(
          new Set(
            tasks
              .filter((t) => !isEvent(t) && t.status === "done")
              .map((t) => t.id),
          ),
        ),
      reduce ? 0 : motionTokens.completionMs,
    );
    return () => clearTimeout(timer);
  }, [doneKey, reduce]);
  const active = tasks.filter(
    (t) => isEvent(t) || t.status !== "done" || !settledDone.has(t.id),
  );
  const completed = hideCompleted
    ? []
    : tasks.filter(
        (t) => !isEvent(t) && t.status === "done" && settledDone.has(t.id),
      );
  const key = active.map((t) => t.id).join("|");
  const [order, setOrder] = useState(active.map((t) => t.id));
  const orderRef = useRef(order);
  orderRef.current = order;
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setOrder(active.map((t) => t.id));
  }, [key]);
  const activeMap = new Map(active.map((task) => [task.id, task]));
  const orderSet = new Set(order);
  const shown = [
    ...order.filter((id) => activeMap.has(id)),
    ...active.filter((task) => !orderSet.has(task.id)).map((task) => task.id),
  ];
  const id = useId();
  const finish = () => {
    dragging.current = false;
    const ids = orderRef.current;
    if (ids.join("|") !== key)
      void reorder(ids).catch(() => setOrder(active.map((t) => t.id)));
  };
  return (
    <LayoutGroup id={id}>
      <div className="motion-task-list">
        <Reorder.Group
          as="div"
          axis="y"
          values={shown}
          onReorder={setOrder}
          className="task-reorder-group"
          layoutScroll
        >
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((taskId, index) => {
              const task = activeMap.get(taskId)!;
              return (
                <TaskRow
                  key={taskId}
                  task={task}
                  date={date}
                  select={select}
                  areaIcons={areaIcons}
                  index={index}
                  listId={id}
                  onDragStart={() => {
                    dragging.current = true;
                    haptic("impact");
                  }}
                  onDragEnd={finish}
                  onMove={(delta) => {
                    const next = [...shown],
                      at = next.indexOf(taskId),
                      to = at + delta;
                    if (to < 0 || to >= next.length) return;
                    [next[at], next[to]] = [next[to]!, next[at]!];
                    setOrder(next);
                    void reorder(next);
                  }}
                />
              );
            })}
          </AnimatePresence>
        </Reorder.Group>
        <AnimatePresence initial={false}>
          {!!completed.length && (
            <motion.section
              key="completed"
              layout="position"
              className="completed-tasks"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h3>
                Выполнено{" "}
                <span>
                  <RollingNumber value={completed.length} />
                </span>
              </h3>
              <AnimatePresence initial={false} mode="popLayout">
                {completed.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    date={date}
                    select={select}
                    areaIcons={areaIcons}
                    index={index}
                    listId={id + "-done"}
                  />
                ))}
              </AnimatePresence>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
type TaskRowProps = {
  task: Task;
  date?: string;
  select: (task: Task) => void;
  areaIcons: Record<string, string>;
  index: number;
  listId: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onMove?: (delta: number) => void;
};
const TaskRow = forwardRef<HTMLDivElement, TaskRowProps>(function TaskRow(
  {
    task,
    date,
    select,
    areaIcons,
    index,
    onDragStart,
    onDragEnd,
    onMove,
    listId,
  },
  ref,
) {
  const { act, busy } = useTaskActions();
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const x = useMotionValue(0);
  const [revealed, setRevealed] = useState(false),
    [error, setError] = useState("");
  const swiping = useRef(false),
    suppress = useRef(0),
    deleteButton = useRef<HTMLButtonElement>(null);
  const Icon = sphereIcon(task.area, areaIcons);
  const done = !isEvent(task) && task.status === "done";
  const restore = () => {
    animate(x, 0, reduce ? motionTokens.reduced : motionTokens.spring);
    setRevealed(false);
  };
  useEffect(() => {
    if (!revealed) return;
    const back = (event: Event) => {
      const top = (event as CustomEvent<{ dialog: HTMLDialogElement | null }>)
        .detail?.dialog;
      if (top !== (deleteButton.current?.closest("dialog") || null)) return;
      event.preventDefault();
      restore();
    };
    window.addEventListener("orbita:overlay-back", back);
    return () => window.removeEventListener("orbita:overlay-back", back);
  }, [revealed]);
  async function remove() {
    if (busy) return;
    try {
      await act(task, date, true);
      haptic("impact");
    } catch (e) {
      setError(String(e));
      restore();
    }
  }
  const content = (
    <>
      <button
        ref={deleteButton}
        type="button"
        className="task-swipe-delete"
        data-task-control="true"
        tabIndex={revealed ? 0 : -1}
        aria-label={"Удалить: " + task.title}
        aria-hidden={!revealed}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void remove();
        }}
      >
        <Trash2 size={21} />
        <span>Удалить</span>
      </button>
      <motion.div
        className={"task-row-surface" + (done ? " is-done" : "")}
        style={{
          x,
          ...({ "--task-color": colorForArea(task.area) } as CSSProperties),
        }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -motionTokens.gesture.swipeReveal, right: 0 }}
        dragElastic={{ left: 0.25, right: 0.08 }}
        dragMomentum={false}
        onPointerDownCapture={(e) => {
          if (
            e.clientX < motionTokens.gesture.edge ||
            e.clientX > innerWidth - motionTokens.gesture.edge
          )
            e.stopPropagation();
        }}
        onDirectionLock={(axis) => {
          if (axis !== "x") return;
          setRevealed(true);
          swiping.current = true;
          suppress.current = performance.now() + 2000;
        }}
        onDragEnd={(_, info) => {
          swiping.current = false;
          suppress.current = performance.now() + 180;
          if (
            info.offset.x < -motionTokens.gesture.swipeCommit ||
            (info.velocity.x < -1000 && info.offset.x < -75)
          ) {
            void remove();
            return;
          }
          const open = info.offset.x < -42 || info.velocity.x < -420;
          setRevealed(open);
          animate(
            x,
            open ? -motionTokens.gesture.swipeReveal : 0,
            reduce ? motionTokens.reduced : motionTokens.spring,
          );
          if (open) haptic();
        }}
        transition={reduce ? motionTokens.reduced : motionTokens.spring}
      >
        {!isFact(task) && !isEvent(task) && (
          <AnimatedCheck
            checked={done}
            disabled={busy}
            label={(done ? "Вернуть в дела: " : "Выполнить: ") + task.title}
            onClick={() =>
              void act(task, date, false)
                .then(() => haptic("success"))
                .catch((e) => setError(String(e)))
            }
          />
        )}
        <button
          type="button"
          className="task-row-main planner-task"
          data-task-id={task.id}
          data-task-date={date}
          onClick={() => {
            if (performance.now() < suppress.current) {
              return;
            }
            if (revealed) {
              restore();
              return;
            }
            select(task);
          }}
        >
          <span
            className="calendar-task-sphere"
            style={{ background: colorForArea(task.area) }}
            aria-label={areaLabel(task.area)}
          >
            <Icon size={22} />
          </span>
          <span className="task-row-copy">
            <strong className={done ? "task-title-strike" : ""}>
              {task.title}
            </strong>
            <small>
              {areaLabel(task.area)}
              {(isEvent(task) ? eventTimeLabel(task, date) : task.dueTime) && (
                <span>
                  {isEvent(task) ? eventTimeLabel(task, date) : task.dueTime}
                </span>
              )}
              {isFact(task) && <span>Факт</span>}
            </small>
          </span>
        </button>
        {onMove && (
          <button
            type="button"
            className="task-reorder-handle"
            data-task-control="true"
            aria-label={"Переместить: " + task.title}
            disabled={busy}
            onPointerDown={(e) => {
              e.stopPropagation();
              controls.start(e);
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                onMove(e.key === "ArrowUp" ? -1 : 1);
                haptic();
              }
            }}
          >
            <GripVertical size={20} />
          </button>
        )}
      </motion.div>
      {error && (
        <p className="task-row-error" role="alert">
          {error.replace(/^Error:\s*/, "")}
        </p>
      )}
    </>
  );
  const props = {
    layout: "position" as const,
    "data-swipe-row": true,
    className: "task-swipe-row",
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, x: -24 },
    transition: reduce
      ? motionTokens.reduced
      : {
          ...motionTokens.spring,
          opacity: { duration: 0.14 },
          delay: Math.min(
            index * motionTokens.stagger,
            motionTokens.maxStagger,
          ),
        },
    "data-list-id": listId,
  };
  return onMove ? (
    <Reorder.Item
      ref={ref}
      as="div"
      value={task.id}
      dragListener={false}
      dragControls={controls}
      {...props}
      whileDrag={reduce ? { zIndex: 5 } : { scale: 1.025, zIndex: 5 }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {content}
    </Reorder.Item>
  ) : (
    <motion.div ref={ref} {...props}>
      {content}
    </motion.div>
  );
});
