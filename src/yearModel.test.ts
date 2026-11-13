import { expect, it } from "vitest";
import { yearDates, yearIndex, moveYear, snapQuarter } from "./yearModel";
import { asFact, newTask } from "./domain";
it("строит полный год с високосным февралем", () => {
  expect(yearDates(2026)).toHaveLength(365);
  expect(yearDates(2028)).toHaveLength(366);
  expect(yearDates(2028)).toContain("2028-02-29");
  expect(moveYear("2028-02-29", 1)).toBe("2029-02-28");
});
it("годовой Гант учитывает интервалы, повторения и исключает факты", () => {
  const task = {
    ...newTask(),
    title: "Проект",
    start: "2026-12-29",
    due: "2027-01-03",
  };
  const repeat = {
    ...newTask(),
    title: "Каждый день",
    due: "2027-01-01",
    repeat: "daily" as const,
    repeatUntil: "2027-01-02",
  };
  const fact = asFact({ ...newTask(), title: "Справка" });
  const index = yearIndex([task, repeat, fact], 2027);
  expect(index.get("2027-01-01")).toHaveLength(2);
  expect(index.get("2027-01-02")).toHaveLength(2);
  expect(index.get("2027-01-03")).toHaveLength(1);
  expect(index.get("2027-01-04")).toHaveLength(0);
  expect([...index.values()].flat().some((t) => t.kind === "fact")).toBe(false);
});
it("переносит с шагом 15 минут внутри суток", () => {
  expect(snapQuarter(602)).toBe(600);
  expect(snapQuarter(609)).toBe(615);
  expect(snapQuarter(-40)).toBe(0);
  expect(snapQuarter(1450)).toBe(1425);
});
