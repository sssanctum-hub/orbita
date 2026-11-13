import { describe, it, expect } from "vitest";
import { parseVoiceTask } from "./voiceTask";
import { newTask, validateTask } from "./domain";

// Пятница, 23 октября 2026, 10:00 по местному времени.
const now = new Date(2026, 9, 23, 10, 0);
const parse = (text: string, areas: string[] = []) =>
  parseVoiceTask(text, areas, now);
const local = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

describe("голосовой ввод дела", () => {
  it("оставляет фразу без дат названием дела", () => {
    expect(parse("купить молоко")).toEqual({
      title: "Купить молоко",
      due: "",
      dueTime: "",
      reminder: "",
    });
  });
  it("распознаёт сегодня, завтра и послезавтра со временем", () => {
    expect(parse("завтра в 18:30 позвонить маме")).toMatchObject({
      title: "Позвонить маме",
      due: "2026-10-24",
      dueTime: "18:30",
    });
    expect(parse("Послезавтра сдать отчёт")).toMatchObject({
      title: "Сдать отчёт",
      due: "2026-10-25",
    });
  });
  it("понимает время с утра/дня/вечера и словами", () => {
    expect(parse("встреча в 6 вечера").dueTime).toBe("18:00");
    expect(parse("встреча в три часа дня").dueTime).toBe("15:00");
    expect(parse("зарядка в 7 утра").dueTime).toBe("07:00");
    expect(parse("обед в полдень").dueTime).toBe("12:00");
    expect(parse("завтра вечером кино")).toMatchObject({
      title: "Кино",
      due: "2026-10-24",
      dueTime: "19:00",
    });
  });
  it("переносит прошедшее время без даты на завтра", () => {
    expect(parse("выпить таблетку в 9:00")).toMatchObject({
      due: "2026-10-24",
      dueTime: "09:00",
    });
    expect(parse("выпить таблетку в 11:00").due).toBe("2026-10-23");
  });
  it("не принимает число внутри названия за время", () => {
    expect(parse("подготовить урок в 9 классе")).toMatchObject({
      title: "Подготовить урок в 9 классе",
      dueTime: "",
    });
  });
  it("распознаёт дату с месяцем и переносит прошедшую на следующий год", () => {
    expect(parse("15 ноября оплатить интернет")).toMatchObject({
      title: "Оплатить интернет",
      due: "2026-11-15",
    });
    expect(parse("1 марта поздравить коллег").due).toBe("2027-03-01");
    expect(parse("31 февраля что-то").due).toBe("");
    expect(parse("сдать проект 05.12").due).toBe("2026-12-05");
  });
  it("распознаёт дни недели, включая следующую неделю", () => {
    expect(parse("в понедельник планёрка").due).toBe("2026-10-26");
    expect(parse("в пятницу бассейн").due).toBe("2026-10-30");
    expect(parse("в следующую среду врач").due).toBe("2026-10-28");
    expect(parse("в следующую субботу дача").due).toBe("2026-10-31");
    expect(parse("в эту субботу дача").due).toBe("2026-10-24");
    expect(parse("в воскресенье уборка").due).toBe("2026-10-25");
  });
  it("распознаёт «через» дни, недели и часы", () => {
    expect(parse("через 3 дня забрать посылку").due).toBe("2026-10-26");
    expect(parse("через неделю отчёт").due).toBe("2026-10-30");
    expect(parse("через два часа созвон")).toMatchObject({
      title: "Созвон",
      due: "2026-10-23",
      dueTime: "12:00",
    });
  });
  it("ставит напоминание на время дела", () => {
    const task = parse("напомни мне завтра в 9 утра позвонить врачу");
    expect(task.title).toBe("Позвонить врачу");
    expect(local(task.reminder)).toBe("2026-10-24 09:00");
  });
  it("ставит напоминание заранее и через относительное время", () => {
    expect(
      local(parse("завтра в 15:00 встреча, напомни за час").reminder),
    ).toBe("2026-10-24 14:00");
    expect(
      local(parse("напомни за день 15 ноября оплатить интернет").reminder),
    ).toBe("2026-11-14 09:00");
    expect(
      local(parse("напомни через 30 минут выключить духовку").reminder),
    ).toBe("2026-10-23 10:30");
  });
  it("без даты не ставит напоминание и не теряет слово «за» в названии", () => {
    expect(parse("напомни купить хлеб")).toMatchObject({
      title: "Купить хлеб",
      reminder: "",
    });
    expect(parse("съездить за продуктами завтра").title).toBe(
      "Съездить за продуктами",
    );
  });
  it("убирает служебные слова в начале", () => {
    expect(parse("добавь задачу нужно починить кран").title).toBe(
      "Починить кран",
    );
    expect(parse("надо купить подарок").title).toBe("Купить подарок");
    expect(parse("напомни что надо забрать ключи").title).toBe("Забрать ключи");
  });
  it("выбирает сферу по названию в любой форме", () => {
    const areas = ["Работа", "Покупки", "Учёба"];
    expect(parse("в сферу работа написать отчёт", areas)).toMatchObject({
      title: "Написать отчёт",
      area: "Работа",
    });
    expect(parse("купить хлеб в сфере покупок", areas)).toMatchObject({
      title: "Купить хлеб",
      area: "Покупки",
    });
    expect(parse("сфера учеба прочитать главу", areas).area).toBe("Учёба");
    expect(parse("купить хлеб", areas).area).toBeUndefined();
  });
  it("даёт поля, которые проходят проверку дела", () => {
    for (const phrase of [
      "напомни мне завтра в 9 утра позвонить врачу",
      "через два часа созвон",
      "в следующую среду в 14:15 врач, напомни за 30 минут",
    ])
      expect(() =>
        validateTask({ ...newTask(), ...parse(phrase) }),
      ).not.toThrow();
  });
  it("оставляет исходный текст, если после разбора ничего не осталось", () => {
    expect(parse("завтра в 10:00").title).toBe("завтра в 10:00");
  });
});
