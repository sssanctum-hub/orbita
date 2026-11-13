import {
  dayKey,
  shiftDate,
  daysBetween,
  isEvent,
  isFact,
  type Task,
} from "./domain";
import { calendarIndex } from "./calendarModel";
import { occurrencesBetween } from "./series";
export function yearDates(year: number) {
  const first = year + "-01-01",
    last = year + "-12-31";
  return Array.from({ length: daysBetween(first, last) + 1 }, (_, i) =>
    shiftDate(first, i),
  );
}
export function yearIndex(tasks: Task[], year: number) {
  const dates = yearDates(year),
    index = calendarIndex(tasks, dates),
    first = dates[0]!,
    last = dates[dates.length - 1]!;
  const reach = Math.min(
    366,
    Math.max(
      0,
      ...tasks
        .filter((t) => t.repeat && t.start && t.due)
        .map((t) => daysBetween(t.start, t.due)),
    ),
  );
  for (const task of occurrencesBetween(tasks, first, shiftDate(last, reach))) {
    if (
      isFact(task) ||
      isEvent(task) ||
      task.birthday ||
      !task.start ||
      !task.due
    )
      continue;
    for (
      let date = task.start < first ? first : task.start;
      date <= last && date <= task.due;
      date = shiftDate(date, 1)
    ) {
      const entries = index.get(date)!;
      if (!entries.some((t) => t.id === task.id && t.due === task.due))
        entries.push(task);
    }
  }
  return index;
}
export function moveYear(date: string, step: number) {
  const d = new Date(date + "T12:00:00");
  const m = d.getMonth();
  d.setFullYear(d.getFullYear() + step);
  if (d.getMonth() !== m) d.setDate(0);
  return dayKey(d);
}
export const snapQuarter = (minute: number) =>
  Math.max(0, Math.min(1425, Math.round(minute / 15) * 15));
