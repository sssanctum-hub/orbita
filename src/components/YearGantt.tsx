import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { isEvent, dayKey, type Task } from "../domain";
import { calendarLoad } from "../calendarModel";
type Props = {
  year: number;
  index: Map<string, Task[]>;
  openDay: (date: string) => void;
};
const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long" });
const dayFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "long", year: "numeric",
});
const monthName = (year: number, m: number) =>
  monthFormatter.format(new Date(year, m, 1));
export default function YearGantt({ year, index, openDay }: Props) {
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const targetMonth = useRef(new Date().getMonth());
  const zoom = useRef(1);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  useLayoutEffect(() => {
    if (expanded)
      root.current
        ?.querySelector<HTMLElement>(
          '[data-month-panel="' + targetMonth.current + '"]',
        )
        ?.scrollIntoView({ block: "start" });
    else if (root.current) root.current.scrollTop = 0;
  }, [expanded, year]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let pinch: { distance: number; zoom: number } | null = null;
    const distance = (e: TouchEvent) =>
      Math.hypot(
        e.touches[0]!.clientX - e.touches[1]!.clientX,
        e.touches[0]!.clientY - e.touches[1]!.clientY,
      );
    const apply = (next: number) => {
      zoom.current = Math.max(1, Math.min(3, next));
      if (!expandedRef.current && zoom.current > 1.35) setExpanded(true);
      if (expandedRef.current && zoom.current < 1.15) setExpanded(false);
    };
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      pinch = { distance: Math.max(1, distance(e)), zoom: zoom.current };
      const item = (e.target as Element).closest<HTMLElement>(
        "[data-year-month]",
      );
      if (item) targetMonth.current = Number(item.dataset.yearMonth);
    };
    const move = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        apply((pinch.zoom * distance(e)) / pinch.distance);
      }
    };
    const end = () => {
      pinch = null;
    };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      apply(zoom.current * (e.deltaY < 0 ? 1.5 : 0.65));
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("wheel", wheel);
    };
  }, []);
  const today = dayKey(new Date());
  function dot(date: string, month: number) {
    const entries = index.get(date) || [],
      done = entries.length > 0 && entries.every((t) => !isEvent(t) && t.status === "done");
    return (
      <button
        key={date}
        data-year-month={month}
        className={
          "year-dot load-" +
          calendarLoad(entries.length) +
          (done ? " is-done" : "") +
          (date === today ? " is-today" : "")
        }
        aria-label={
          dayFormatter.format(new Date(date + "T12:00:00")) +
          ", дел: " +
          entries.length
        }
        onClick={() => openDay(date)}
      >
        <span>{date.slice(-2).replace(/^0/, "")}</span>
      </button>
    );
  }
  return (
    <section className="year-gantt-view" aria-label="Годовой график Ганта">
      <header>
        <h2>{year}</h2>
        <p className="year-view-badge">{expanded ? "По месяцам" : "По неделям"}</p>
      </header>
      <div
        ref={root}
        className={"year-gantt " + (expanded ? "is-expanded" : "is-overview")}
        tabIndex={0}
        aria-label="Годовой календарь: щипок меняет масштаб"
        onKeyDown={(e) => {
          if (["+", "=", "-"].includes(e.key)) {
            e.preventDefault();
            zoom.current = e.key === "-" ? 1 : 2;
            setExpanded(e.key !== "-");
          }
        }}
      >
        {expanded ? (
          <div className="year-month-panels">
            {Array.from({ length: 12 }, (_, m) => {
              const days = new Date(year, m + 1, 0).getDate(),
                dates = Array.from(
                  { length: days },
                  (_, d) =>
                    year +
                    "-" +
                    String(m + 1).padStart(2, "0") +
                    "-" +
                    String(d + 1).padStart(2, "0"),
                );
              return (
                <section key={m} data-month-panel={m} data-year-month={m}>
                  <h3>
                    {monthName(year, m)}
                    <small>
                      {dates.filter((date) => index.get(date)?.length).length}{" "}
                      дней с делами
                    </small>
                  </h3>
                  <div className="year-month-weekdays" aria-hidden="true">{["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map(day => <span key={day}>{day}</span>)}</div>
                  <div className="year-month-days">
                    {Array.from({length: (new Date(year, m, 1).getDay() + 6) % 7}, (_, i) => <span key={"empty-" + i} aria-hidden="true" />)}
                    {dates.map((date) => dot(date, m))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div
            className="year-pixels"
            style={{ "--year-rows": 31 } as CSSProperties}
          >
            <span />
            {Array.from({ length: 12 }, (_, m) => (
              <span key={m} className="year-month-label">
                {monthName(year, m).slice(0, 3)}
              </span>
            ))}
            {Array.from({ length: 31 }, (_, d) => (
              <div className="year-pixel-row" key={d}>
                <span className="year-day-label">{d + 1}</span>
                {Array.from({ length: 12 }, (_, m) =>
                  d < new Date(year, m + 1, 0).getDate() ? (
                    dot(
                      year +
                        "-" +
                        String(m + 1).padStart(2, "0") +
                        "-" +
                        String(d + 1).padStart(2, "0"),
                      m,
                    )
                  ) : (
                    <span key={m} />
                  ),
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="year-gesture-hint">
        Разведите пальцы — месяцы · сведите — весь год
      </p>
    </section>
  );
}
