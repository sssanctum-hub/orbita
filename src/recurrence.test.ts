import { it, expect, describe } from "vitest";
import {
  newTask,
  emptyData,
  saveTask,
  completeTask,
  nextOccurrence,
  removeTask,
  applyTaskEdit,
  planDay,
} from "./domain";
describe("повторения", () => {
  it("отмечает дату серии без создания следующей копии", () => {
    const task = {
      ...newTask(),
      title: "Учёба",
      repeat: "weekly" as const,
      due: "2026-10-12",
    };
    const d = completeTask(saveTask(emptyData(), task), task.id);
    expect(d.tasks).toHaveLength(1);
    expect(d.tasks[0]?.repeatCompleted).toEqual(["2026-10-12"]);
    expect(completeTask(d, task.id).tasks).toHaveLength(1);
  });
  it("сохраняет 31-е число после короткого февраля", () => {
    const first = {
      ...newTask(),
      title: "Отчёт",
      repeat: "monthly" as const,
      due: "2027-01-31",
    };
    const feb = nextOccurrence(first);
    expect(feb.due).toBe("2027-02-28");
    expect(nextOccurrence(feb).due).toBe("2027-03-31");
  });
  it("завершение через форму сохраняет серию для будущих дат", () => {
    const task = {
      ...newTask(),
      title: "Привычка",
      repeat: "daily" as const,
      due: "2026-12-31",
      status: "done" as const,
    };
    const d = applyTaskEdit(emptyData(), task);
    expect(d.tasks).toHaveLength(1);
    expect(d.tasks[0]?.status).toBe("todo");
    expect(d.tasks[0]?.repeatCompleted).toEqual(["2026-12-31"]);
  });
  it("требует начальный срок", () => {
    expect(() =>
      saveTask(emptyData(), {
        ...newTask(),
        title: "Привычка",
        repeat: "daily",
      }),
    ).toThrow("срок");
  });
});
describe("зависимости", () => {
  it("не предлагает заблокированное дело, пока предшественник не завершён", () => {
    const a = { ...newTask(), title: "Подготовить материалы" },
      b = {
        ...newTask(),
        title: "Написать отчёт",
        minutes: 60,
        dependsOn: [a.id],
      };
    expect(planDay([a, b], "2026-10-12", 120)).toHaveLength(0);
    expect(
      planDay([{ ...a, status: "done" }, b], "2026-10-12", 120).map(
        (t) => t.title,
      ),
    ).toEqual(["Написать отчёт"]);
  });
  it("отвергает прямой и косвенный цикл без изменения данных", () => {
    const a = { ...newTask(), title: "А" },
      b = { ...newTask(), title: "Б", dependsOn: [a.id] };
    const d = saveTask(saveTask(emptyData(), a), b);
    expect(() => saveTask(d, { ...a, dependsOn: [b.id] })).toThrow("круг");
    expect(() => saveTask(d, { ...a, dependsOn: [a.id] })).toThrow("круг");
    expect(d.tasks[0]?.dependsOn).toBeUndefined();
  });
  it("блокирует завершение до предшественника и удаляет связи с удалённой задачей", () => {
    const a = { ...newTask(), title: "А" },
      b = { ...newTask(), title: "Б", dependsOn: [a.id] };
    const d = saveTask(saveTask(emptyData(), a), b);
    expect(() => completeTask(d, b.id)).toThrow("Сначала");
    expect(
      completeTask(completeTask(d, a.id), b.id).tasks.every(
        (t) => t.status === "done",
      ),
    ).toBe(true);
    expect(removeTask(d, a.id).tasks[0]?.dependsOn).toEqual([]);
  });
});
