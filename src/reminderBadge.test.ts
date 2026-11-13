import { expect, it } from "vitest";
import { newTask } from "./domain";
import { reminderBadge } from "./reminderBadge";

it("отмечает будущее напоминание и меняет значок после наступления времени, в том числе после сна", () => {
  const tasks = [{ ...newTask(), reminder: "2026-10-14T12:00:00+03:00" }];
  expect(reminderBadge(tasks, Date.parse("2026-10-14T08:59:00Z"))).toBe(
    "upcoming",
  );
  expect(reminderBadge(tasks, Date.parse("2026-10-14T09:00:00Z"))).toBe("due");
  expect(reminderBadge(tasks, Date.parse("2026-10-15T09:00:00Z"))).toBe("due");
});
it("не показывает значок для выполненных дел, отсутствующего или неверного времени", () => {
  expect(
    reminderBadge(
      [
        newTask(),
        { ...newTask(), reminder: "bad" },
        { ...newTask(), status: "done", reminder: "2020-01-01T00:00:00Z" },
      ],
      Date.now(),
    ),
  ).toBeNull();
});
it("сфера получает заметный значок, если хотя бы одно напоминание уже наступило", () => {
  const tasks = [
    { ...newTask(), reminder: "2026-10-14T08:00:00Z" },
    { ...newTask(), reminder: "2026-10-16T08:00:00Z" },
  ];
  expect(reminderBadge(tasks, Date.parse("2026-10-14T09:00:00Z"))).toBe("due");
  expect(
    reminderBadge(
      tasks.map((task) => ({ ...task, reminder: "" })),
      Date.now(),
    ),
  ).toBeNull();
});
