import { describe, expect, it } from "vitest";
import { densityFor, layoutDay, minuteOf, timeOf } from "./daySchedule";
import { moveTaskTime, newTask, validateTask } from "./domain";

const at = (id: string, dueTime: string, minutes = 0) => ({
  ...newTask(),
  id,
  title: id,
  due: "2026-10-23",
  dueTime,
  minutes,
});

describe("масштаб и раскладка дня", () => {
  it("переводит время в минуты и обратно", () => {
    expect(minuteOf("13:45")).toBe(825);
    expect(timeOf(825)).toBe("13:45");
    expect(timeOf(0)).toBe("00:00");
  });
  it("меняет плотность от подробных карточек до тонких плашек", () => {
    expect(densityFor(88)).toBe("full");
    expect(densityFor(50)).toBe("line");
    expect(densityFor(16)).toBe("thin");
  });
  it("ставит дело по времени и длительности", () => {
    const [placed] = layoutDay([at("a", "10:30", 90)], 60);
    expect(placed).toMatchObject({ top: 630, height: 90, columns: 1 });
  });
  it("разводит пересекающиеся дела по колонкам, не трогая отдельные", () => {
    const placed = layoutDay(
      [at("a", "10:00", 60), at("b", "10:30", 60), at("c", "12:00", 30)],
      60,
    );
    const byId = Object.fromEntries(placed.map((p) => [p.task.id, p]));
    expect(byId.a).toMatchObject({ column: 0, columns: 2 });
    expect(byId.b).toMatchObject({ column: 1, columns: 2 });
    expect(byId.c).toMatchObject({ column: 0, columns: 1 });
  });
  it("учитывает минимальную высоту карточки при подробном масштабе", () => {
    // 15 минут при 88 px/час — 22 px, но карточка занимает 64 px.
    const placed = layoutDay([at("a", "09:00", 15), at("b", "09:30")], 88);
    expect(placed.map((p) => p.column)).toEqual([0, 1]);
    expect(
      layoutDay([at("a", "09:00", 15), at("b", "09:30")], 16).map(
        (p) => p.column,
      ),
    ).toEqual([0, 0]);
  });
});

describe("перенос дела внутри дня", () => {
  it("сдвигает напоминание вместе со временем", () => {
    const task = {
      ...at("a", "15:00"),
      reminder: new Date(2026, 9, 23, 14, 0).toISOString(),
    };
    const moved = moveTaskTime(task, "17:30");
    expect(moved.dueTime).toBe("17:30");
    expect(new Date(moved.reminder).getHours()).toBe(16);
    expect(new Date(moved.reminder).getMinutes()).toBe(30);
    expect(moved.due).toBe(task.due);
    expect(() => validateTask(moved)).not.toThrow();
  });
  it("не добавляет напоминание и не переносит дело без времени", () => {
    expect(moveTaskTime(at("a", "08:00"), "09:15").reminder).toBe("");
    expect(() =>
      moveTaskTime({ ...at("a", ""), dueTime: "" }, "09:00"),
    ).toThrow();
  });
});
