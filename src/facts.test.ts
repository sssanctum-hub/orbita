import { expect, it } from "vitest";
import {
  asFact,
  newTask,
  emptyData,
  saveTask,
  completeTask,
  applyTaskEdit,
  dueReminders,
  reminderTimes,
  validateTask,
} from "./domain";
import { calendarIndex, calendarDates, tasksOn } from "./calendarModel";
import { daySchedule } from "./daySchedule";
import { prepareTaskDraft } from "./taskDraft";
it("превращает запись в факт без сроков, повторений и выполнения", () => {
  const fact = asFact({
    ...newTask(),
    title: "Размер окна",
    kind: "event",
    start: "2026-10-27",
    due: "2026-10-28",
    startTime: "09:00",
    dueTime: "10:00",
    reminder: "2026-10-27T08:00:00Z",
    repeat: "daily",
    status: "done",
  });
  expect(() => validateTask(fact)).not.toThrow();
  expect(fact.status).toBe("todo");
  expect(fact.due).toBe("");
  expect(fact.reminder).toBe("");
  expect(prepareTaskDraft(fact, "").kind).toBe("fact");
  const data = saveTask(emptyData(), fact);
  expect(() => completeTask(data, fact.id)).toThrow();
  expect(() => applyTaskEdit(data, { ...fact, status: "done" })).toThrow();
});
it("факт не попадает в календарь и напоминания даже со старыми полями", () => {
  const date = "2026-10-27";
  const fact = {
    ...asFact({ ...newTask(), title: "Факт" }),
    due: date,
    reminder: date + "T09:00:00Z",
  };
  expect(tasksOn([fact], date)).toEqual([]);
  expect(daySchedule([fact], date, true)).toEqual({ timed: [], allDay: [] });
  expect(
    [...calendarIndex([fact], calendarDates(date, "Месяц")).values()].flat(),
  ).toEqual([]);
  expect(
    dueReminders([fact], new Set(), Date.parse(date + "T12:00:00Z")),
  ).toEqual([]);
  expect(reminderTimes(fact, 0)).toEqual([]);
});
it("сохраняет вложения при смене типа и ограничивает число наклеек", () => {
  const image = {
    id: crypto.randomUUID(),
    name: "photo.jpg",
    width: 100,
    height: 100,
    thumbnail: "data:image/jpeg;base64,/9j/2Q==",
  };
  const task = {
    ...newTask(),
    title: "Снимки",
    images: [image],
    links: [{ id: "link", label: "Сайт", url: "https://example.com/" }],
  };
  expect(asFact(task).images).toEqual([image]);
  expect(prepareTaskDraft(task, "").links).toEqual(task.links);
  expect(() =>
    validateTask({
      ...task,
      images: Array.from({ length: 10 }, () => ({
        ...image,
        id: crypto.randomUUID(),
      })),
    }),
  ).not.toThrow();
  expect(() =>
    validateTask({
      ...task,
      images: Array.from({ length: 11 }, () => ({
        ...image,
        id: crypto.randomUUID(),
      })),
    }),
  ).toThrow(/10/);
  expect(() =>
    validateTask({
      ...task,
      links: [{ id: "x", label: "", url: "javascript:alert(1)" }],
    }),
  ).toThrow();
});
