import { describe, it, expect } from "vitest";
import {
  emptyData,
  newTask,
  saveTask,
  removeProject,
  dueReminders,
  deliveryKey,
  planDay,
  shiftDate,
  daysBetween,
  areas,
  areaLabel,
  getAreas,
  type Area,
} from "./domain";
describe("операции с данными", () => {
  it("сохраняет дела во всех сферах и отклоняет неизвестную сферу", () => {
    let data = emptyData();
    for (const area of areas)
      data = saveTask(data, { ...newTask(), title: area, area });
    expect(data.tasks.map((task) => areaLabel(task.area))).toEqual([
      "Работа",
      "Фриланс",
      "Квартира",
      "Еда",
      "Любовь",
      "Спорт",
      "Родные",
      "Здоровье",
      "Покупки",
      "Финансы",
      "Учеба",
      "Преподавание",
      "Аспирантура",
      "Дни рождения",
    ]);
    expect(() =>
      saveTask(data, {
        ...newTask(),
        title: "Ошибка",
        area: "Несуществующая" as Area,
      }),
    ).toThrow();
    expect(data.tasks).toHaveLength(14);
  });
  it("сохраняет доступ к старым личным делам без автоматического переноса", () => {
    const legacy = {
      ...newTask(),
      title: "Старое дело",
      area: "Личное" as const,
    };
    const data = saveTask(emptyData(), legacy);
    expect(getAreas(data.tasks)).toContain("Личное");
    expect(getAreas([])).not.toContain("Личное");
    expect(data.tasks[0]?.area).toBe("Личное");
    expect(areaLabel("Учёба")).toBe("Учеба");
  });
  it("не меняет данные при ошибке и не теряет несвязанные задачи", () => {
    const d = emptyData();
    const task = { ...newTask(), title: "Курсовая" };
    const next = saveTask(d, task);
    expect(d.tasks).toHaveLength(0);
    expect(next.tasks).toHaveLength(1);
    expect(() =>
      saveTask(next, { ...task, start: "2026-10-20", due: "2026-10-19" }),
    ).toThrow();
    expect(next.tasks[0]?.start).toBe("");
    expect(saveTask(next, { ...task, status: "done" }).tasks).toHaveLength(1);
  });
  it("удаление проекта сохраняет его задачи и заметки во входящих", () => {
    const d = {
      ...emptyData(),
      projects: [{ id: "p", name: "Проект", area: "Учёба" as const }],
      notes: [{ id: "n", title: "Материалы", body: "Текст", projectId: "p" }],
      tasks: [{ ...newTask(), title: "Задача", projectId: "p" }],
    };
    const next = removeProject(d, "p");
    expect(next.tasks[0]?.projectId).toBeNull();
    expect(next.notes[0]?.body).toBe("Текст");
    expect(next.notes[0]?.projectId).toBeNull();
  });
  it("отвергает несуществующие даты и потерянный проект", () => {
    expect(() =>
      saveTask(emptyData(), { ...newTask(), title: "А", due: "2026-02-30" }),
    ).toThrow();
    expect(() =>
      saveTask(emptyData(), { ...newTask(), title: "А", projectId: "missing" }),
    ).toThrow();
  });
});
describe("напоминания", () => {
  it("находит пропущенные после сна, исключает выполненные и доставленные", () => {
    const t = {
      ...newTask(),
      title: "Встреча",
      reminder: "2026-10-12T09:00:00Z",
    };
    expect(
      dueReminders([t], new Set(), Date.parse("2026-10-12T12:00:00Z")),
    ).toHaveLength(1);
    expect(
      dueReminders(
        [t],
        new Set([deliveryKey(t)]),
        Date.parse("2026-10-12T12:00:00Z"),
      ),
    ).toHaveLength(0);
    expect(
      dueReminders(
        [{ ...t, status: "done" }],
        new Set(),
        Date.parse("2026-10-12T12:00:00Z"),
      ),
    ).toHaveLength(0);
  });
  it("отложенное напоминание получает новый ключ; будущие не приходят раньше", () => {
    const t = { ...newTask(), title: "А", reminder: "2026-10-12T09:00:00Z" };
    const later = { ...t, reminder: "2026-10-12T10:00:00Z" };
    expect(
      dueReminders(
        [later],
        new Set([deliveryKey(t)]),
        Date.parse("2026-10-12T09:30:00Z"),
      ),
    ).toHaveLength(0);
    expect(
      dueReminders(
        [later],
        new Set([deliveryKey(t)]),
        Date.parse("2026-10-12T10:30:00Z"),
      ),
    ).toHaveLength(1);
  });
  it("сравнивает абсолютное время при разных поясах", () => {
    const t = {
      ...newTask(),
      title: "А",
      reminder: "2026-10-12T12:00:00+03:00",
    };
    expect(
      dueReminders([t], new Set(), Date.parse("2026-10-12T09:00:00Z")),
    ).toHaveLength(1);
  });
});
describe("планирование и календарь", () => {
  it("не превышает бюджет и не назначает задачи без оценки", () => {
    const tasks = [
      { ...newTask(), title: "Срочное", due: "2026-10-12", minutes: 40 },
      { ...newTask(), title: "Большое", minutes: 120 },
      { ...newTask(), title: "Не оценено" },
      { ...newTask(), title: "Позже", start: "2026-10-14", minutes: 10 },
    ];
    expect(planDay(tasks, "2026-10-12", 60).map((x) => x.title)).toEqual([
      "Срочное",
    ]);
    expect(tasks[0]?.start).toBe("");
  });
  it("корректно переходит через границу года", () => {
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-12-31", "2027-01-02")).toBe(2);
  });
});
