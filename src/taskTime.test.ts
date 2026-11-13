import { describe, it, expect } from "vitest";
import {
  newTask,
  emptyData,
  saveTask,
  nextOccurrence,
  validateTask,
} from "./domain";
import { prepareTaskDraft } from "./taskDraft";
import { tasksOn } from "./calendarModel";
describe("время дела", () => {
  const base = () => ({
    ...newTask(),
    title: "Встреча",
    due: "2026-10-16",
    dueTime: "14:35",
    reminder: "2026-10-16T10:00:00Z",
  });
  it("хранит время отдельно от напоминания и сохраняет его при повторении", () => {
    const task = { ...base(), repeat: "daily" as const };
    expect(saveTask(emptyData(), task).tasks[0]?.dueTime).toBe("14:35");
    const next = nextOccurrence(task);
    expect(next.due).toBe("2026-10-17");
    expect(next.dueTime).toBe("14:35");
    expect(
      new Date(next.reminder).getTime() - new Date(task.reminder).getTime(),
    ).toBe(86400000);
  });
  it("принимает старые дела без времени, полночь и последнюю минуту дня", () => {
    for (const dueTime of [undefined, "", "00:00", "23:59"])
      expect(() => validateTask({ ...base(), dueTime })).not.toThrow();
  });
  it("отклоняет неверные часы и время без даты", () => {
    for (const dueTime of ["24:00", "12:60", "9:30", "-1:00"])
      expect(() => validateTask({ ...base(), dueTime })).toThrow();
    expect(() => validateTask({ ...base(), due: "" })).toThrow();
  });
  it("убирает время при выборе Без даты и у дней рождения", () => {
    expect(prepareTaskDraft({ ...base(), due: "" }, "").dueTime).toBe("");
    expect(
      prepareTaskDraft({ ...base(), birthday: { month: 10, day: 16 } }, "")
        .dueTime,
    ).toBe("");
  });
  it("упорядочивает дела дня по времени, оставляя дела без времени внизу", () => {
    const task = base();
    expect(
      tasksOn(
        [
          { ...task, id: "a", dueTime: "" },
          { ...task, id: "b", dueTime: "18:00" },
          { ...task, id: "c", dueTime: "08:00" },
        ],
        task.due,
      ).map((t) => t.id),
    ).toEqual(["c", "b", "a"]);
  });
});
