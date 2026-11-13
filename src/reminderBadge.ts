import { reminderTimes, type Task } from "./domain";

export function reminderBadge(
  tasks: Task[],
  now: number,
): "due" | "upcoming" | null {
  const times = tasks.flatMap((task) => reminderTimes(task, now));
  if (!times.length) return null;
  return times.some((time) => time <= now) ? "due" : "upcoming";
}
