import { isFact, dayKey, daysBetween, shiftDate, type Task } from "./domain";
export type CalendarOccurrence = Task & { occurrenceDate?: string };
export function repeatsOn(task: Task, date: string): boolean {
  if (
    !task.repeat ||
    !task.due ||
    date < task.due ||
    (task.repeatUntil && date > task.repeatUntil)
  )
    return false;
  const base = task.repeatAnchor || task.due,
    interval = task.repeatInterval || 1;
  if (interval < 1 || !Number.isInteger(interval)) return false;
  const delta = daysBetween(base, date);
  if (delta < 0) return false;
  if (task.repeat === "daily") return delta % interval === 0;
  const weekday = (d: string) => (new Date(d + "T12:00:00").getDay() + 6) % 7;
  if (task.repeat === "weekly") {
    const monday = shiftDate(base, -weekday(base));
    return (
      Math.floor(daysBetween(monday, date) / 7) % interval === 0 &&
      (task.repeatWeekdays || [weekday(task.due)]).includes(weekday(date))
    );
  }
  const a = new Date(base + "T12:00:00"),
    b = new Date(date + "T12:00:00");
  const months =
    (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  const day = Math.min(
    task.repeatDay || a.getDate(),
    new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate(),
  );
  return months >= 0 && months % interval === 0 && b.getDate() === day;
}
export function occurrence(task: Task, date: string): CalendarOccurrence {
  const delta = daysBetween(task.due, date);
  let reminder = task.reminder;
  if (reminder) {
    const d = new Date(reminder);
    d.setDate(d.getDate() + delta);
    reminder = d.toISOString();
  }
  return {
    ...task,
    occurrenceDate: date,
    due: date,
    start: task.start ? shiftDate(task.start, delta) : "",
    reminder,
    status: task.repeatCompleted?.includes(date) ? "done" : "todo",
  };
}
export function seriesForCalendar(tasks: Task[]): Task[] {
  // Earlier copies made by 1.0 are history; only the last copy generates a series.
  const parents = new Set(tasks.map((t) => t.previousId).filter(Boolean));
  return tasks
    .filter((t) => !isFact(t))
    .map((t) => (parents.has(t.id) ? { ...t, repeat: "" as const } : t));
}
export function occurrencesBetween(
  tasks: Task[],
  from: string,
  to: string,
): CalendarOccurrence[] {
  return seriesForCalendar(tasks).flatMap((task) => {
    if (!task.repeat || task.birthday || task.status === "done") return [task];
    const result: CalendarOccurrence[] = [];
    for (let date = from; date <= to; date = shiftDate(date, 1))
      if (repeatsOn(task, date)) result.push(occurrence(task, date));
    return result;
  });
}
export function firstPendingDate(task: Task, now = new Date()): string {
  const from = dayKey(now) > task.due ? dayKey(now) : task.due;
  // Long intervals (up to 365 months) are valid too.
  for (let d = from, n = 0; n < 134000; n++, d = shiftDate(d, 1)) {
    if (task.repeatUntil && d > task.repeatUntil) break;
    if (repeatsOn(task, d) && !task.repeatCompleted?.includes(d)) return d;
  }
  return task.due;
}
