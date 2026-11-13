import {
  birthdayDate,
  eventSpanDays,
  eventTimeLabel,
  isEvent,
  shiftDate,
  type Task,
} from "./domain";
import { occurrencesBetween } from "./series";

// A timed event drawn on one day of its interval. dueTime/minutes of the copy
// describe only that day's part; `source` is the real task to open or edit.
export type DaySegment = {
  source: Task;
  label: string;
  continuesBefore: boolean;
  continuesAfter: boolean;
};
export type DayEntry = Task & { segment?: DaySegment };

// Does the event (or a repeat of it) cover this date?
export const coversDate = (t: Task, date: string) =>
  isEvent(t) && t.start <= date && date <= t.due;

export function daySchedule(tasks: Task[], date: string, showDone = false) {
  // A repeating event may have started earlier than the day it ends on.
  const reach = Math.max(
    0,
    ...tasks.filter((t) => t.repeat).map((t) => eventSpanDays(t)),
  );
  const entries = occurrencesBetween(tasks, date, shiftDate(date, reach)).filter(
    (t) =>
      (showDone || t.status !== "done") &&
      (t.birthday
        ? birthdayDate(t, Number(date.slice(0, 4))) === date
        : isEvent(t)
          ? coversDate(t, date)
          : t.due === date),
  );
  const timed: DayEntry[] = [];
  const allDay: DayEntry[] = [];
  for (const t of entries) {
    if (isEvent(t)) {
      if (!t.startTime || !t.dueTime) {
        allDay.push(t);
        continue;
      }
      const from = date === t.start ? minuteOf(t.startTime) : 0;
      const to = date === t.due ? minuteOf(t.dueTime) : 1440;
      // An event that ends exactly at midnight leaves nothing on its last day.
      if (to <= from) continue;
      timed.push({
        ...t,
        dueTime: timeOf(from),
        minutes: to - from,
        segment: {
          source: t,
          label: eventTimeLabel(t, date),
          continuesBefore: date !== t.start,
          continuesAfter: date !== t.due,
        },
      });
    } else if (t.dueTime && !t.birthday) timed.push(t);
    else allDay.push(t);
  }
  timed.sort(
    (a, b) =>
      a.dueTime!.localeCompare(b.dueTime!) ||
      a.title.localeCompare(b.title, "ru"),
  );
  return { timed, allDay };
}

export const minuteOf = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const timeOf = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

// Hour heights in px: from a detailed list down to thin bars for the whole day.
export const DAY_ZOOM = { min: 20, max: 112, initial: 88 };
export type DensityMode = "full" | "line" | "thin";
export const densityFor = (hour: number): DensityMode =>
  hour >= 70 ? "full" : hour >= 40 ? "line" : "thin";
const minimumHeight = { full: 64, line: 32, thin: 8 };

export interface PlacedTask<T extends Task = Task> {
  task: T;
  top: number;
  height: number;
  column: number;
  columns: number;
}
// Places timed tasks by start and duration. Overlap is judged by the rendered
// height, so cards that grow past their duration never cover each other.
export function layoutDay<T extends Task>(
  timed: T[],
  hour: number,
): PlacedTask<T>[] {
  const min = minimumHeight[densityFor(hour)];
  const placed = timed
    .map((task) => {
      const top = (minuteOf(task.dueTime!) * hour) / 60;
      const height = Math.max(((task.minutes || 30) * hour) / 60, min);
      return { task, top, height, column: 0, columns: 1 };
    })
    .sort((a, b) => a.top - b.top);
  let cluster: PlacedTask[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    const columns = Math.max(1, ...cluster.map((p) => p.column + 1));
    for (const p of cluster) p.columns = columns;
  };
  for (const item of placed) {
    if (item.top >= clusterEnd && cluster.length) {
      close();
      cluster = [];
    }
    const ends: number[] = [];
    for (const p of cluster)
      ends[p.column] = Math.max(ends[p.column] ?? 0, p.top + p.height);
    let column = 0;
    while ((ends[column] ?? -Infinity) > item.top) column++;
    item.column = column;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.top + item.height);
  }
  if (cluster.length) close();
  return placed;
}

export type DayDisplayGroup = { entries: PlacedTask<DayEntry>[]; compact: boolean; top: number; height: number };
// Only overlapping rendered intervals share a row. Narrow rows use sphere bubbles.
export function dayDisplayGroups(placed: PlacedTask<DayEntry>[], availableWidth: number): DayDisplayGroup[] {
  const groups: DayDisplayGroup[] = [];
  for (const item of placed) {
    const compact = item.columns > 1 && availableWidth / item.columns < 160;
    const end = item.top + Math.max(item.height, compact ? 64 : 0);
    const last = groups[groups.length - 1];
    if (last && item.top < last.top + last.height) {
      last.entries.push(item);
      last.compact ||= compact;
      last.height = Math.max(last.height, end - last.top);
    } else groups.push({ entries: [item], compact, top: item.top, height: end - item.top });
  }
  return groups;
}
