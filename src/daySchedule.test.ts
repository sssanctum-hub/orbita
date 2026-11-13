import { expect, it } from "vitest";
import { daySchedule } from "./daySchedule";
import { newTask } from "./domain";
import { homeScreen, parentScreen } from "./navigation";
it("главный экран — день; назад из сферы ведёт к орбите, затем ко дню", () => {
  expect(homeScreen.orbit).toBe(false);
  expect(homeScreen.calendar).toBe(false);
  expect(
    parentScreen({ ...homeScreen, orbit: true, area: "Спорт" }),
  ).toMatchObject({ orbit: true, area: null });
  expect(parentScreen({ ...homeScreen, orbit: true })).toEqual(homeScreen);
  expect(parentScreen({ ...homeScreen, task: true })).toEqual(homeScreen);
});
it("показывает только дела выбранного дня, сортирует часы и отделяет дела без времени", () => {
  const task = { ...newTask(), due: "2026-10-23" };
  const tasks = [
    { ...task, id: "evening", dueTime: "19:30" },
    { ...task, id: "midnight", dueTime: "00:00" },
    { ...task, id: "all" },
    {
      ...task,
      id: "tomorrow",
      due: "2026-10-24",
      reminder: new Date(2026, 9, 23, 9).toISOString(),
    },
    { ...task, id: "undated", due: "" },
    { ...task, id: "done", status: "done" as const },
  ];
  const schedule = daySchedule(tasks, "2026-10-23");
  expect(schedule.timed.map((t) => t.id)).toEqual(["midnight", "evening"]);
  expect(schedule.allDay.map((t) => t.id)).toEqual(["all"]);
  expect(
    daySchedule(tasks, "2026-10-23", true).allDay.map((t) => t.id),
  ).toEqual(["all", "done"]);
});
it("футбол по четвергам сохраняет время и открывает правильное вхождение", () => {
  const task = {
    ...newTask(),
    due: "2026-10-01",
    dueTime: "19:30",
    repeat: "weekly" as const,
    repeatWeekdays: [3],
    repeatCompleted: ["2026-10-22"],
  };
  expect(daySchedule([task], "2026-10-23").timed).toEqual([]);
  expect(daySchedule([task], "2026-10-29").timed[0]).toMatchObject({
    due: "2026-10-29",
    dueTime: "19:30",
    occurrenceDate: "2026-10-29",
  });
  expect(daySchedule([task], "2026-10-22").timed).toEqual([]);
  expect(daySchedule([task], "2026-10-22", true).timed[0]?.status).toBe("done");
});
it("день рождения виден в сам день без выдуманного времени", () => {
  const birthday = {
    ...newTask(),
    birthday: { month: 10, day: 23 },
    due: "2025-10-23",
  };
  expect(daySchedule([birthday], "2026-10-23").allDay).toHaveLength(1);
  expect(daySchedule([birthday], "2026-10-22").allDay).toEqual([]);
});
