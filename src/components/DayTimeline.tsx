import {
  AnimatePresence,
  motion,
  animate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { motionTokens } from "../motionTokens";
import { haptic } from "../haptics";
import { useTaskActions } from "../taskMotion";
import AnimatedCheck from "./AnimatedCheck";
import SwipeTask from "./SwipeTask";
import { snapQuarter } from "../yearModel";
import { useOrbitPressure } from "../useOrbitPressure";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import TaskList from "./TaskList";
import { useExitMotion } from "../useExitMotion";
import { Check, X } from "lucide-react";
import { areaLabel, dayKey, isEvent, type Task } from "../domain";
import { colorForArea, sphereIcon } from "../areaAppearance";
import {
  DAY_ZOOM,
  type DayEntry,
  daySchedule,
  dayDisplayGroups,
  densityFor,
  layoutDay,
  minuteOf,
  timeOf,
} from "../daySchedule";
type Props = {
  tasks: Task[];
  date: string;
  showDone: boolean;
  select: (t: Task) => void;
  create: (date: string, time?: string) => void;
  move?: (task: Task, time: string) => void | Promise<void>;
  ready: boolean;
  now: Date;
  areaIcons?: Record<string, string>;
};
const shortDate = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
const ZOOM_KEY = "orbit.dayZoom";
const LABEL_WIDTH = 50;
const clampZoom = (value: number) =>
  Math.min(DAY_ZOOM.max, Math.max(DAY_ZOOM.min, value));
function storedZoom() {
  try {
    const value = Number(localStorage.getItem(ZOOM_KEY));
    return value ? clampZoom(value) : DAY_ZOOM.initial;
  } catch {
    return DAY_ZOOM.initial;
  }
}
export default function DayTimeline({
  tasks,
  date,
  showDone,
  select,
  create,
  move,
  ready,
  now,
  areaIcons = {},
}: Props) {
  const { act, busy } = useTaskActions();
  const reduce = useReducedMotion();
  const dragOffset = useMotionValue(0);
  const dropAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const { timed, allDay } = useMemo(
    () => daySchedule(tasks, date, showDone),
    [tasks, date, showDone],
  );
  const [hour, setHour] = useState(storedZoom);
  const density = densityFor(hour);
  const placed = useMemo(() => layoutDay(timed, hour), [timed, hour]);
  const scroll = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(280);
  const groups = useMemo(() => dayDisplayGroups(placed, availableWidth), [placed, availableWidth]);
  const compactIds = new Set(groups.filter(g => g.compact).flatMap(g => g.entries.map(p => p.task.id)));
  const [stack, setStack] = useState<{area: string; ids: string[]} | null>(null);
  const stackDialog = useRef<HTMLDialogElement>(null);
  const dismissStack = useExitMotion(stackDialog);
  const closeStack = () => dismissStack(() => setStack(null));
  useEffect(() => { if (stack) stackDialog.current?.showModal(); }, [stack]);
  useEffect(() => { stackDialog.current?.close(); setStack(null); }, [date]);
  useLayoutEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setAvailableWidth(Math.max(1, el.clientWidth - LABEL_WIDTH)));
    observer.observe(el);
    setAvailableWidth(Math.max(1, el.clientWidth - LABEL_WIDTH));
    return () => observer.disconnect();
  }, []);
  const [drag, setDrag] = useState<{
    id: string;
    minute: number;
    active: boolean;
  } | null>(null);
  const dragRef = useRef<{
    task: Task;
    pointer: number;
    y: number;
    x: number;
    scroll: number;
    origin: number;
    minute: number;
    active: boolean;
    scrolling: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const suppressClick = useRef(0);
  const today = dayKey(now) === date;
  const scheduleRoot = useRef<HTMLElement>(null);
  useOrbitPressure(scheduleRoot, [placed, drag?.minute]);
  function cancelDrag() {
    const d = dragRef.current;
    if (d) clearTimeout(d.timer);
    dropAnimation.current?.stop();
    dragOffset.set(0);
    dragRef.current = null;
    setDrag(null);
  }
  useEffect(
    () => () => {
      if (dragRef.current) clearTimeout(dragRef.current.timer);
      dropAnimation.current?.stop();
    },
    [],
  );
  function dragStart(e: ReactPointerEvent<HTMLButtonElement>, task: Task) {
    if (!ready || busy || !move || e.button !== 0 || !e.isPrimary) return;
    cancelDrag();
    const button = e.currentTarget;
    const state = {
      task,
      pointer: e.pointerId,
      y: e.clientY,
      x: e.clientX,
      scroll: scroll.current?.scrollTop || 0,
      origin: minuteOf(task.dueTime!),
      minute: minuteOf(task.dueTime!),
      active: false,
      scrolling: false,
      timer: 0 as unknown as ReturnType<typeof setTimeout>,
    };
    state.timer = setTimeout(() => {
      if (state.scrolling || dragRef.current !== state) return;
      state.active = true;
      setDrag({ id: task.id, minute: state.minute, active: true });
      button.setPointerCapture(state.pointer);
      haptic("impact");
      if (scroll.current) scroll.current.dataset.gestureAt = String(Date.now());
    }, 450);
    dragRef.current = state;
  }
  function dragMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current,
      el = scroll.current;
    if (!d || !el || d.pointer !== e.pointerId) return;
    if (!d.active) {
      const dy=e.clientY-d.y, dx=e.clientX-d.x;
      if (d.scrolling || (Math.abs(dy)>8 && Math.abs(dy)>Math.abs(dx))) {
        clearTimeout(d.timer);
        d.scrolling=true;
        e.currentTarget.setPointerCapture(e.pointerId);
        el.scrollTop=d.scroll-dy;
      } else if(Math.abs(dx)>8) cancelDrag();
      return;
    }
    e.stopPropagation();
    const box = el.getBoundingClientRect();
    if (e.clientY < box.top + 28) el.scrollTop -= 12;
    else if (e.clientY > box.bottom - 28) el.scrollTop += 12;
    dragOffset.set(e.clientY - d.y + el.scrollTop - d.scroll);
    const minute = snapQuarter(
      d.origin +
        ((e.clientY - d.y + el.scrollTop - d.scroll) * 60) / hourRef.current,
    );
    if (minute !== d.minute) {
      d.minute = minute;
      setDrag({ id: d.task.id, minute, active: true });
    }
  }
  async function dragEnd(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || d.pointer !== e.pointerId) return;
    clearTimeout(d.timer);
    if (!d.active) {
      if(d.scrolling) suppressClick.current=Date.now()+220;
      cancelDrag();
      return;
    }
    suppressClick.current = Date.now() + 220;
    if (scroll.current) scroll.current.dataset.gestureAt = String(Date.now());
    const commit = e.type === "pointerup" && d.minute !== d.origin;
    const target = commit ? ((d.minute - d.origin) * hourRef.current) / 60 : 0;
    dropAnimation.current = animate(
      dragOffset,
      target,
      reduce ? motionTokens.reduced : motionTokens.spring,
    );
    await dropAnimation.current;
    if (dragRef.current !== d) return;
    if (commit) {
      haptic();
      await move?.(d.task, timeOf(d.minute));
    }
    if (dragRef.current === d) cancelDrag();
  }

  // Keeps the minute at the middle of the view in place while zooming.
  const focus = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(ZOOM_KEY, String(Math.round(hour)));
      } catch {
        /* per-viewer convenience only */
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [hour]);
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const start = today ? Math.max(0, new Date().getHours() - 1) : 8;
    element.scrollTop = start * hour;
    // Only on day change; zoom keeps its own anchor.
  }, [date, today]);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element || focus.current === null) return;
    element.scrollTop = (focus.current * hour) / 60 - element.clientHeight / 2;
    focus.current = null;
  }, [hour]);
  function zoomTo(next: number) {
    next = clampZoom(next);
    if (next === hour) return;
    const element = scroll.current;
    if (element)
      focus.current =
        ((element.scrollTop + element.clientHeight / 2) * 60) / hour;
    setHour(next);
  }
  const hourRef = useRef(hour);
  hourRef.current = hour;
  const zoomRef = useRef(zoomTo);
  zoomRef.current = zoomTo;

  // Two-finger pinch and Ctrl+wheel change the scale; while a task is being
  // dragged the page must not scroll under the finger.
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    let pinch: { distance: number; hour: number } | null = null;
    let frame: number | null = null;
    let pendingHour = hourRef.current;
    const queueZoom = (next: number) => {
      pendingHour = clampZoom(next);
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        zoomRef.current(pendingHour);
      });
    };
    const distance = (e: TouchEvent) =>
      Math.hypot(
        e.touches[0]!.clientX - e.touches[1]!.clientX,
        e.touches[0]!.clientY - e.touches[1]!.clientY,
      );
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        cancelDrag();
        pinch = { distance: Math.max(1, distance(e)), hour: hourRef.current };
        element.dataset.gestureAt = String(Date.now());
      }
    };
    const moveTouch = (e: TouchEvent) => {
      if (dragRef.current?.active) {
        e.preventDefault();
        return;
      }
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        element.dataset.gestureAt = String(Date.now());
        queueZoom((pinch.hour * distance(e)) / pinch.distance);
      }
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      queueZoom(
        (frame === null ? hourRef.current : pendingHour) *
          (e.deltaY < 0 ? 1.12 : 0.89),
      );
    };
    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchmove", moveTouch, { passive: false });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", end);
    element.addEventListener("wheel", wheel, { passive: false });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", moveTouch);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", end);
      element.removeEventListener("wheel", wheel);
    };
  }, []);
  const card = (task: DayEntry, timedCard = false, narrow = false, iconOnly = false) => {
    const Icon = sphereIcon(task.area, areaIcons);
    // A day's part of an event can't be dragged: its length is set in the editor.
    const movable =
      !!move && !task.segment && !isEvent(task) && task.status !== "done";
    const dragging = drag?.id === task.id && drag.active;
    const range = isEvent(task)
      ? task.start === task.due
        ? ""
        : ` · ${shortDate(task.start)} — ${shortDate(task.due)}`
      : "";
    const time = dragging
      ? timeOf(drag.minute)
      : task.segment
        ? task.segment.label
        : isEvent(task)
          ? "весь день"
          : task.dueTime || "";
    return (
      <button
        key={task.id}
        data-task-id={task.id}
        data-task-date={date}
        data-day-drag={movable ? "true" : undefined}
        data-drag-time={dragging ? time : undefined}
        onPointerDown={movable ? (e) => dragStart(e, task) : undefined}
        onPointerMove={movable ? dragMove : undefined}
        onPointerUp={movable ? dragEnd : undefined}
        onPointerCancel={movable ? dragEnd : undefined}
        onContextMenu={
          movable
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
              }
            : undefined
        }
        className={
          "day-event day-event-" +
          (timedCard ? density : "full") +
          (isEvent(task) ? " is-range" : "") +
          (iconOnly ? " day-icon-card" : "") +
          (!isEvent(task) && task.status === "done" ? " is-done" : "") +
          (dragging ? " is-dragging" : "")
        }
        style={{ "--event-color": colorForArea(task.area) } as CSSProperties}
        aria-label={
          task.title +
          (time ? ", " + time : "") +
          (timedCard && movable
            ? ". Удерживайте для переноса с шагом 15 минут"
            : "")
        }
        onClick={() => {
          if (Date.now() < suppressClick.current) {
            return;
          }
          select(task.segment?.source ?? task);
        }}
        onKeyDown={(e) => {
          if (!timedCard || !movable || !e.altKey) return;
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          const minute =
            minuteOf(task.dueTime!) + (e.key === "ArrowUp" ? -15 : 15);
          if (minute >= 0 && minute <= 1435) move?.(task, timeOf(minute));
        }}
      >
        {(
          <span className="day-event-orb">
            <Icon size={21} />
          </span>
        )}
        <span className="day-event-text" hidden={iconOnly}>
          <strong>{task.title}</strong>
          {(!timedCard || density === "full") && (
            <small>
              {narrow
                ? time
                : (task.birthday ? "День рождения · " : "") +
                  areaLabel(task.area) +
                  (isEvent(task)
                    ? ""
                    : task.minutes > 0
                      ? " · " + task.minutes + " мин"
                      : "") +
                  range}
            </small>
          )}
        </span>
        {!iconOnly && (!timedCard || (density !== "thin" && !narrow)) && (
          <span className="day-event-time">
            {!isEvent(task) && task.status === "done" ? (
              <Check size={18} />
            ) : (
              time
            )}
          </span>
        )}
      </button>
    );
  };
  const labelEvery = hour >= 24 ? 1 : hour >= 18 ? 2 : 3;
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  return (
    <section
      ref={scheduleRoot}
      className={"day-schedule density-" + density}
      aria-label="Расписание по часам"
    >
      {ready && !timed.length && !allDay.length && (
        <p className="day-free">
          Этот день пока свободен. Нажмите на час, чтобы добавить дело.
        </p>
      )}
      <div
        className="day-hours"
        ref={scroll}
        tabIndex={0}
        role="region"
        aria-label="Часы дня, прокручиваемый список"
      >
        <div
          className="day-grid"
          style={
            {
              height: 24 * hour,
              "--label-width": LABEL_WIDTH + "px",
            } as CSSProperties
          }
        >
          {Array.from({ length: 24 }, (_, h) => {
            const time = timeOf(h * 60);
            return (
              <div
                className={
                  "day-hour" +
                  (today && now.getHours() === h ? " current-hour" : "")
                }
                key={h}
                data-hour={h}
                style={{ top: h * hour, height: hour }}
              >
                <button
                  className="day-hour-label"
                  aria-label={"Добавить дело на " + date + " в " + time}
                  disabled={!ready}
                  onClick={() => create(date, time)}
                >
                  {h % labelEvery === 0 ? time : ""}
                </button>
                <button
                  className="day-hour-slot"
                  tabIndex={-1}
                  aria-hidden="true"
                  disabled={!ready}
                  onClick={() => create(date, time)}
                />
              </div>
            );
          })}
          {today && (
            <span
              className="day-now"
              style={{ top: (nowMinute * hour) / 60 }}
              aria-label={"Сейчас " + timeOf(nowMinute)}
            >
              {timeOf(nowMinute)}
            </span>
          )}
          {groups.filter(g => g.compact).map(group => {
            const spheres = new Map<string, DayEntry[]>();
            group.entries.forEach(({task}) => spheres.set(task.area, [...(spheres.get(task.area) || []), task]));
            return <div key={group.entries[0]!.task.id} className="day-placed day-compact-row" style={{top: group.top, height: Math.max(64, group.height), left: LABEL_WIDTH, right: 0}}>
              <div className="day-sphere-row">{Array.from(spheres, ([area, entries]) => {
                const Icon = sphereIcon(area, areaIcons);
                const done = entries.every(t => !isEvent(t) && t.status === "done");
                return <motion.div key={area} className="day-sphere-slot" style={{y: drag?.id === entries[0]!.id ? dragOffset : 0}}>
                  {entries.length === 1 ? card(entries[0]!, true, true, true) :
                    <button className={"day-sphere-stack" + (done ? " is-done" : "")} style={{"--event-color": colorForArea(area)} as CSSProperties} aria-label={areaLabel(area) + ": " + entries.length + " дел. Раскрыть стопку"} aria-haspopup="dialog" onClick={() => setStack({area, ids: entries.map(t => t.id)})}>
                      <span className="day-stack-sheet" aria-hidden="true"/><span className="day-stack-face"><Icon size={24}/></span><span className="day-stack-count">{entries.length}</span>
                    </button>}
                </motion.div>;
              })}</div>
            </div>;
          })}
          <AnimatePresence initial={false}>
            {placed.filter(p => !compactIds.has(p.task.id)).map(({ task, top, height, column, columns }) => {
              return (
                <motion.div
                  layout={drag ? false : "position"}
                  initial={
                    reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }
                  }
                  animate={{
                    opacity: 1,
                    scale: drag?.id === task.id ? 1.025 : 1,
                  }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                  transition={
                    reduce ? motionTokens.reduced : motionTokens.spring
                  }
                  key={task.id}
                  className="day-placed"
                  style={{
                    top:
                      drag?.id === task.id && dragRef.current
                        ? (dragRef.current.origin * hour) / 60
                        : top,
                    y: drag?.id === task.id ? dragOffset : 0,
                    height,
                    left: `calc(var(--label-width) + (100% - var(--label-width)) * ${column} / ${columns})`,
                    width: `calc((100% - var(--label-width)) / ${columns} - 4px)`,
                  }}
                >
                  <SwipeTask
                    task={task.segment?.source ?? task}
                    date={date}
                    timeDragging={!!drag?.active}
                    onGestureStart={() => {
                      cancelDrag();
                      suppressClick.current = Date.now() + 220;
                    }}
                  >
                    {card(task, true, columns > 1)}
                    {!isEvent(task) && (
                      <div className="day-task-check">
                        <AnimatedCheck
                          checked={task.status === "done"}
                          disabled={busy}
                          label={
                            (task.status === "done"
                              ? "Вернуть в дела: "
                              : "Выполнить: ") + task.title
                          }
                          onClick={() =>
                            void act(
                              task.segment?.source ?? task,
                              date,
                              false,
                            ).catch(() => {})
                          }
                        />
                      </div>
                    )}
                  </SwipeTask>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
      <dialog ref={stackDialog} className="calendar-day-bubble day-stack-dialog" aria-label={stack ? areaLabel(stack.area) : "Дела сферы"} onCancel={e => { e.preventDefault(); closeStack(); }} onClick={e => { if (e.target === e.currentTarget) { const r=e.currentTarget.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) closeStack(); } }}>
        <header><h2>{stack && areaLabel(stack.area)}</h2><button aria-label="Закрыть стопку" onClick={closeStack}><X size={22}/></button></header>
        <div className="calendar-day-list"><TaskList tasks={timed.filter(t => stack?.ids.includes(t.id)).map(t => t.segment?.source ?? t)} date={date} select={select} areaIcons={areaIcons}/></div>
      </dialog>
    </section>
  );
}
