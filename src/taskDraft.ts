import { normalizeRepeatSettings } from "./repeatSettings";
import { asFact, isFact, isEvent, nextBirthdayDate, type Task } from "./domain";

export function prepareTaskDraft(task: Task, pendingStep: string): Task {
  if (isFact(task)) return asFact({ ...task, title: task.title.trim() });
  const title = pendingStep.trim();
  const event = isEvent(task);
  const draft: Task = {
    ...task,
    title: task.title.trim(),
    dueTime: task.due && !task.birthday ? task.dueTime || "" : "",
    ...(task.birthday
      ? {
          due: nextBirthdayDate(task),
          birthday: {
            ...task.birthday,
            createdAt: task.birthday.createdAt || new Date().toISOString(),
          },
          repeat: "" as const,
          repeatInterval: undefined,
          repeatWeekdays: undefined,
          repeatDay: undefined,
          repeatAnchor: undefined,
          repeatUntil: "",
          repeatCount: undefined,
          start: "",
          reminder: "",
        }
      : {}),
    // An event has its own length: minutes belong to ordinary tasks only.
    ...(event
      ? {
          kind: "event" as const,
          startTime: task.startTime || "",
          minutes: 0,
        }
      : {}),
    subtasks: [
      ...task.subtasks
        .filter((step) => step.title.trim())
        .map((step) => ({ ...step, title: step.title.trim() })),
      ...(title ? [{ id: crypto.randomUUID(), title, done: false }] : []),
    ],
  };
  if (!event) {
    delete draft.kind;
    delete draft.startTime;
  }
  return normalizeRepeatSettings(draft);
}
