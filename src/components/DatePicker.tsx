import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { dayKey, shiftDate } from "../domain";
import { calendarDates, moveCalendar } from "../calendarModel";
type Props = {
  label: string;
  value: string;
  change: (date: string) => void;
  disabled?: boolean;
};
export default function DatePicker({ label, value, change, disabled }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const back = (event: Event) => {
      const top = (event as CustomEvent<{ dialog: HTMLDialogElement | null }>)
        .detail?.dialog;
      if (top !== (trigger.current?.closest("dialog") || null)) return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    window.addEventListener("orbita:overlay-back", back);
    return () => window.removeEventListener("orbita:overlay-back", back);
  }, [open]);
  const today = dayKey(new Date());
  const [month, setMonth] = useState(value || today);
  const [focused, setFocused] = useState(value || today);
  const focusPending = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusPending.current) {
      grid.current
        ?.querySelector<HTMLButtonElement>('[data-date="' + focused + '"]')
        ?.focus();
      focusPending.current = false;
    }
  }, [focused, month]);
  function choose(date: string) {
    change(date);
    setFocused(date || today);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div className="date-picker">
      <span className="date-picker-label" id={id + "-label"}>
        {label}
      </span>
      <button
        type="button"
        ref={trigger}
        className="date-picker-trigger"
        aria-labelledby={id + "-label " + id + "-value"}
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => {
          setMonth(value || today);
          setFocused(value || today);
          setOpen(!open);
        }}
      >
        <span id={id + "-value"}>
          {value
            ? new Date(value + "T12:00:00").toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "Выбрать дату"}
        </span>
        <CalendarDays size={20} />
      </button>
      {open && (
        <section
          className="date-picker-popover"
          id={id}
          aria-label={"Календарь: " + label}
        >
          <header>
            <button
              type="button"
              aria-label="Предыдущий месяц"
              onClick={() => {
                const next = moveCalendar(month, "Месяц", -1);
                setMonth(next);
                setFocused(next);
              }}
            >
              <ChevronLeft size={19} />
            </button>
            <strong aria-live="polite">
              {new Date(month + "T12:00:00").toLocaleDateString("ru-RU", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              type="button"
              aria-label="Следующий месяц"
              onClick={() => {
                const next = moveCalendar(month, "Месяц", 1);
                setMonth(next);
                setFocused(next);
              }}
            >
              <ChevronRight size={19} />
            </button>
          </header>
          <div className="date-picker-grid" ref={grid}>
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
              <span key={day}>{day}</span>
            ))}
            {calendarDates(month, "Месяц").map((date) => (
              <button
                type="button"
                key={date}
                data-date={date}
                disabled={disabled}
                className={
                  (date.slice(0, 7) !== month.slice(0, 7) ? "outside " : "") +
                  (date === today ? "today" : "")
                }
                aria-label={new Date(date + "T12:00:00").toLocaleDateString(
                  "ru-RU",
                  { day: "numeric", month: "long", year: "numeric" },
                )}
                aria-pressed={value === date}
                aria-current={date === today ? "date" : undefined}
                tabIndex={date === focused ? 0 : -1}
                onFocus={() => setFocused(date)}
                onClick={() => choose(date)}
                onKeyDown={(event) => {
                  const delta: Record<string, number> = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  };
                  let next = "";
                  if (event.key in delta)
                    next = shiftDate(date, delta[event.key]!);
                  else if (event.key === "Home")
                    next = shiftDate(
                      date,
                      -((new Date(date + "T12:00:00").getDay() + 6) % 7),
                    );
                  else if (event.key === "End")
                    next = shiftDate(
                      date,
                      6 - ((new Date(date + "T12:00:00").getDay() + 6) % 7),
                    );
                  else if (event.key === "PageUp" || event.key === "PageDown")
                    next = moveCalendar(
                      date,
                      "Месяц",
                      event.key === "PageUp" ? -1 : 1,
                    );
                  else if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                    return;
                  }
                  if (next) {
                    event.preventDefault();
                    focusPending.current = true;
                    setMonth(next);
                    setFocused(next);
                  }
                }}
              >
                {Number(date.slice(-2))}
              </button>
            ))}
          </div>
          <footer>
            <button
              type="button"
              disabled={disabled}
              onClick={() => choose("")}
            >
              Без даты
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => choose(today)}
            >
              Сегодня
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
