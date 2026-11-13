import { describe, it, expect } from "vitest";
import {
  newTask,
  birthdayDate,
  nextBirthdayDate,
  birthdayReminders,
  dueReminders,
  deliveryKey,
  validateTask,
} from "./domain";
import { tasksOn } from "./calendarModel";
import { reminderBadge } from "./reminderBadge";
const birthday = () => ({
  ...newTask(),
  title: "Анна",
  area: "Дни рождения",
  birthday: { month: 1, day: 5 },
  due: "2027-01-05",
});
describe("Дни рождения", () => {
  it("считает три местных напоминания, включая границу года", () => {
    const dates = birthdayReminders(birthday(), 2027)
      .filter(
        (i) =>
          i.at >= new Date(2026, 11, 1).toISOString() &&
          i.at < new Date(2027, 1, 1).toISOString(),
      )
      .map((i) => new Date(i.at));
    expect(
      dates.map((d) => [
        d.getFullYear(),
        d.getMonth() + 1,
        d.getDate(),
        d.getHours(),
      ]),
    ).toEqual([
      [2026, 12, 29, 9],
      [2027, 1, 4, 9],
      [2027, 1, 5, 9],
    ]);
  });
  it("повторяет ежегодно без завершения и не дублирует отправленные", () => {
    const task = birthday(),
      now = new Date(2027, 0, 5, 10).getTime();
    const due = dueReminders([task], new Set(), now);
    expect(due).toHaveLength(3);
    expect(dueReminders([task], new Set(due.map(deliveryKey)), now)).toEqual(
      [],
    );
    expect(
      dueReminders(
        [task],
        new Set(due.map(deliveryKey)),
        new Date(2028, 0, 5, 10).getTime(),
      ),
    ).toHaveLength(3);
  });
  it("догоняет пропущенные после сна, но не напоминает о давних датах", () => {
    expect(
      dueReminders([birthday()], new Set(), new Date(2027, 0, 7, 10).getTime()),
    ).toHaveLength(3);
    expect(
      dueReminders([birthday()], new Set(), new Date(2027, 2, 1, 10).getTime()),
    ).toEqual([]);
  });
  it("не отправляет события до создания записи", () => {
    const task = {
      ...birthday(),
      birthday: {
        month: 1,
        day: 5,
        createdAt: new Date(2027, 0, 5, 10).toISOString(),
      },
    };
    expect(
      dueReminders([task], new Set(), new Date(2027, 0, 5, 11).getTime()),
    ).toEqual([]);
  });
  it("использует 28 февраля в обычный год и 29 в високосный", () => {
    const task = { ...birthday(), birthday: { month: 2, day: 29 } };
    expect(birthdayDate(task, 2027)).toBe("2027-02-28");
    expect(birthdayDate(task, 2028)).toBe("2028-02-29");
  });
  it("показывает ежегодную дату и предварительные напоминания в календаре", () => {
    expect(tasksOn([birthday()], "2028-01-05")).toHaveLength(1);
    expect(tasksOn([birthday()], "2027-12-29")).toHaveLength(1);
    expect(nextBirthdayDate(birthday(), new Date(2027, 0, 6))).toBe(
      "2028-01-05",
    );
  });
  it("удаление записи и завершённый статус убирают напоминания", () => {
    const now = new Date(2027, 0, 5, 10).getTime();
    expect(reminderBadge([birthday()], now)).toBe("due");
    expect(reminderBadge([{ ...birthday(), status: "done" }], now)).toBeNull();
    expect(dueReminders([], new Set(), now)).toEqual([]);
  });
  it("отклоняет неверную дату и смешение с обычным повторением", () => {
    expect(() =>
      validateTask({ ...birthday(), birthday: { month: 2, day: 30 } }),
    ).toThrow();
    expect(() => validateTask({ ...birthday(), repeat: "daily" })).toThrow();
  });
});
