import { occurrencesBetween, type CalendarOccurrence } from "../series";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  useRef,
  useLayoutEffect,
} from "react";
import { ChevronLeft, ChevronRight, Link2 } from "lucide-react";
import {
  dayKey,
  shiftDate,
  daysBetween,
  eventSpanDays,
  isEvent,
  nextBirthdayDate,
  type Task,
} from "../domain";
type Props = {
  tasks: Task[];
  select: (t: Task) => void;
  edit: (t: Task) => void;
  anchor?: string;
  embedded?: boolean;
  showDone?: boolean;
};
const short = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
// Short caption of an event in the row label: times first for long ones, so a
// narrow label never cuts them off.
function eventRange(t: Task) {
  const sameDay = t.start === t.due;
  const sameMonth = t.start.slice(0, 7) === t.due.slice(0, 7);
  const dates = sameDay
    ? short(t.start)
    : sameMonth
      ? `${Number(t.start.slice(8))}–${short(t.due)}`
      : `${short(t.start)} — ${short(t.due)}`;
  if (!t.startTime || !t.dueTime) return dates;
  const times = `${t.startTime}${sameDay ? "–" : "→"}${t.dueTime}`;
  return sameDay ? `${dates} · ${times}` : `${times} · ${dates}`;
}
export default function Gantt({
  tasks,
  select,
  edit,
  anchor,
  embedded = false,
  showDone = true,
}: Props) {
  const today = dayKey(new Date());
  const [localStart, setStart] = useState(today),
    [scale, setZoom] = useState(52);
  const scroll = useRef<HTMLDivElement>(null);
  const centerDay = useRef<number | null>(null);
  const rowHeight = 72,
    headHeight = 64;
  const start = anchor || localStart;
  const arrowId = useId();
  const labelWidth = embedded ? 140 : 220;
  const rows = useMemo(() => {
    // A repeating event may begin inside the window and end after it.
    const reach = Math.max(
      0,
      ...tasks.filter((t) => t.repeat).map((t) => eventSpanDays(t)),
    );
    const last = shiftDate(start, 27);
    return occurrencesBetween(tasks, start, shiftDate(last, reach))
      .filter((t) => showDone || t.status !== "done")
      .filter((t) => t.due)
      .filter(
        (t) =>
          !(t as CalendarOccurrence).occurrenceDate ||
          ((t.start || t.due) <= last && t.due >= start),
      )
      .map((t) =>
        t.birthday
          ? {
              ...t,
              due: nextBirthdayDate(t, new Date(start + "T12:00:00")),
              start: "",
            }
          : t,
      );
  }, [tasks, start, showDone]);
  function changeZoom(next: number) {
    next = Math.max(24, Math.min(120, next));
    if (next === scale) return;
    const element = scroll.current;
    if (element)
      centerDay.current =
        (element.scrollLeft +
          Math.max(0, element.clientWidth - labelWidth) / 2) /
        scale;
    setZoom(next);
  }
  useLayoutEffect(() => {
    const element = scroll.current;
    if (element && centerDay.current !== null) {
      element.scrollLeft = Math.max(
        0,
        centerDay.current * scale -
          Math.max(0, element.clientWidth - labelWidth) / 2,
      );
      centerDay.current = null;
    }
  }, [scale, labelWidth]);
  const zoomRef = useRef(changeZoom);
  zoomRef.current = changeZoom;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    let pinch: { distance: number; scale: number } | null = null;
    let frame: number | null = null;
    let pending = scaleRef.current;
    const distance = (e: TouchEvent) =>
      Math.hypot(
        e.touches[0]!.clientX - e.touches[1]!.clientX,
        e.touches[0]!.clientY - e.touches[1]!.clientY,
      );
    const queue = (value: number) => {
      pending = Math.max(24, Math.min(120, value));
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        zoomRef.current(pending);
      });
    };
    const startPinch = (e: TouchEvent) => {
      if (e.touches.length === 2)
        pinch = { distance: Math.max(1, distance(e)), scale: scaleRef.current };
    };
    const movePinch = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      queue((pinch.scale * distance(e)) / pinch.distance);
    };
    const endPinch = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      queue(
        (frame === null ? scaleRef.current : pending) *
          (e.deltaY < 0 ? 1.1 : 1 / 1.1),
      );
    };
    element.addEventListener("touchstart", startPinch, { passive: true });
    element.addEventListener("touchmove", movePinch, { passive: false });
    element.addEventListener("touchend", endPinch);
    element.addEventListener("touchcancel", endPinch);
    element.addEventListener("wheel", wheel, { passive: false });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      element.removeEventListener("touchstart", startPinch);
      element.removeEventListener("touchmove", movePinch);
      element.removeEventListener("touchend", endPinch);
      element.removeEventListener("touchcancel", endPinch);
      element.removeEventListener("wheel", wheel);
    };
  }, []);
  return (
    <section
      className={
        "gantt-panel mobile-friendly" + (scale < 36 ? " compact-scale" : "")
      }
    >
      <div className="calendar-heading">
        {!embedded && (
          <h2>
            {short(start)} — {short(shiftDate(start, 27))}
          </h2>
        )}
        <div>
          {!embedded && (
            <>
              <button
                className="icon-button"
                aria-label="Назад на неделю"
                onClick={() => setStart(shiftDate(start, -7))}
              >
                <ChevronLeft size={18} />
              </button>
              <button className="text-button" onClick={() => setStart(today)}>
                Сегодня
              </button>
              <button
                className="icon-button"
                aria-label="Вперёд на неделю"
                onClick={() => setStart(shiftDate(start, 7))}
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="gantt-mobile-toolbar">
        <div className="gantt-period">
          {short(start)} — {short(shiftDate(start, 27))}
          <small>Масштаб — двумя пальцами, прокрутка — одним</small>
        </div>
      </div>
      <div
        className="gantt-scroll"
        ref={scroll}
        tabIndex={0}
        role="region"
        aria-label="График Ганта, масштаб двумя пальцами или клавишами плюс и минус"
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "+" || event.key === "=" || event.key === "-") {
            event.preventDefault();
            changeZoom(scale * (event.key === "-" ? 1 / 1.1 : 1.1));
          }
        }}
      >
        <div
          className="gantt-sheet"
          style={{ width: labelWidth + 28 * scale, position: "relative" }}
        >
          <div className="gantt-head">
            <span style={{ width: labelWidth }}>Дело</span>
            <div>
              {Array.from({ length: 28 }, (_, i) => (
                <span
                  key={i}
                  style={{ width: scale }}
                  className={shiftDate(start, i) === today ? "gantt-today" : ""}
                >
                  {(scale >= 36 || i % 2 === 0) && (
                    <>
                      <strong>{Number(shiftDate(start, i).slice(-2))}</strong>
                      <small>
                        {new Date(
                          shiftDate(start, i) + "T12:00:00",
                        ).toLocaleDateString("ru-RU", { weekday: "short" })}
                      </small>
                    </>
                  )}
                </span>
              ))}
            </div>
          </div>
          {rows.map((t) => {
            const left = daysBetween(start, t.start || t.due),
              end = daysBetween(start, t.due),
              from = Math.max(0, left),
              to = Math.min(27, end);
            const progress =
              t.status === "done"
                ? 100
                : t.subtasks.length
                  ? (t.subtasks.filter((s) => s.done).length /
                      t.subtasks.length) *
                    100
                  : 0;
            return (
              <div
                className="gantt-row"
                key={t.id + ((t as CalendarOccurrence).occurrenceDate || "")}
              >
                <button
                  style={{ width: labelWidth }}
                  data-task-id={t.id}
                  data-task-date={(t as CalendarOccurrence).occurrenceDate}
                  onClick={() => select(t)}
                  title={t.title}
                >
                  <span>
                    {!!t.dependsOn?.length && <Link2 size={14} />} {t.title}
                  </span>
                  <small>
                    {isEvent(t)
                      ? eventRange(t)
                      : `${t.start ? short(t.start) + " — " : "Срок: "}${short(t.due)} ${t.dueTime || ""}`}
                  </small>
                </button>
                <div
                  className="gantt-track"
                  style={{ backgroundSize: scale + "px 100%" }}
                >
                  {to >= from && (
                    <button
                      className={
                        "gantt-bar " +
                        t.area +
                        (isEvent(t) ? " event" : !t.start ? " milestone" : "")
                      }
                      style={{
                        left: from * scale + 3,
                        width: Math.max(12, (to - from + 1) * scale - 6),
                      }}
                      data-task-id={t.id}
                      data-task-date={(t as CalendarOccurrence).occurrenceDate}
                      onClick={() => edit(structuredClone(t))}
                      aria-label={`Изменить даты: ${t.title}`}
                      title={
                        isEvent(t)
                          ? `${t.title}: ${short(t.start)} ${t.startTime || ""} — ${short(t.due)} ${t.dueTime || ""}`
                          : `${t.title}: ${t.start ? short(t.start) + " — " : ""}${short(t.due)}`
                      }
                    >
                      <span style={{ width: progress + "%" }} />
                      {isEvent(t) ? (
                        // The time fits inside the bar only when it spans a few days.
                        <em>
                          {t.startTime &&
                          t.dueTime &&
                          (to - from + 1) * scale - 6 >= 140
                            ? `${t.startTime} → ${t.dueTime}`
                            : ""}
                        </em>
                      ) : t.start ? (
                        ""
                      ) : (
                        "◆"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <svg
            className="dependency-lines"
            width={28 * scale}
            height={rows.length * rowHeight}
            style={{ left: labelWidth, top: headHeight }}
            aria-hidden="true"
          >
            <defs>
              <marker
                id={arrowId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {rows.flatMap((t, i) =>
              (t.dependsOn || []).flatMap((id) => {
                const j = rows.findIndex((x) => x.id === id);
                if (j < 0) return [];
                const parent = rows[j]!;
                const a = daysBetween(start, parent.due),
                  b = daysBetween(start, t.start || t.due);
                if (a < 0 || a > 27 || b < 0 || b > 27) return [];
                const x1 = (a + 1) * scale - 2,
                  x2 = b * scale + 2,
                  y1 = j * rowHeight + rowHeight / 2,
                  y2 = i * rowHeight + rowHeight / 2,
                  bend = Math.min(28 * scale - 4, x1 + 12);
                return (
                  <path
                    key={`${t.id}-${id}`}
                    d={`M ${x1} ${y1} H ${bend} V ${y2 - 13} H ${x2} V ${y2 - 1}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    markerEnd={`url(#${arrowId})`}
                  />
                );
              }),
            )}
          </svg>
          {!rows.length && (
            <p className="gantt-empty">
              Добавьте дату делу — оно появится на временной шкале.
            </p>
          )}
        </div>
      </div>
      <p className="gantt-help">
        Полоса — период дела, ◆ — срок без даты начала. Событие «от и до» —
        пунктирная полоса с указанным временем начала и конца. Нажмите на
        название или полосу, чтобы открыть дело. Пунктир показывает зависимости.
      </p>
    </section>
  );
}
