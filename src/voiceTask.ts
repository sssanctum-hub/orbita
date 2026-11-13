import { areaLabel, dayKey, shiftDate, type Area } from "./domain";

// Rule-based parsing of a dictated Russian phrase. The result only pre-fills
// the task form; nothing is saved until the user confirms it there.
export interface VoiceTask {
  title: string;
  due: string;
  dueTime: string;
  reminder: string;
  area?: Area;
}

const L = "(?<![\\p{L}\\d])";
const R = "(?![\\p{L}\\d])";
const numberWords: Record<string, number> = {
  один: 1,
  одну: 1,
  одна: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  пятнадцать: 15,
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
};
const NUM = `(\\d{1,3}|${Object.keys(numberWords).join("|")})`;
const toNumber = (value: string) =>
  /^\d/.test(value) ? Number(value) : (numberWords[value] ?? 0);
const MONTHS = [
  "январ[яь]",
  "феврал[яь]",
  "марта?",
  "апрел[яь]",
  "ма[яй]",
  "июн[яь]",
  "июл[яь]",
  "августа?",
  "сентябр[яь]",
  "октябр[яь]",
  "ноябр[яь]",
  "декабр[яь]",
];
const WEEKDAYS = [
  "понедельник",
  "вторник",
  "среду",
  "четверг",
  "пятницу",
  "субботу",
  "воскресенье",
];
const pad = (n: number) => String(n).padStart(2, "0");
const timeText = (h: number, m: number) => `${pad(h)}:${pad(m)}`;
const normalize = (text: string) =>
  text.toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseVoiceTask(
  text: string,
  areas: Area[] = [],
  now = new Date(),
): VoiceTask {
  const original = text.replace(/\s+/g, " ").trim();
  // Lowercasing and е/ё keep the length, so spans map back onto the original.
  let source = original;
  let lower = normalize(original);
  // Removes the first match from the phrase; missing groups become "".
  function take(pattern: string): [string, string, string, string] | null {
    const match = new RegExp(pattern, "u").exec(lower);
    if (!match) return null;
    const blank = " ".repeat(match[0].length);
    const cut = (s: string) =>
      s.slice(0, match.index) + blank + s.slice(match.index + match[0].length);
    source = cut(source);
    lower = cut(lower);
    return [match[0], match[1] ?? "", match[2] ?? "", match[3] ?? ""];
  }

  const remind = /напомн|напоминани/u.test(lower);
  take(
    `^\\s*(?:пожалуйста\\s+)?(?:напомни(?:те)?|напоминание|добавь(?:те)?|создай(?:те)?|запиши|поставь)(?:\\s+(?:мне|дело|задачу|напоминание))*(?:\\s+(?:о том,? что|что|чтобы))?${R}`,
  );
  take(`^\\s*(?:мне\\s+)?(?:надо|нужно)${R}`);

  let area: Area | undefined;
  for (const candidate of areas) {
    const key = normalize(areaLabel(candidate));
    // A short stem accepts case endings: «покупки» → «в сфере покупок».
    const stem = escape(
      key.slice(0, key.length - (key.length > 6 ? 2 : key.length > 4 ? 1 : 0)),
    );
    if (take(`${L}(?:в\\s+|во\\s+)?сфер[аеуы]?\\s+${stem}\\p{L}*${R}`)) {
      area = candidate;
      break;
    }
  }

  let offsetMinutes: number | null = null;
  if (remind) {
    const before = take(
      `${L}за\\s+(?:${NUM}\\s+)?(минут[уы]?|час(?:а|ов)?|полчаса|д(?:ень|ня|ней)|сутки|недел[юи])${R}`,
    );
    if (before) {
      const count = before[1] ? toNumber(before[1]) : 1;
      const unit = before[2];
      offsetMinutes = unit.startsWith("полчаса")
        ? 30
        : unit.startsWith("минут")
          ? count
          : unit.startsWith("час")
            ? count * 60
            : unit.startsWith("недел")
              ? count * 7 * 1440
              : count * 1440;
    }
    take(`${L}(?:мне\\s+)?напомни(?:те|ть)?(?:\\s+мне)?${R}`);
  }

  let due = "";
  let time: { h: number; m: number } | null = null;
  let exact: Date | null = null;
  const today = dayKey(now);

  const relative = take(
    `${L}через\\s+(?:${NUM}\\s+)?(минут[уы]?|час(?:а|ов)?|полчаса|д(?:ень|ня|ней)|недел[юиь]|месяц(?:а|ев)?)${R}`,
  );
  if (relative) {
    const count = relative[1] ? toNumber(relative[1]) : 1;
    const unit = relative[2];
    if (/^(минут|час|полчаса)/u.test(unit)) {
      const minutes = unit.startsWith("полчаса")
        ? 30
        : unit.startsWith("минут")
          ? count
          : count * 60;
      exact = new Date(now.getTime() + minutes * 60000);
      exact.setSeconds(0, 0);
      due = dayKey(exact);
      time = { h: exact.getHours(), m: exact.getMinutes() };
    } else if (unit.startsWith("месяц")) {
      const date = new Date(today + "T12:00:00");
      date.setMonth(date.getMonth() + count);
      due = dayKey(date);
    } else due = shiftDate(today, unit.startsWith("недел") ? count * 7 : count);
  }

  if (!due) {
    const word = take(`${L}(послезавтра|завтра|сегодня)${R}`);
    if (word)
      due = shiftDate(
        today,
        word[1] === "сегодня" ? 0 : word[1] === "завтра" ? 1 : 2,
      );
  }
  if (!due) {
    const date = take(
      `${L}(\\d{1,2})(?:-?(?:го|е))?\\s+(${MONTHS.join("|")})(?:\\s+(\\d{4})(?:\\s+года?)?)?${R}`,
    );
    if (date) {
      const day = Number(date[1]);
      const month = MONTHS.findIndex((m) =>
        new RegExp(`^${m}$`, "u").test(date[2]),
      );
      const explicitYear = date[3] ? Number(date[3]) : 0;
      let year = explicitYear || now.getFullYear();
      const build = (y: number) => {
        const d = new Date(y, month, day, 12);
        return d.getMonth() === month ? dayKey(d) : "";
      };
      let key = build(year);
      if (key && !explicitYear && key < today) key = build(++year);
      due = key;
    }
  }
  if (!due) {
    const date = take(`${L}(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{4}))?${R}`);
    if (date) {
      const [day, month] = [Number(date[1]), Number(date[2]) - 1];
      let year = date[3] ? Number(date[3]) : now.getFullYear();
      const build = (y: number) => {
        const d = new Date(y, month, day, 12);
        return d.getMonth() === month && d.getDate() === day ? dayKey(d) : "";
      };
      let key = build(year);
      if (key && !date[3] && key < today) key = build(++year);
      due = key;
    }
  }
  if (!due) {
    const weekday = take(
      `${L}(?:в|во)\\s+(?:(эт[уио]т?|следующ(?:ую|ий|ее))\\s+)?(${WEEKDAYS.join("|")})${R}`,
    );
    if (weekday) {
      const target = WEEKDAYS.indexOf(weekday[2]);
      const current = (now.getDay() + 6) % 7;
      let days = (target - current + 7) % 7 || 7;
      if (weekday[1]?.startsWith("следующ") && current + days <= 6) days += 7;
      due = shiftDate(today, days);
    }
  }

  if (!time) {
    const clock = take(
      `${L}(?:в|к)\\s+(\\d{1,2})[:.](\\d{2})(?:\\s+час(?:а|ов)?)?(?:\\s+(утра|дня|вечера|ночи))?${R}`,
    );
    if (clock) time = withPeriod(+clock[1], +clock[2], clock[3]);
  }
  if (!time) {
    const clock = take(
      `${L}(?:в|к)\\s+${NUM}\\s+(?:(?:час(?:а|ов)?)(?:\\s+(утра|дня|вечера|ночи))?|(утра|дня|вечера|ночи))${R}`,
    );
    if (clock) time = withPeriod(toNumber(clock[1]), 0, clock[2] || clock[3]);
  }
  if (!time) {
    // A bare "в 9" is only a time when nothing else follows it in the phrase.
    const clock = take(
      `${L}(?:в|к)\\s+(\\d{1,2})(?=\\s*(?:$|[,.!?;]|(?:сегодня|завтра|послезавтра|в|во|и|напомни)${R}))`,
    );
    if (clock) time = withPeriod(+clock[1], 0);
  }
  if (!time) {
    const word = take(`${L}в\\s+(полдень|полночь)${R}`);
    if (word) time = { h: word[1] === "полдень" ? 12 : 0, m: 0 };
  }
  if (!time) {
    const part = take(`${L}(утром|днем|вечером)${R}`);
    if (part)
      time = {
        h: part[1] === "утром" ? 9 : part[1] === "днем" ? 13 : 19,
        m: 0,
      };
  }

  if (time && !due) {
    due = today;
    const moment = new Date(today + "T" + timeText(time.h, time.m) + ":00");
    if (moment.getTime() <= now.getTime()) due = shiftDate(today, 1);
  }
  const dueTime = time ? timeText(time.h, time.m) : "";

  let reminder = "";
  if (remind && due) {
    const base = exact || new Date(due + "T" + (dueTime || "09:00") + ":00");
    reminder = new Date(
      base.getTime() - (offsetMinutes || 0) * 60000,
    ).toISOString();
  }

  const title = source
    .replace(/\s+/g, " ")
    .replace(
      /^(?:[\s,.;:!?-]|(?:в|во|на|к|и|а|про|о)(?=\s|$))+|(?:[\s,.;:!?-]|(?<=\s|^)(?:в|во|на|к|и|а))+$/giu,
      "",
    )
    .trim();
  return {
    title: title
      ? title.charAt(0).toLocaleUpperCase("ru-RU") + title.slice(1)
      : original,
    due,
    dueTime,
    reminder,
    ...(area ? { area } : {}),
  };
}

function withPeriod(h: number, m: number, period?: string) {
  if (period === "утра" || period === "ночи") h = h === 12 ? 0 : h;
  if ((period === "дня" || period === "вечера") && h < 12) h += 12;
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? { h, m } : null;
}
