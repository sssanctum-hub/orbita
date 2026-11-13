import { describe, it, expect } from "vitest";
import {
  newTask,
  emptyData,
  saveTask,
  applyTaskEdit,
  removeTask,
} from "./domain";
import { tasksOn } from "./calendarModel";
import { occurrencesBetween } from "./series";
const football = () => ({
  ...newTask(),
  title: "Футбол",
  due: "2026-10-15",
  dueTime: "19:30",
  repeat: "weekly" as const,
  repeatWeekdays: [3],
});
describe("серия сразу в календаре", () => {
  it("показывает футбол по всем четвергам в 19:30 без завершения первого", () => {
    const t = football();
    const dates = occurrencesBetween([t], "2026-10-15", "2026-11-13");
    expect(dates.map((x) => x.due)).toEqual([
      "2026-10-15",
      "2026-10-22",
      "2026-10-29",
      "2026-11-05",
      "2026-11-12",
    ]);
    expect(dates.every((x) => x.dueTime === "19:30")).toBe(true);
    expect(tasksOn([t], "2038-06-03")).toHaveLength(1);
    expect(tasksOn([t], "2026-10-23")).toHaveLength(0);
    expect(tasksOn([t], "2026-10-08")).toHaveLength(0);
  });
  it("завершает только выбранную дату без создания копий", () => {
    const t = football();
    let d = saveTask(emptyData(), t);
    d = applyTaskEdit(d, { ...t, status: "done" }, "2026-10-22");
    expect(d.tasks).toHaveLength(1);
    expect(tasksOn(d.tasks, "2026-10-22")[0]?.status).toBe("done");
    expect(tasksOn(d.tasks, "2026-10-29")[0]?.status).toBe("todo");
    d = applyTaskEdit(d, { ...d.tasks[0]!, status: "todo" }, "2026-10-22");
    expect(tasksOn(d.tasks, "2026-10-22")[0]?.status).toBe("todo");
  });
  it("редактирует и удаляет все будущие вхождения серии", () => {
    const t = football();
    let d = saveTask(emptyData(), t);
    d = applyTaskEdit(d, { ...t, dueTime: "20:00", repeatWeekdays: [4] });
    expect(tasksOn(d.tasks, "2026-10-22")).toHaveLength(0);
    expect(tasksOn(d.tasks, "2026-10-23")[0]?.dueTime).toBe("20:00");
    expect(tasksOn(removeTask(d, t.id).tasks, "2038-06-03")).toHaveLength(0);
  });
  it("соблюдает интервал недель, несколько дней и включительное окончание", () => {
    const t = {
      ...football(),
      repeatInterval: 2,
      repeatWeekdays: [0, 3],
      repeatUntil: "2026-11-09",
    };
    expect(
      occurrencesBetween([t], "2026-10-15", "2026-11-30").map((x) => x.due),
    ).toEqual(["2026-10-15", "2026-10-26", "2026-10-29", "2026-11-09"]);
  });
  it("правильно считает месяцы с 31-м числом и ежедневный интервал", () => {
    const t = { ...football(), repeat: "monthly" as const, due: "2027-01-31" };
    expect(
      occurrencesBetween([t], "2027-01-01", "2027-04-30").map((x) => x.due),
    ).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
    expect(
      occurrencesBetween(
        [{ ...t, repeat: "daily", repeatInterval: 3 }],
        "2027-01-31",
        "2027-02-07",
      ).map((x) => x.due),
    ).toEqual(["2027-01-31", "2027-02-03", "2027-02-06"]);
  });
  it("сдвигает напоминание вместе с датой и не дублирует старую цепочку", () => {
    const t = {
      ...football(),
      status: "done" as const,
      reminder: "2026-10-15T16:00:00Z",
    };
    const next = {
      ...t,
      id: "next",
      previousId: t.id,
      status: "todo" as const,
      due: "2026-10-22",
      reminder: "2026-10-22T16:00:00Z",
    };
    expect(tasksOn([t, next], "2026-10-29")).toHaveLength(1);
    expect(tasksOn([next], "2026-10-29")[0]?.reminder).toBe(
      "2026-10-29T16:00:00.000Z",
    );
    expect(
      removeTask({ ...emptyData(), tasks: [t, next] }, next.id).tasks,
    ).toHaveLength(0);
  });
});
