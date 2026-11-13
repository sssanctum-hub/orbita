import { expect, it } from "vitest";
import { newTask } from "./domain";
import { prepareTaskDraft } from "./taskDraft";

it("редактирование сохраняет идентичность и выполнение шагов, а также скрытые настройки", () => {
  const task = {
    ...newTask(),
    title: "  Встреча  ",
    projectId: "p",
    repeat: "weekly" as const,
    reminder: "2026-10-15T09:00:00Z",
    dependsOn: ["other"],
    subtasks: [
      { id: "done", title: " Готовый шаг ", done: true },
      { id: "blank", title: " ", done: false },
      { id: "next", title: "Следующий", done: false },
    ],
  };
  const saved = prepareTaskDraft(task, "");
  expect(saved.title).toBe("Встреча");
  expect(saved.subtasks).toEqual([
    { id: "done", title: "Готовый шаг", done: true },
    { id: "next", title: "Следующий", done: false },
  ]);
  expect(saved).toMatchObject({
    projectId: "p",
    repeat: "weekly",
    reminder: task.reminder,
    dependsOn: ["other"],
  });
  expect(task.subtasks).toHaveLength(3);
  expect(task.title).toBe("  Встреча  ");
});

it("введённый шаг сохраняется, даже если перед сохранением не нажали плюс", () => {
  const task = {
    ...newTask(),
    title: "Дело",
    subtasks: [{ id: "existing", title: "Первый", done: true }],
  };
  const saved = prepareTaskDraft(task, "  Второй  ");
  expect(saved.subtasks).toHaveLength(2);
  expect(saved.subtasks[1]).toMatchObject({ title: "Второй", done: false });
  expect(saved.subtasks[1]?.id).not.toBe("existing");
  expect(prepareTaskDraft(task, "  ").subtasks).toHaveLength(1);
});
