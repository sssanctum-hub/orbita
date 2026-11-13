import { describe, it, expect } from "vitest";
import {
  addLifeArea,
  availableAreas,
  removeLifeArea,
  removeTask,
  saveTask,
  newTask,
  emptyData,
  applyTaskEdit,
  dueReminders,
} from "./domain";
import { sphereIcon, areaMiniatures } from "./areaAppearance";
describe("Удаление сфер и дел", () => {
  it("удаляет стандартную сферу и сохраняет это после сериализации", () => {
    const data = removeLifeArea(emptyData(), "Работа");
    expect(availableAreas(JSON.parse(JSON.stringify(data)))).not.toContain(
      "Работа",
    );
    expect(() => saveTask(data, { ...newTask(), title: "Дело" })).toThrow();
    const restored = addLifeArea(data, "работа", "work");
    expect(availableAreas(restored)).toContain("Работа");
    expect(restored.areaIcons?.["Работа"]).toBe("work");
  });
  it("требует перенос содержимого; сохраняет проекты, заметки, напоминания и связи", () => {
    let data = addLifeArea(emptyData(), "Сад", "flower");
    data = {
      ...data,
      projects: [{ id: "p", name: "Растения", area: "Сад" }],
      notes: [{ id: "n", title: "План", body: "детали", projectId: "p" }],
    };
    data = saveTask(data, {
      ...newTask(),
      id: "a",
      title: "Полить",
      area: "Сад",
      projectId: "p",
      reminder: "2026-10-15T09:00:00Z",
    });
    data = saveTask(data, {
      ...newTask(),
      id: "b",
      title: "Следом",
      dependsOn: ["a"],
    });
    expect(() => removeLifeArea(data, "Сад")).toThrow();
    const next = removeLifeArea(data, "Сад", "Квартира");
    expect(next.tasks[0]).toMatchObject({
      area: "Квартира",
      projectId: "p",
      reminder: "2026-10-15T09:00:00Z",
    });
    expect(next.projects[0]?.area).toBe("Квартира");
    expect(next.notes).toEqual(data.notes);
    expect(next.tasks[1]?.dependsOn).toEqual(["a"]);
    expect(availableAreas(next)).not.toContain("Сад");
  });
  it("удаляет дело с напоминанием и очищает ссылки на него", () => {
    const a = {
      ...newTask(),
      id: "a",
      title: "Первое",
      reminder: "2026-10-15T09:00:00Z",
    };
    const data = {
      ...emptyData(),
      tasks: [a, { ...newTask(), id: "b", title: "Второе", dependsOn: ["a"] }],
    };
    const next = removeTask(data, "a");
    expect(next.tasks.map((t) => t.id)).toEqual(["b"]);
    expect(next.tasks[0]?.dependsOn).toEqual([]);
    expect(
      dueReminders(next.tasks, new Set(), Date.parse("2026-10-16T00:00:00Z")),
    ).toEqual([]);
  });
  it("завершение убирает напоминание выбранной даты, сохраняя серию", () => {
    const a = {
      ...newTask(),
      id: "a",
      title: "Прогулка",
      repeat: "daily" as const,
      due: "2026-10-15",
      reminder: "2026-10-15T09:00:00Z",
    };
    const data = { ...emptyData(), tasks: [a] };
    const next = applyTaskEdit(data, { ...a, status: "done" });
    expect(next.tasks).toHaveLength(1);
    expect(next.tasks[0]?.repeatCompleted).toEqual(["2026-10-15"]);
    expect(
      dueReminders(next.tasks, new Set(), Date.parse("2026-10-15T10:00:00Z")),
    ).toEqual([]);
    expect(applyTaskEdit(next, { ...a, status: "done" }).tasks).toHaveLength(1);
    expect(dueReminders(next.tasks,new Set(),Date.parse("2026-10-16T10:00:00Z"))).toHaveLength(1);
  });
});
describe("Миниатюры", () => {
  it("сохраняет выбор и применяет его после повторного чтения данных", () => {
    const data = JSON.parse(
      JSON.stringify(addLifeArea(emptyData(), "Поездки", "travel")),
    );
    expect(sphereIcon("Поездки", data.areaIcons)).toBe(
      areaMiniatures.find((i) => i.id === "travel")?.icon,
    );
  });
  it("неизвестная миниатюра использует безопасную иконку", () =>
    expect(sphereIcon("Своя", { Своя: "missing" })).toBe(sphereIcon("Своя")));
});
