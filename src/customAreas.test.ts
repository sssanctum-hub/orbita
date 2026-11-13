import { describe, it, expect } from "vitest";
import { addLifeArea, emptyData, getAreas, newTask, saveTask } from "./domain";
import { iconForArea } from "./areaAppearance";
import { homeScreen, parentScreen } from "./navigation";
describe("Свои сферы", () => {
  it("сохраняет пустую сферу отдельно от дел", () => {
    const data = addLifeArea(emptyData(), "  Путешествия  ");
    const restored = JSON.parse(JSON.stringify(data));
    expect(
      getAreas(
        restored.tasks,
        restored.customAreas.map((area: string) => ({ area })),
      ),
    ).toContain("Путешествия");
    expect(restored.tasks).toEqual([]);
    expect(
      saveTask(restored, {
        ...newTask(),
        area: "Путешествия",
        title: "Маршрут",
      }).customAreas,
    ).toEqual(["Путешествия"]);
  });
  it("отклоняет пустые, длинные и повторяющиеся имена", () => {
    for (const name of [" ", "x".repeat(41), "работа", "Учеба"])
      expect(() => addLifeArea(emptyData(), name)).toThrow();
    expect(() =>
      addLifeArea(addLifeArea(emptyData(), "Мой сад"), "мой   сад"),
    ).toThrow();
  });
  it("не принимает незарегистрированную сферу; необычные имена имеют безопасную иконку", () => {
    expect(() =>
      saveTask(emptyData(), { ...newTask(), area: "Новое", title: "Дело" }),
    ).toThrow();
    expect(typeof iconForArea("__proto__")).not.toBe("undefined");
  });
});
describe("Назад", () => {
  it("закрывает вложенные экраны по одному", () => {
    let s: import("./navigation").Screen = {
      ...homeScreen,
      area: "Спорт",
      calendar: true,
      task: true,
    };
    s = parentScreen(s);
    expect(s).toMatchObject({ area: "Спорт", calendar: true, task: false });
    s = parentScreen(s);
    expect(s).toMatchObject({ area: "Спорт", calendar: false });
    expect(parentScreen(s)).toEqual(homeScreen);
  });
  it("сначала закрывает создание сферы", () =>
    expect(parentScreen({ ...homeScreen, addArea: true })).toEqual(homeScreen));
});
