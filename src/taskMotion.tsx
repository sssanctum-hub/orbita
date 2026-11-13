import { createContext, useContext } from "react";
import type { Task } from "./domain";
export type TaskActions = {
  busy: boolean;
  act: (task: Task, date: string | undefined, remove: boolean) => Promise<void>;
  reorder: (ids: string[]) => Promise<void>;
};
export const TaskMotionContext = createContext<TaskActions>({
  busy: false,
  act: async () => {},
  reorder: async () => {},
});
export const useTaskActions = () => useContext(TaskMotionContext);
export type TaskOrigin = {
  element: WeakRef<HTMLElement>;
  rect: DOMRect;
  color: string;
  taskId: string;
};
let origin: TaskOrigin | null = null;
let capturedAt = 0;
export function captureTaskOrigin(taskId: string) {
  if (origin?.taskId === taskId && Date.now() - capturedAt < 250) return;
  capturedAt = Date.now();
  const focused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const candidates = [
    ...document.querySelectorAll<HTMLElement>("[data-task-id]"),
  ];
  const element =
    focused?.closest<HTMLElement>("[data-task-id]") ||
    candidates.find(
      (el) =>
        el.dataset.taskId === taskId && el.getBoundingClientRect().width > 0,
    ) ||
    document.querySelector<HTMLElement>(".dock-add");
  if (!element) {
    origin = null;
    return;
  }
  const surface =
    element.closest<HTMLElement>(".task-row-surface") ||
    element.closest<HTMLElement>(".day-placed") ||
    element;
  origin = {
    element: new WeakRef(surface),
    rect: surface.getBoundingClientRect(),
    color: getComputedStyle(surface).backgroundColor,
    taskId,
  };
}
export const taskOrigin = () => origin;
