import { expect, it } from "vitest";
import { newTask } from "./domain";
import {
  calendarDates,
  moveCalendar,
  reminderOn,
  tasksOn,
  calendarIndex,
  calendarLoad,
} from "./calendarModel";

it("цвет загрузки учитывает количество дел без дублирования напоминаний", () => {
  const date = "2026-10-26";
  for (const [count, color] of [
    [0, "empty"],
    [1, "low"],
    [2, "low"],
    [3, "medium"],
    [4, "medium"],
    [5, "high"],
    [20, "high"],
  ] as const) {
    const tasks = Array.from({ length: count }, () => ({
      ...newTask(),
      due: date,
      reminder: new Date(date + "T10:00:00").toISOString(),
    }));
    const entries = calendarIndex(tasks, [date]).get(date)!;
    expect(entries).toHaveLength(count);
    expect(calendarLoad(entries.length)).toBe(color);
  }
});

it("показывает полные недели месяца и корректно переходит через год", () => {
  const dates = calendarDates("2026-10-14", "Месяц");
  expect(dates).toHaveLength(42);
  expect(dates[0]).toBe("2026-09-28");
  expect(dates[41]).toBe("2026-11-08");
  expect(moveCalendar("2026-12-31", "Месяц", 1)).toBe("2027-01-01");
  expect(moveCalendar("2026-01-31", "Месяц", 1)).toBe("2026-02-01");
});
it("сохраняет дату при переключении режимов и строит неделю с понедельника", () => {
  expect(calendarDates("2026-10-14", "День")).toEqual(["2026-10-14"]);
  expect(calendarDates("2026-10-14", "Неделя")[0]).toBe("2026-10-12");
  expect(calendarDates("2026-10-14", "Гант")[0]).toBe("2026-10-14");
  expect(moveCalendar("2026-10-14", "Гант", -1)).toBe("2026-10-07");
});
it("не дублирует дело со сроком и напоминанием в один день и не теряет напоминание без срока", () => {
  const reminder = new Date(2026, 9, 14, 10, 0).toISOString();
  const first = {
    ...newTask(),
    title: "Со сроком",
    due: "2026-10-14",
    reminder,
  };
  const second = { ...newTask(), title: "Без срока", reminder };
  expect(tasksOn([first, second], "2026-10-14")).toHaveLength(2);
  expect(tasksOn([first, second], "2026-10-15")).toHaveLength(0);
  expect(reminderOn({ ...second, reminder: "bad" }, "2026-10-14")).toBe(false);
});
