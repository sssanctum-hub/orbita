import {
  occurrencesBetween,
  seriesForCalendar,
  repeatsOn,
  occurrence,
} from "./series";
import {
  dayKey,
  shiftDate,
  birthdayDate,
  birthdayReminders,
  eventSpanDays,
  isEvent,
  type Task,
} from "./domain";

export type CalendarMode = "День" | "Неделя" | "Месяц" | "Гант";
export function calendarDates(anchor: string, mode: CalendarMode): string[] {
  const month = anchor.slice(0, 7) + "-01";
  const base = mode === "Месяц" ? month : anchor;
  const first =
    mode === "Месяц" || mode === "Неделя"
      ? shiftDate(base, -((new Date(base + "T12:00:00").getDay() + 6) % 7))
      : base;
  return Array.from(
    {
      length:
        mode === "Месяц"
          ? 42
          : mode === "Неделя"
            ? 7
            : mode === "Гант"
              ? 28
              : 1,
    },
    (_, i) => shiftDate(first, i),
  );
}
export function moveCalendar(
  anchor: string,
  mode: CalendarMode,
  step: number,
): string {
  if (mode !== "Месяц")
    return shiftDate(anchor, step * (mode === "День" ? 1 : 7));
  const month = new Date(anchor.slice(0, 7) + "-01T12:00:00");
  month.setMonth(month.getMonth() + step);
  return dayKey(month);
}
export function reminderOn(task: Task, date: string): boolean {
  if (task.birthday)
    return birthdayReminders(task, Number(date.slice(0, 4))).some(
      (item) => dayKey(new Date(item.at)) === date,
    );
  return (
    !!task.reminder &&
    Number.isFinite(Date.parse(task.reminder)) &&
    dayKey(new Date(task.reminder)) === date
  );
}
// Time used to order a day's entries: an event sorts by when its part of the day begins.
function timeKey(task: Task, date: string): string {
  if (isEvent(task) && task.startTime)
    return date === task.start ? task.startTime : "00:00";
  return task.dueTime || "99:99";
}
const covers = (task: Task, date: string) =>
  isEvent(task) && task.start <= date && date <= task.due;
export function tasksOn(tasks: Task[], date: string): Task[] {
  const reach = Math.max(
    0,
    ...tasks.filter((t) => t.repeat).map((t) => eventSpanDays(t)),
  );
  return occurrencesBetween(tasks, date, shiftDate(date, reach))
    .filter(
      (task) =>
        (task.birthday
          ? birthdayDate(task, Number(date.slice(0, 4))) === date
          : isEvent(task)
            ? covers(task, date)
            : task.due === date) || reminderOn(task, date),
    )
    .sort(
      (a, b) =>
        timeKey(a, date).localeCompare(timeKey(b, date)) ||
        Number(reminderOn(b, date)) - Number(reminderOn(a, date)) ||
        (a.reminder || "").localeCompare(b.reminder || "") ||
        a.title.localeCompare(b.title, "ru"),
    );
}

// Build one index for the displayed period; fixed dates and birthdays are indexed once.
export function calendarIndex(
  tasks: Task[],
  dates: string[],
): Map<string, Task[]> {
  const result = new Map(dates.map((date) => [date, [] as Task[]]));
  const years = [...new Set(dates.map((date) => Number(date.slice(0, 4))))];
  for (const task of seriesForCalendar(tasks)) {
    const reminders = new Set<string>();
    if (task.birthday) {
      for (const year of years)
        for (const item of birthdayReminders(task, year))
          reminders.add(dayKey(new Date(item.at)));
    } else if (task.reminder && Number.isFinite(Date.parse(task.reminder))) {
      reminders.add(dayKey(new Date(task.reminder)));
    }
    // Days of the window an event covers (an ordinary task: just its due date).
    const spanDays = (item: Task) => {
      const days: string[] = [];
      const first = dates[0]!,
        last = dates[dates.length - 1]!;
      for (
        let d = item.start > first ? item.start : first;
        d <= last && d <= item.due;
        d = shiftDate(d, 1)
      )
        days.push(d);
      return days;
    };
    if (task.repeat && !task.birthday && task.status !== "done") {
      // A repeat may end after the window but still start inside it.
      const reach = eventSpanDays(task);
      const last = shiftDate(dates[dates.length - 1]!, reach);
      for (let date = dates[0]!; date <= last; date = shiftDate(date, 1))
        if (repeatsOn(task, date)) {
          const item = occurrence(task, date);
          if (isEvent(item))
            for (const day of spanDays(item)) result.get(day)?.push(item);
          else result.get(date)?.push(item);
        }
    } else {
      const days = new Set(reminders);
      if (task.birthday)
        for (const year of years) days.add(birthdayDate(task, year));
      else if (isEvent(task) && task.start && task.due)
        for (const day of spanDays(task)) days.add(day);
      else if (task.due) days.add(task.due);
      for (const date of days) result.get(date)?.push(task);
    }
  }
  for (const [date, entries] of result) {
    const flags = new Map(entries.map((t) => [t, reminderOn(t, date)]));
    entries.sort(
      (a, b) =>
        timeKey(a, date).localeCompare(timeKey(b, date)) ||
        Number(flags.get(b)) - Number(flags.get(a)) ||
        (a.reminder || "").localeCompare(b.reminder || "") ||
        a.title.localeCompare(b.title, "ru"),
    );
  }
  return result;
}

export function calendarLoad(
  count: number,
): "empty" | "low" | "medium" | "high" {
  return count >= 5
    ? "high"
    : count >= 3
      ? "medium"
      : count >= 1
        ? "low"
        : "empty";
}
