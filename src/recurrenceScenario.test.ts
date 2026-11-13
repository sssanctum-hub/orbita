import { tasksOn } from "./calendarModel";
import { describe, it, expect } from "vitest";
import {
  newTask,
  nextOccurrence,
  completeTask,
  saveTask,
  emptyData,
  repeatPreview,
  validateTask,
} from "./domain";
const base = () => ({
  ...newTask(),
  title: "Тренировка",
  due: "2026-10-12",
  repeat: "weekly" as const,
});
describe("Настраиваемый сценарий повторения", () => {
  it("повторяет каждые три дня, переносит период и время напоминания", () => {
    const next = nextOccurrence({
      ...base(),
      repeat: "daily",
      repeatInterval: 3,
      start: "2026-10-11",
      reminder: new Date(2026, 9, 12, 9).toISOString(),
    });
    expect(next.due).toBe("2026-10-15");
    expect(next.start).toBe("2026-10-14");
    expect(new Date(next.reminder).getHours()).toBe(9);
  });
  it("повторяет пн/ср/пт раз в две недели от начала серии", () => {
    const first = { ...base(), repeatInterval: 2, repeatWeekdays: [0, 2, 4] };
    const second = nextOccurrence(first),
      third = nextOccurrence(second),
      fourth = nextOccurrence(third);
    expect([second.due, third.due, fourth.due]).toEqual([
      "2026-10-14",
      "2026-10-16",
      "2026-10-26",
    ]);
  });
  it("сохраняет выбранное число через короткий месяц и интервал", () => {
    let task = {
      ...base(),
      repeat: "monthly" as const,
      repeatInterval: 2,
      repeatDay: 31,
      due: "2026-12-31",
    };
    const feb = nextOccurrence(task);
    expect(feb.due).toBe("2027-02-28");
    expect(nextOccurrence(feb).due).toBe("2027-04-30");
  });
  it("заканчивает включительно и позволяет завершить последний экземпляр", () => {
    const task = {
      ...base(),
      repeat: "daily" as const,
      repeatUntil: "2026-10-13",
    };
    const data = completeTask(saveTask(emptyData(), task), task.id);
    expect(data.tasks).toHaveLength(1);
    expect(tasksOn(data.tasks,"2026-10-13")).toHaveLength(1);
    expect(tasksOn(data.tasks,"2026-10-14")).toHaveLength(0);
  });
  it("показывает те же даты, что фактически создаёт серия", () => {
    const task = {
      ...base(),
      repeatWeekdays: [1, 3],
      repeatUntil: "2026-10-20",
    };
    expect(repeatPreview(task)).toEqual([
      "2026-10-13",
      "2026-10-15",
      "2026-10-20",
    ]);
  });
  it("не перескакивает пропущенные дела к сегодняшней дате", () =>
    expect(
      nextOccurrence({ ...base(), repeat: "daily", due: "2020-01-01" }).due,
    ).toBe("2020-01-02"));
  it("проверяет интервал, дни и конец", () => {
    for (const patch of [
      { repeatInterval: 0 },
      { repeatInterval: 1.5 },
      { repeatInterval: 366 },
      { repeatWeekdays: [] },
      { repeatWeekdays: [7] },
      { repeatWeekdays: [1, 1] },
      { repeatUntil: "2026-10-01" },
      { repeatUntil: "2026-02-30" },
    ])
      expect(() => validateTask({ ...base(), ...patch })).toThrow();
  });
});
