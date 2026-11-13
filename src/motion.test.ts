import { expect, it } from "vitest";
import { homeScreen, transitionKind } from "./navigation";

it("плавный переход только между днём и орбитой", () => {
  const orbit = { ...homeScreen, orbit: true };
  expect(transitionKind(homeScreen, orbit)).toBe("in");
  expect(transitionKind(orbit, homeScreen)).toBe("out");
  // dialogs on top of either screen keep the screen they sit on
  expect(transitionKind(homeScreen, { ...homeScreen, task: true })).toBe("none");
  expect(transitionKind(orbit, { ...orbit, area: "Спорт" })).toBe("none");
  expect(transitionKind(orbit, { ...orbit, task: true })).toBe("none");
});
