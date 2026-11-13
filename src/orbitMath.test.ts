import { describe, expect, it } from "vitest";
import { orbitOffset, wrapOrbitIndex } from "./orbitMath";

describe("зацикленная орбита", () => {
  it("переходит через границу в обе стороны и на несколько оборотов", () => {
    expect(wrapOrbitIndex(13, 13)).toBe(0);
    expect(wrapOrbitIndex(-1, 13)).toBe(12);
    expect(wrapOrbitIndex(40, 13)).toBe(1);
    expect(wrapOrbitIndex(-27, 13)).toBe(12);
  });
  it("сохраняет соседей рядом при проходе через конец списка", () => {
    expect(orbitOffset(0, 12, 13)).toBe(1);
    expect(orbitOffset(12, 0, 13)).toBe(-1);
    expect(orbitOffset(0, 12.5, 13)).toBeCloseTo(0.5);
    expect(orbitOffset(12, 12.5, 13)).toBeCloseTo(-0.5);
    expect(orbitOffset(0, 13, 13)).toBe(0);
  });
  it("не создаёт неверные индексы для пустой орбиты и одного дела", () => {
    expect(wrapOrbitIndex(-5, 0)).toBe(0);
    expect(wrapOrbitIndex(9, 1)).toBe(0);
    expect(orbitOffset(0, 0.5, 1)).toBe(0);
    expect(orbitOffset(0, 0, 0)).toBe(0);
  });
  it("показывает каждый объект малой орбиты один раз", () => {
    for (const count of [2, 3, 13]) {
      const offsets = Array.from({ length: count }, (_, i) =>
        orbitOffset(i, count - 0.5, count),
      );
      expect(new Set(offsets).size).toBe(count);
      expect(offsets.every((n) => Math.abs(n) <= count / 2)).toBe(true);
    }
  });
});
