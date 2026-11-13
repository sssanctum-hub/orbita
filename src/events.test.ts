import { describe, expect, it } from "vitest";
import { calendarIndex, tasksOn } from "./calendarModel";
import { daySchedule, layoutDay } from "./daySchedule";
import {
  eventMinutes,
  eventTimeLabel,
  moveTaskTime,
  newTask,
  planDay,
  saveTask,
  validateTask,
  emptyData,
  type Task,
} from "./domain";
import { prepareTaskDraft } from "./taskDraft";

const event = (patch: Partial<Task> = {}): Task => ({
  ...newTask(),
  id: "e",
  title: "Конференция",
  kind: "event",
  start: "2026-11-03",
  startTime: "14:00",
  due: "2026-11-03",
  dueTime: "16:30",
  ...patch,
});

describe("событие «от и до»: проверка", () => {
  it("принимает событие в один день, через полночь, на несколько дней и на весь день", () => {
    expect(() => validateTask(event())).not.toThrow();
    expect(() =>
      validateTask(
        event({ startTime: "22:00", due: "2026-11-04", dueTime: "02:00" }),
      ),
    ).not.toThrow();
    expect(() =>
      validateTask(event({ due: "2026-11-07", dueTime: "18:00" })),
    ).not.toThrow();
    expect(() =>
      validateTask(
        event({ due: "2026-11-07", startTime: "", dueTime: "" }),
      ),
    ).not.toThrow();
  });
  it("отклоняет одинаковое и обратное время, половину времени и отсутствие дат", () => {
    expect(() => validateTask(event({ dueTime: "14:00" }))).toThrow();
    expect(() => validateTask(event({ dueTime: "13:00" }))).toThrow();
    expect(() => validateTask(event({ dueTime: "" }))).toThrow();
    expect(() => validateTask(event({ startTime: "" }))).toThrow();
    expect(() => validateTask(event({ start: "" }))).toThrow();
    expect(() => validateTask(event({ due: "" }))).toThrow();
    expect(() => validateTask(event({ due: "2026-11-02" }))).toThrow();
    expect(() => validateTask(event({ startTime: "24:00" }))).toThrow();
  });
  it("не допускает события длиннее 365 дней, время начала у обычного дела и день рождения", () => {
    expect(() =>
      validateTask(event({ due: "2027-11-04", startTime: "", dueTime: "" })),
    ).toThrow();
    expect(() =>
      validateTask(event({ due: "2027-11-03", startTime: "", dueTime: "" })),
    ).not.toThrow();
    expect(() =>
      validateTask({ ...newTask(), title: "x", startTime: "10:00" }),
    ).toThrow();
    expect(() =>
      validateTask(event({ birthday: { month: 11, day: 3 } })),
    ).toThrow();
  });
  it("длительность считается с учётом дней", () => {
    expect(eventMinutes(event())).toBe(150);
    expect(
      eventMinutes(
        event({ startTime: "22:00", due: "2026-11-04", dueTime: "02:00" }),
      ),
    ).toBe(240);
    expect(eventMinutes(event({ startTime: "", dueTime: "" }))).toBeNull();
  });
  it("старые дела без вида и времени начала остаются валидными и не меняются", () => {
    const old = { ...newTask(), title: "Старое", due: "2026-11-03", dueTime: "10:00" };
    expect(() => validateTask(old)).not.toThrow();
    const draft = prepareTaskDraft(old, "");
    expect("kind" in draft).toBe(false);
    expect("startTime" in draft).toBe(false);
  });
  it("черновик события обнуляет минуты, а событие не попадает в план дня", () => {
    const draft = prepareTaskDraft(event({ minutes: 45 }), "");
    expect(draft.kind).toBe("event");
    expect(draft.minutes).toBe(0);
    expect(planDay([event({ minutes: 30 })], "2026-11-03", 480)).toEqual([]);
  });
  it("время события не двигается долгим нажатием", () => {
    expect(() => moveTaskTime(event(), "10:00")).toThrow();
  });
  it("сохраняется как обычное дело", () => {
    expect(saveTask(emptyData(), event()).tasks).toHaveLength(1);
  });
});

describe("событие «от и до»: день", () => {
  it("однодневное событие стоит на шкале с началом и длительностью", () => {
    const { timed, allDay } = daySchedule([event()], "2026-11-03");
    expect(allDay).toEqual([]);
    expect(timed).toHaveLength(1);
    expect(timed[0]).toMatchObject({
      dueTime: "14:00",
      minutes: 150,
      segment: { label: "14:00–16:30", continuesBefore: false },
    });
    expect(timed[0]!.segment!.source.id).toBe("e");
    const [placed] = layoutDay(timed, 60);
    expect(placed!.top).toBe(14 * 60);
    expect(placed!.height).toBe(150);
  });
  it("событие через полночь делится по дням", () => {
    const night = event({
      startTime: "22:00",
      due: "2026-11-04",
      dueTime: "02:00",
    });
    const first = daySchedule([night], "2026-11-03").timed[0]!;
    expect([first.dueTime, first.minutes, first.segment!.label]).toEqual([
      "22:00",
      120,
      "с 22:00",
    ]);
    const second = daySchedule([night], "2026-11-04").timed[0]!;
    expect([second.dueTime, second.minutes, second.segment!.label]).toEqual([
      "00:00",
      120,
      "до 02:00",
    ]);
    expect(daySchedule([night], "2026-11-05").timed).toEqual([]);
    expect(daySchedule([night], "2026-11-02").timed).toEqual([]);
  });
  it("многодневное событие занимает весь промежуточный день", () => {
    const trip = event({ due: "2026-11-07", dueTime: "18:00" });
    const middle = daySchedule([trip], "2026-11-05").timed[0]!;
    expect([middle.dueTime, middle.minutes, middle.segment!.label]).toEqual([
      "00:00",
      1440,
      "весь день",
    ]);
  });
  it("событие, закончившееся ровно в полночь, не остаётся на следующем дне", () => {
    const e = event({ startTime: "20:00", due: "2026-11-04", dueTime: "00:00" });
    expect(daySchedule([e], "2026-11-04").timed).toEqual([]);
    expect(daySchedule([e], "2026-11-03").timed).toHaveLength(1);
  });
  it("событие без времени идёт в блок «Без времени» каждого дня", () => {
    const trip = event({ due: "2026-11-05", startTime: "", dueTime: "" });
    for (const date of ["2026-11-03", "2026-11-04", "2026-11-05"])
      expect(daySchedule([trip], date).allDay).toHaveLength(1);
    expect(daySchedule([trip], "2026-11-06").allDay).toEqual([]);
  });
  it("пересекающиеся события и дела делят колонки", () => {
    const a = event({ id: "a" });
    const b = event({ id: "b", startTime: "15:00", dueTime: "17:00" });
    const { timed } = daySchedule([a, b], "2026-11-03");
    const placed = layoutDay(timed, 60);
    expect(placed.map((p) => [p.column, p.columns])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });
  it("повторяющееся многодневное событие видно в день, когда оно уже идёт", () => {
    const weekly = event({
      due: "2026-11-05",
      startTime: "09:00",
      dueTime: "10:00",
      repeat: "weekly",
    });
    // Tue 3 Nov – Thu 5 Nov, repeating every Thursday: the next one runs 10–12 Nov.
    expect(daySchedule([weekly], "2026-11-04").timed).toHaveLength(1);
    expect(daySchedule([weekly], "2026-11-11").timed).toHaveLength(1);
    expect(daySchedule([weekly], "2026-11-08").timed).toHaveLength(0);
  });
});

describe("событие «от и до»: календарь", () => {
  const dates = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];
  it("индекс ставит событие на каждый день промежутка", () => {
    const index = calendarIndex(
      [event({ due: "2026-11-05", dueTime: "18:00" })],
      dates,
    );
    expect(dates.map((d) => index.get(d)!.length)).toEqual([0, 1, 1, 1, 0]);
  });
  it("событие, начавшееся до окна, всё равно видно в окне", () => {
    const index = calendarIndex(
      [event({ start: "2026-10-30", due: "2026-11-03", dueTime: "18:00" })],
      dates,
    );
    expect(dates.map((d) => index.get(d)!.length)).toEqual([1, 1, 0, 0, 0]);
    expect(tasksOn([event({ start: "2026-10-30" })], "2026-11-01")).toHaveLength(1);
  });
  it("повторы многодневного события попадают в окно, даже если кончаются за его краем", () => {
    const weekly = event({
      start: "2026-11-06",
      due: "2026-11-09",
      startTime: "",
      dueTime: "",
      repeat: "weekly",
      repeatWeekdays: [0],
    });
    const index = calendarIndex([weekly], dates);
    expect(index.get("2026-11-06")!.length).toBe(1);
  });
  it("подписи времени", () => {
    const night = event({
      startTime: "22:00",
      due: "2026-11-05",
      dueTime: "02:00",
    });
    expect(eventTimeLabel(event())).toBe("14:00–16:30");
    expect(eventTimeLabel(night)).toBe("22:00 → 02:00");
    expect(eventTimeLabel(night, "2026-11-04")).toBe("весь день");
    expect(eventTimeLabel(event({ startTime: "", dueTime: "" }))).toBe("");
  });
});
