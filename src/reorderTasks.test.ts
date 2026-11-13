import { describe, it, expect } from "vitest";
import { reorderTasks } from "./reorderTasks";
import { emptyData, newTask, asFact } from "./domain";
describe("visible task order", () => {
  it("reorders only visible slots and retains facts, dates and series unchanged", () => {
    const a = {
      ...newTask(),
      id: "a",
      title: "A",
      due: "2026-10-29",
      reminder: "2026-10-29T08:00:00Z",
    };
    const fact = asFact({ ...newTask(), id: "f", title: "Fact" });
    const b = {
      ...newTask(),
      id: "b",
      title: "B",
      repeat: "weekly" as const,
      due: "2026-10-29",
      repeatCompleted: ["2026-10-29"],
    };
    const other = { ...newTask(), id: "other", title: "Other", area: "Спорт" };
    const data = { ...emptyData(), tasks: [a, fact, b, other] };
    const next = reorderTasks(data, ["b", "a"]);
    expect(next.tasks).toEqual([b, fact, a, other]);
    expect(data.tasks).toEqual([a, fact, b, other]);
    expect(next.tasks[0]).toBe(b);
    expect(next.tasks[1]).toBe(fact);
  });
  it("rejects duplicates and deleted ids instead of losing records", () => {
    const data = {
      ...emptyData(),
      tasks: [{ ...newTask(), id: "a", title: "A" }],
    };
    expect(() => reorderTasks(data, ["a", "a"])).toThrow();
    expect(() => reorderTasks(data, ["missing"])).toThrow();
    expect(data.tasks).toHaveLength(1);
  });
});
