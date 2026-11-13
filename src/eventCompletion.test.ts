import { describe, it, expect } from "vitest";
import {
  emptyData,
  newTask,
  saveTask,
  completeTask,
  applyTaskEdit,
  type Task,
} from "./domain";
const event = (repeat = false): Task => ({
  ...newTask(),
  title: "Событие",
  kind: "event",
  start: "2026-10-29",
  due: "2026-10-29",
  startTime: "10:00",
  dueTime: "11:00",
  repeat: repeat ? "weekly" : undefined,
});
describe("events cannot be completed", () => {
  for (const repeat of [false, true]) {
    it(
      "rejects completing " +
        (repeat ? "a recurring event" : "an event") +
        " without changing its data",
      () => {
        const task = event(repeat),
          data = saveTask(emptyData(), task);
        expect(() => completeTask(data, task.id)).toThrow(
          "Событие нельзя выполнить",
        );
        expect(() =>
          applyTaskEdit(data, { ...task, status: "done" }, task.due),
        ).toThrow("Событие нельзя выполнить");
        expect(data.tasks[0]).toEqual(task);
      },
    );
  }
  it("still saves event details and completes ordinary tasks", () => {
    const t = event();
    let data = saveTask(emptyData(), t);
    data = applyTaskEdit(data, { ...t, title: "Обновлённое событие" });
    expect(data.tasks[0]?.status).toBe("todo");
    expect(data.tasks[0]?.startTime).toBe("10:00");
    const task = { ...newTask(), title: "Обычное дело" };
    data = saveTask(data, task);
    expect(
      completeTask(data, task.id).tasks.find((t) => t.id === task.id)?.status,
    ).toBe("done");
  });
});
