import { expect, it } from "vitest";
import { orbitInset, orbitPressure } from "./orbitPressure";
it("резервирует небольшой зазор только на строке переключателя", () => {
  expect(orbitInset(100, 150, 380, 390, 400)).toBe(0);
  expect(orbitInset(330, 380, 380, 390, 400)).toBe(0);
  expect(orbitInset(370, 430, 380, 390, 400)).toBe(28);
  expect(orbitInset(370, 430, 340, 390, 400)).toBe(0);
});
it("ограничивает сужение и учитывает край длинной карточки", () => {
  expect(orbitPressure(100, 410, 380, 250, 390, 400)).toBeLessThan(1);
  expect(orbitPressure(370, 430, 380, 10, 390, 400)).toBe(0.65);
  expect(orbitPressure(370, 430, 380, 0, 390, 400)).toBe(1);
});
