import { it, expect } from "vitest";
import { calendarIndex, calendarDates, tasksOn } from "./calendarModel";
import { newTask, shiftDate } from "./domain";
import { visibleOrbitIndices, orbitOffset } from "./orbitMath";
import { latestQueue } from "./latestQueue";

it("индекс календаря сохраняет даты, порядок, повторы, дни рождения и историю", () => {
  const base = {
    ...newTask(),
    due: "2026-12-31",
    title: "Футбол",
    dueTime: "19:30",
    reminder: new Date(2026, 11, 30, 18).toISOString(),
  };
  const tasks = [
    base,
    {
      ...base,
      id: "weekly",
      repeat: "weekly" as const,
      repeatWeekdays: [3],
      repeatCompleted: ["2027-01-07"],
    },
    { ...base, id: "birthday", birthday: { month: 1, day: 1 } },
    { ...base, id: "undated", due: "" },
    { ...base, id: "monthly", repeat: "monthly" as const, repeatDay: 31 },
    { ...base, id: "old", repeat: "daily" as const },
    {
      ...base,
      id: "child",
      previousId: "old",
      repeat: "daily" as const,
      due: "2027-01-05",
    },
    { ...base, id: "done", status: "done" as const },
  ];
  const dates = calendarDates("2027-01-01", "Месяц");
  const index = calendarIndex(tasks, dates);
  for (const date of dates)
    expect(index.get(date)).toEqual(tasksOn(tasks, date));
});
it("орбита выбирает только видимые объекты на стыках и во время длинного жеста", () => {
  for (const count of [0, 1, 2, 7, 13, 10000])
    for (const position of [-100.35, -0.5, 0, 4.2, 13.6, 30000.2]) {
      const expected = Array.from({ length: count }, (_, i) => i).filter(
        (i) => Math.abs(orbitOffset(i, position, count)) <= 3.6,
      );
      expect(
        visibleOrbitIndices(position, count).sort((a, b) => a - b),
      ).toEqual(expected);
      expect(visibleOrbitIndices(position, count).length).toBeLessThanOrEqual(
        8,
      );
    }
});
it("фоновая очередь объединяет ожидающие изменения, не запускает параллельно и восстанавливается после ошибки", async () => {
  const calls: number[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const queue = latestQueue(async (value: number) => {
    calls.push(value);
    if (value === 1) await gate;
    if (value === 3) throw Error("native");
    return value;
  });
  const first = queue(1);
  const second = queue(2);
  const third = queue(3);
  const failures = Promise.allSettled([second, third]);
  expect(calls).toEqual([1]);
  release();
  expect(await first).toBe(1);
  expect((await failures).map((x) => x.status)).toEqual([
    "rejected",
    "rejected",
  ]);
  expect(calls).toEqual([1, 3]);
  expect(await queue(4)).toBe(4);
});
it("очередь сохраняет запрос разрешения из объединённых сохранений", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const seen: boolean[] = [];
  const queue = latestQueue(
    async (v: boolean) => {
      seen.push(v);
      if (seen.length === 1) await gate;
      return v;
    },
    (a, b) => a || b,
  );
  const one = queue(false),
    two = queue(true),
    three = queue(false);
  release();
  expect(await Promise.all([one, two, three])).toEqual([false, true, true]);
  expect(seen).toEqual([false, true]);
});
it("замер построения месяца для 600 дел (без ограничения времени теста)", () => {
  const dates = calendarDates("2026-10-16", "Месяц");
  const tasks = Array.from({ length: 600 }, (_, i) => ({
    ...newTask(),
    id: "bench-" + i,
    title: "Дело " + i,
    due: shiftDate("2026-01-01", i % 300),
    reminder: "",
    ...(i % 6 === 0
      ? { birthday: { month: (i % 12) + 1, day: (i % 27) + 1 } }
      : i % 3 === 0
        ? { repeat: "weekly" as const, repeatWeekdays: [3] }
        : {}),
  }));
  tasksOn(tasks, dates[0]!);
  calendarIndex(tasks, dates);
  const before = performance.now();
  const old = dates.map((date) => tasksOn(tasks, date));
  const oldMs = performance.now() - before;
  const after = performance.now();
  const index = calendarIndex(tasks, dates);
  const newMs = performance.now() - after;
  expect(dates.map((date) => index.get(date))).toEqual(old);
  console.log(
    JSON.stringify({
      scenario: "600 tasks, 42 days",
      previousMs: Math.round(oldMs),
      indexedMs: Math.round(newMs),
      ratio: Number((oldMs / newMs).toFixed(1)),
    }),
  );
});
