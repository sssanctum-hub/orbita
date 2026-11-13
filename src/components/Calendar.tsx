import { UserRound, ListTodo } from "lucide-react";
import RollingNumber from "./RollingNumber";
import { LayoutGroup, motion } from "motion/react";
import TaskList from "./TaskList";
import { motionTokens } from "../motionTokens";
import { haptic } from "../haptics";
import { useChangeMotion } from "../useChangeMotion";
import { useExitMotion } from "../useExitMotion";
import { daySchedule } from "../daySchedule";
import { useOrbitPressure } from "../useOrbitPressure";
import { colorForArea, sphereIcon } from "../areaAppearance";
import {
  useEffect,
  useId,
  useRef,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChartGantt,
  X,
  Mic,
  Plus,
  Check,
} from "lucide-react";
import { dayKey, areaLabel, isEvent, isFact, type Task } from "../domain";
import {
  calendarDates,
  moveCalendar,
  calendarIndex,
  calendarLoad,
  type CalendarMode,
} from "../calendarModel";
import YearGantt from "./YearGantt";
import { yearDates, yearIndex, moveYear } from "../yearModel";
import DayTimeline from "./DayTimeline";
import DotText from "./DotText";
type Props = {
  tasks: Task[];
  select: (task: Task) => void;
  create: (date: string, time?: string) => void;
  move?: (task: Task, time: string) => void;
  home?: boolean;
  openOrbit?: () => void;
  openVoice?: () => void;
  ready?: boolean;
  areaIcons?: Record<string, string>;
};
const dateText = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(date + "T12:00:00").toLocaleDateString("ru-RU", options);
function groupByArea(tasks: Task[]) {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const group = groups.get(task.area);
    if (group) group.push(task);
    else groups.set(task.area, [task]);
  }
  return groups;
}
const MODES: CalendarMode[] = ["День", "Неделя", "Месяц"];
// A horizontal swipe changes the mode unless the finger started inside
// something that can still scroll that way (the Gantt timeline).
function canScrollX(target: EventTarget | null, towardsEnd: boolean) {
  for (let el = target as HTMLElement | null; el; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow !== "auto" && overflow !== "scroll") continue;
      if (
        towardsEnd
          ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1
          : el.scrollLeft > 0
      )
        return true;
    }
    if (el.classList.contains("planner-surface")) break;
  }
  return false;
}
export default function Calendar({
  tasks,
  select,
  create,
  move,
  ready = true,
  home = false,
  openOrbit,
  openVoice,
  areaIcons = {},
}: Props) {
  const [mode, setModeNow] = useState<CalendarMode>(home ? "День" : "Месяц");
  const [stackArea, setStackArea] = useState<string | null>(null);
  const [bubbleDate, setBubbleDate] = useState<string | null>(null);
  const bubble = useRef<HTMLDialogElement>(null);
  const weekRoot = useRef<HTMLDivElement>(null);
  const bubbleTitle = useId();
  const segmentId = useId();
  const backlog = useRef<HTMLDialogElement>(null);
  const backlogTitle = useId();
  const dismissBubble = useExitMotion(bubble);
  const dismissBacklog = useExitMotion(backlog);
  useEffect(() => {
    if (bubbleDate) bubble.current?.showModal();
    else bubble.current?.close();
  }, [bubbleDate]);
  function closeBubble() {
    dismissBubble(() => {
      setBubbleDate(null);
      setStackArea(null);
    });
  }
  const [slide, setSlide] = useState<"" | "from-right" | "from-left">("");
  const swipe = useRef<{
    x: number;
    y: number;
    at: number;
    multi: boolean;
  } | null>(null);
  const lastCalendarMode = useRef<CalendarMode>(home ? "День" : "Месяц");
  useEffect(() => {
    const localBack=(e:Event)=>{
      if(surface.current?.closest("[aria-hidden=true]") || mode !== "Гант") return;
      e.preventDefault();
      setModeNow(lastCalendarMode.current);
    };
    window.addEventListener("orbita:local-back",localBack);
    return ()=>window.removeEventListener("orbita:local-back",localBack);
  },[mode]);
  function setMode(next: CalendarMode) {
    if (next === mode) return;
    if(next !== "Гант") lastCalendarMode.current=next;
    const step = MODES.indexOf(next) - MODES.indexOf(mode);
    setSlide(step > 0 ? "from-right" : step < 0 ? "from-left" : "");
    setModeNow(next);
    haptic();
  }
  const [anchor, setAnchor] = useState(() => dayKey(new Date()));
  const surface = useRef<HTMLDivElement>(null);
  useChangeMotion(surface, anchor);
  const showDone = true;
  const backlogDay = useMemo(
    () => daySchedule(tasks, anchor, true).allDay,
    [tasks, anchor],
  );
  const unscheduled = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !isFact(task) && !task.due && !isEvent(task) && !task.birthday,
      ),
    [tasks],
  );
  const [now, setNow] = useState(() => new Date());
  const today = dayKey(now);
  const previousDay = useRef(today);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    const timer = setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    const old = previousDay.current;
    if (old !== today) {
      setAnchor((date) => (date === old ? today : date));
      previousDay.current = today;
    }
  }, [today]);
  const visible = tasks;
  const period = mode === "Месяц" ? anchor.slice(0, 7) + "-01" : anchor;
  const dates = useMemo(
    () =>
      mode === "Гант"
        ? yearDates(Number(anchor.slice(0, 4)))
        : calendarDates(period, mode),
    [period, mode, anchor],
  );
  const index = useMemo(() => {
    if (mode === "Гант") return yearIndex(visible, Number(anchor.slice(0, 4)));
    if (mode === "День") return new Map<string, Task[]>();
    const index = calendarIndex(visible, dates);
    return index;
  }, [visible, dates, showDone, mode, anchor]);
  useOrbitPressure(weekRoot, [mode, index]);
  const onDate = (date: string) => index.get(date) || [];
  const selectFromList = (task: Task) => {
    // Keep the originating list in the native modal stack for one-step Back.
    select(task);
  };

  return (
    <div
      className={
        "planner" +
        (home ? " today-planner" : "") +
        (mode === "Гант" ? " showing-gantt" : "") +
        (mode === "Месяц" ? " showing-month" : "")
      }
    >
      <header className="planner-hero">
        {home ? (
          <div className="today-poster">
            <h1
              aria-label={dateText(anchor, { day: "numeric", month: "long" })}
            >
              <RollingNumber value={Number(anchor.slice(-2))} dotted pad={2} animateKey={anchor} />
            </h1>
            <p
              className="today-band"
              aria-label={
                anchor.slice(0, 4) +
                ", " +
                dateText(anchor, { month: "long" }) +
                ", " +
                dateText(anchor, { weekday: "long" })
              }
            >
              <DotText
                text={dateText(anchor, { weekday: "long" })}
                animateKey={anchor}
                cell={3.6}
                fit
              />
              <span>
                {dateText(anchor, { month: "long" })} {anchor.slice(0, 4)}
              </span>
            </p>

          </div>
        ) : (
          <>
            <span className="planner-year">{anchor.slice(0, 4)}</span>
            <h1>{dateText(anchor, { month: "long" })}</h1>
          </>
        )}
        <div className="planner-navigation">
          <button
            aria-label="Предыдущий период"
            onClick={() =>
              setAnchor(
                mode === "Гант"
                  ? moveYear(anchor, -1)
                  : moveCalendar(anchor, mode, -1),
              )
            }
          >
            <ArrowLeft size={21} />
          </button>
          <button onClick={() => setAnchor(today)}>Сегодня</button>
          <button
            aria-label="Следующий период"
            onClick={() =>
              setAnchor(
                mode === "Гант"
                  ? moveYear(anchor, 1)
                  : moveCalendar(anchor, mode, 1),
              )
            }
          >
            <ArrowRight size={21} />
          </button>
        </div>
        <LayoutGroup id={segmentId}>
          <div
            className="planner-modes"
            aria-label="Вид календаря"
            style={{ "--mode-index": MODES.indexOf(mode) } as CSSProperties}
          >
            {MODES.map((value) => (
              <button
                key={value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {mode === value && (
                  <motion.span
                    layoutId="calendar-segment"
                    className="spring-segment-thumb"
                    transition={motionTokens.spring}
                  />
                )}
                <span className="segment-label">{value}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </header>
      <div
        ref={surface}
        className={"planner-surface" + (slide ? " slide-" + slide : "")}
        key={home ? mode : undefined}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setSlide("");
        }}
        onTouchStart={(e) => {
          const touch = e.touches[0]!;
          const edge = 24;
          swipe.current =
            e.touches.length === 1 &&
            touch.clientX > edge &&
            touch.clientX < window.innerWidth - edge
              ? {
                  x: touch.clientX,
                  y: touch.clientY,
                  at: Date.now(),
                  multi: false,
                }
              : null;
        }}
        onTouchMove={(e) => {
          if (swipe.current && e.touches.length > 1) swipe.current.multi = true;
        }}
        onTouchEnd={(e) => {
          const start = swipe.current;
          swipe.current = null;
          const touch = e.changedTouches[0];
          if (!start || start.multi || !touch) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
          if (Date.now() - start.at > 700) return;
          // Ignore the end of a long-press drag or a pinch in the day view.
          const busy = (e.target as HTMLElement).closest<HTMLElement>(
            "[data-gesture-at]",
          );
          if (busy && Date.now() - Number(busy.dataset.gestureAt) < 800) return;
          if ((e.target as Element).closest("[data-swipe-row]")) return;
          if (canScrollX(e.target, dx < 0)) return;
          if (mode === "Гант") return;
          const next = MODES[MODES.indexOf(mode) + (dx < 0 ? 1 : -1)];
          if (next) setMode(next);
        }}
      >
        {mode === "Месяц" && (
          <div className="planner-month">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
              <span className="planner-weekday" key={d}>
                {d}
              </span>
            ))}
            {dates.map((date) => {
              const entries = onDate(date);
              const count = entries.length;
              return (
                <button
                  key={date}
                  aria-label={
                    dateText(date, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }) + (count ? ", дел: " + count : "")
                  }
                  aria-pressed={date === bubbleDate}
                  aria-current={date === today ? "date" : undefined}
                  className={
                    (date.slice(0, 7) !== anchor.slice(0, 7)
                      ? "outside "
                      : "") +
                    (date === today ? "today " : "") +
                    "load-" +
                    calendarLoad(count)
                  }
                  onClick={() => {
                    setBubbleDate(date);
                  }}
                >
                  <span>{Number(date.slice(-2))}</span>
                  <small className="month-task-dots" aria-hidden="true">{entries.slice(0, 12).map((task, i) => <i key={task.id + "-" + i} style={{background: colorForArea(task.area)}} />)}{entries.length > 12 && <i className="month-more-dot" />}</small>
                </button>
              );
            })}
          </div>
        )}
        {mode === "День" ? (
          <DayTimeline
            tasks={tasks}
            date={anchor}
            showDone={showDone}
            select={select}
            create={create}
            move={move}
            ready={ready}
            now={now}
            areaIcons={areaIcons}
          />
        ) : mode === "Гант" ? (
          <YearGantt
            year={Number(anchor.slice(0, 4))}
            index={index}
            openDay={setBubbleDate}
          />
        ) : mode === "Неделя" ? (
          <div className="week-lines" ref={weekRoot}>
            {dates.map((date) => (
              <section className="week-line" key={date}>
                <button
                  className={
                    "week-day-bubble" + (date === today ? " is-today" : "")
                  }
                  aria-label={
                    "Открыть " +
                    dateText(date, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })
                  }
                  onClick={() => setBubbleDate(date)}
                >
                  <span>{dateText(date, { weekday: "short" })}</span>
                  <strong>{Number(date.slice(-2))}</strong>
                </button>
                <div className="week-task-slot">
                  <div className="week-line-tasks">
                    {Array.from(
                      groupByArea(onDate(date)),
                      ([area, entries]) => {
                        const Icon = sphereIcon(area, areaIcons);
                        const stacked = entries.length > 1;
                        const done = entries.every(
                          (task) => !isEvent(task) && task.status === "done",
                        );
                        return (
                          <div className="week-bubble-slot" key={area}>
                            <button
                              data-task-id={
                                stacked ? undefined : entries[0]!.id
                              }
                              data-task-date={date}
                              className={
                                "week-sphere-bubble" +
                                (stacked ? " is-stack" : "") +
                                (done ? " is-done" : "")
                              }
                              style={
                                {
                                  "--sphere-tint": colorForArea(area),
                                } as CSSProperties
                              }
                              title={
                                stacked
                                  ? areaLabel(area) +
                                    ": " +
                                    entries.length +
                                    " дел"
                                  : entries[0]!.title
                              }
                              aria-label={
                                stacked
                                  ? areaLabel(area) +
                                    ": " +
                                    entries.length +
                                    " дел. Раскрыть стопку"
                                  : entries[0]!.title + ", " + areaLabel(area)
                              }
                              aria-haspopup={stacked ? "dialog" : undefined}
                              onClick={() => {
                                if (stacked) {
                                  setStackArea(area);
                                  setBubbleDate(date);
                                } else select(entries[0]!);
                              }}
                            >
                              {stacked && (
                                <>
                                  <span
                                    className="stack-sheet back"
                                    aria-hidden="true"
                                  />
                                  <span
                                    className="stack-sheet front"
                                    aria-hidden="true"
                                  />
                                </>
                              )}
                              <span className="week-sphere-face">
                                <Icon size={26} />
                                {done && (
                                  <Check className="week-done-mark" size={13} />
                                )}
                              </span>
                              {stacked && (
                                <span className="week-stack-count">
                                  <RollingNumber value={entries.length} />
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      },
                    )}
                    {!onDate(date).length && (
                      <span className="week-free">Свободно</span>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
      <dialog
        ref={bubble}
        className="calendar-day-bubble"
        aria-labelledby={bubbleTitle}
        onCancel={(event) => {
          event.preventDefault();
          closeBubble();
        }}
        onClose={() => {
          setBubbleDate(null);
          setStackArea(null);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const box = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < box.left ||
              event.clientX > box.right ||
              event.clientY < box.top ||
              event.clientY > box.bottom
            )
              closeBubble();
          }
        }}
      >
        {bubbleDate && (
          <>
            <header>
              <h2 id={bubbleTitle}>
                {stackArea && (
                  <span className="stack-area-title">
                    {areaLabel(stackArea)}
                  </span>
                )}
                {dateText(bubbleDate, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h2>
              <button onClick={closeBubble} aria-label="Закрыть день">
                <X size={22} />
              </button>
            </header>
            <div className="calendar-day-list">
              <TaskList
                tasks={onDate(bubbleDate).filter(
                  (task) => !stackArea || task.area === stackArea,
                )}
                date={bubbleDate}
                select={selectFromList}
                areaIcons={areaIcons}
              />
              {!onDate(bubbleDate).length && (
                <p className="planner-empty">Свободный день</p>
              )}
            </div>
            <button
              className="calendar-day-add"
              disabled={!ready}
              onClick={() => {
                const date = bubbleDate;
                create(date);
              }}
            >
              <Plus size={20} /> Добавить дело
            </button>
          </>
        )}
      </dialog>
      <dialog
        ref={backlog}
        className="calendar-day-bubble backlog-menu"
        aria-labelledby={backlogTitle}
        onCancel={(e) => {
          e.preventDefault();
          dismissBacklog();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            dismissBacklog();
        }}
      >
        <header>
          <h2 id={backlogTitle} aria-label="Бессрочные дела">
            <DotText text="Бессрочные" cell={3.2} fit />
            <DotText text="дела" cell={3.2} fit />
          </h2>
          <button
            aria-label="Закрыть бессрочные дела"
            onClick={() => dismissBacklog()}
          >
            <X size={22} />
          </button>
        </header>
        {!!backlogDay.length && (
          <section>
            <h3>
              Без времени ·{" "}
              {dateText(anchor, { day: "numeric", month: "long" })}
            </h3>
            <div className="calendar-day-list">
              <TaskList
                tasks={backlogDay}
                date={anchor}
                select={selectFromList}
                areaIcons={areaIcons}
                hideCompleted
              />
            </div>
          </section>
        )}
        {!!unscheduled.length && (
          <section>
            <h3>Без даты</h3>
            <div className="calendar-day-list">
              <TaskList
                tasks={unscheduled}
                select={selectFromList}
                areaIcons={areaIcons}
                hideCompleted
              />
            </div>
          </section>
        )}
        {!backlogDay.some((t) => t.status !== "done") &&
          !unscheduled.some((t) => t.status !== "done") && (
            <p className="planner-empty">Бессрочных дел пока нет</p>
          )}
        <button
          className="calendar-day-add"
          disabled={!ready}
          onClick={() => {
            create("");
          }}
        >
          <Plus size={20} /> Добавить дело
        </button>
      </dialog>
      {home && (
        // The orbit switch sits in a white notch cut into the calendar's right
        // edge; the corners are rounded so the page's white flows around it.
        <div className="orbit-switch">
          <svg viewBox="0 0 40 90.6" aria-hidden="true" focusable="false">
            <path d="M38 0A14 14 0 0 1 26.44 13.79A32 32 0 0 0 26.44 76.81A14 14 0 0 1 38 90.6L40 90.6L40 0Z" />
          </svg>
          <button
            className="orbit-switch-button"
            onClick={openOrbit}
            aria-label="Перейти к сферам"
            title="Сферы"
          >
            <span className="orbit-switch-dot" aria-hidden="true" />
          </button>
        </div>
      )}
      {home && (
        // Gantt is a separate destination in the bottom dock.
        <nav className="today-dock" aria-label="Быстрые действия">
          <button
            className="dock-button dock-year"
            aria-label="График Ганта"
            aria-pressed={mode === "Гант"}
            title="График Ганта"
            onClick={() => setMode(mode === "Гант" ? "День" : "Гант")}
          >
            <ChartGantt size={22} />
          </button>
          <button type="button" className="dock-button dock-profile" aria-label="Открыть профиль и резервные копии" title="Профиль" onClick={()=>window.dispatchEvent(new Event("orbita:open-account"))}><UserRound size={14} strokeWidth={1.6}/></button>
          <button
            className="dock-button dock-add"
            aria-label={"Добавить дело на " + anchor}
            disabled={!ready}
            onClick={() => create(anchor)}
          >
            <Plus size={30} strokeWidth={2.2} />
          </button>
          <button type="button" className="dock-button dock-backlog" aria-label="Открыть бессрочные дела" title="Бессрочные дела" onClick={()=>backlog.current?.showModal()}><ListTodo size={14} strokeWidth={1.6}/></button>
          <button
            className="dock-button dock-voice"
            aria-label="Добавить дело голосом"
            disabled={!ready}
            onClick={openVoice}
          >
            <Mic size={22} />
          </button>
        </nav>
      )}
    </div>
  );
}
