import { occurrencesBetween, repeatsOn } from "./series";
export const areas = [
  "Работа",
  "Фриланс",
  "Квартира",
  "Еда",
  "Любовь",
  "Спорт",
  "Родные",
  "Здоровье",
  "Покупки",
  "Финансы",
  "Учёба",
  "Преподавание",
  "Аспирантура",
  "Дни рождения",
] as const;
// The stored spelling stays compatible with existing databases and exports.
export type Area = string;
export const areaLabel = (area: Area) => (area === "Учёба" ? "Учеба" : area);
export function getAreas(...groups: { area: Area }[][]): Area[] {
  return [
    ...new Set<string>([
      ...areas,
      ...groups.flatMap((group) => group.map((item) => item.area)),
    ]),
  ];
}
export function addLifeArea(data: Data, title: string, icon = "circle"): Data {
  const name = title.trim().replace(/\s+/g, " ");
  if (!name || name.length > 40)
    throw Error("Название сферы: от 1 до 40 символов.");
  const known = availableAreas(data);
  const key = (value: string) =>
    areaLabel(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
  if (known.some((area) => key(area) === key(name)))
    throw Error("Такая сфера уже есть.");
  if ((data.customAreas || []).length >= 100)
    throw Error("Можно добавить до 100 своих сфер.");
  const storedName = areas.find((a) => key(a) === key(name)) || name;
  return {
    ...data,
    areaIcons: { ...(data.areaIcons || {}), [storedName]: icon },
    deletedAreas: (data.deletedAreas || []).filter((a) => key(a) !== key(name)),
    customAreas: areas.some((a) => key(a) === key(name))
      ? data.customAreas || []
      : [...(data.customAreas || []), name],
  };
}
export type Status = "todo" | "doing" | "done";
export interface Project {
  id: string;
  name: string;
  area: Area;
}
export interface TaskImage {
  id: string;
  name: string;
  thumbnail: string;
  width: number;
  height: number;
}
export interface Task {
  handwriting?: string[];
  id: string;
  title: string;
  area: Area;
  projectId: string | null;
  status: Status;
  start: string;
  due: string;
  dueTime?: string;
  // "event" = interval "from–to": start/startTime .. due/dueTime. Absent for ordinary tasks.
  kind?: "" | "event" | "fact";
  images?: TaskImage[];
  links?: { id: string; label: string; url: string }[];
  startTime?: string;
  reminder: string;
  birthday?: { month: number; day: number; createdAt?: string };
  notes: string;
  priority: number;
  minutes: number;
  subtasks: { id: string; title: string; done: boolean }[];
  repeat?: "" | "daily" | "weekly" | "monthly";
  repeatCompleted?: string[];
  repeatDay?: number;
  repeatInterval?: number;
  repeatWeekdays?: number[];
  repeatUntil?: string;
  repeatCount?: number;
  repeatAnchor?: string;
  previousId?: string;
  dependsOn?: string[];
}
export interface Note {
  id: string;
  title: string;
  body: string;
  projectId: string | null;
}
export interface Data {
  character?: import("./character").Character;
  revision: number;
  customAreas?: string[];
  deletedAreas?: string[];
  areaIcons?: Record<string, string>;
  projects: Project[];
  tasks: Task[];
  notes: Note[];
}
export const emptyData = (): Data => ({
  revision: 0,
  projects: [],
  tasks: [],
  notes: [],
});
export const statusText: Record<Status, string> = {
  todo: "Запланировано",
  doing: "В работе",
  done: "Готово",
};
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function shiftDate(key: string, amount: number) {
  const d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + amount);
  return dayKey(d);
}
export function daysBetween(a: string, b: string) {
  return Math.round(
    (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000,
  );
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const clock = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const MAX_EVENT_DAYS = 366;
export const isFact = (t: Task) => t.kind === "fact";
export function asFact(t: Task): Task {
  return {
    ...t,
    kind: "fact",
    status: "todo",
    start: "",
    due: "",
    dueTime: "",
    startTime: undefined,
    reminder: "",
    birthday: undefined,
    minutes: 0,
    repeat: "",
    repeatUntil: "",
    repeatCount: undefined,
    repeatAnchor: "",
    repeatDay: undefined,
    repeatInterval: undefined,
    repeatWeekdays: undefined,
    repeatCompleted: [],
    previousId: undefined,
    subtasks: [],
    dependsOn: [],
  };
}
export const isEvent = (t: Task) => t.kind === "event" && !t.birthday;
// Whole days between the start and the end of an event (0 = same day).
export const eventSpanDays = (t: Task) =>
  isEvent(t) && t.start && t.due ? Math.max(0, daysBetween(t.start, t.due)) : 0;
// Minutes from start to end; null while the event has no times (all-day).
export function eventMinutes(t: Task): number | null {
  if (!isEvent(t) || !t.start || !t.due || !t.startTime || !t.dueTime)
    return null;
  return (
    daysBetween(t.start, t.due) * 1440 + clock(t.dueTime) - clock(t.startTime)
  );
}
// Short time caption of an event; with a date it describes that day's part.
export function eventTimeLabel(t: Task, date?: string): string {
  if (!isEvent(t) || !t.startTime || !t.dueTime) return "";
  if (t.start === t.due || !date) {
    return t.start === t.due
      ? `${t.startTime}–${t.dueTime}`
      : `${t.startTime} → ${t.dueTime}`;
  }
  if (date === t.start) return `с ${t.startTime}`;
  if (date === t.due) return `до ${t.dueTime}`;
  return "весь день";
}
export function validateTask(t: Task): void {
  if (
    isFact(t) &&
    (t.start ||
      t.due ||
      t.dueTime ||
      t.startTime ||
      t.reminder ||
      t.birthday ||
      t.repeat ||
      t.repeatUntil ||
      t.repeatAnchor ||
      t.repeatCompleted?.length ||
      t.status !== "todo" ||
      t.minutes ||
      t.subtasks.length ||
      t.dependsOn?.length)
  )
    throw Error("У факта нет даты, напоминания и выполнения.");
  if ((t.images?.length || 0) > 10)
    throw Error("Можно прикрепить до 10 изображений.");
  const imageIds = new Set<string>();
  for (const image of t.images || []) {
    if (
      !/^[0-9a-f-]{36}$/.test(image.id) ||
      imageIds.has(image.id) ||
      image.name.length > 200 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image.thumbnail) ||
      image.thumbnail.length > 60000 ||
      image.width < 1 ||
      image.height < 1 ||
      image.width > 1200 ||
      image.height > 1200
    )
      throw Error("Проверьте прикреплённые изображения.");
    imageIds.add(image.id);
  }
  if ((t.links?.length || 0) > 30)
    throw Error("Можно прикрепить до 30 ссылок.");
  for (const link of t.links || []) {
    let url: URL;
    try {
      url = new URL(link.url);
    } catch {
      throw Error("Проверьте ссылку.");
    }
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      link.url.length > 2048 ||
      link.label.length > 200 ||
      !link.id
    )
      throw Error("Проверьте ссылку: нужен адрес http или https.");
  }
  if (!t.area.trim() || t.area.length > 40)
    throw Error("Выберите сферу жизни.");
  if (!t.title.trim()) throw Error("Введите название дела.");
  if (t.title.length > 200)
    throw Error("Название не должно превышать 200 символов.");
  for (const value of [
    t.start,
    t.due,
    t.repeatUntil || "",
    t.repeatAnchor || "",
    ...(t.repeatCompleted || []),
  ])
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        dayKey(new Date(value + "T12:00:00")) !== value)
    )
      throw Error("Проверьте дату.");
  if (t.dueTime && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.dueTime) || !t.due))
    throw Error("Для времени дела укажите дату и время от 00:00 до 23:59.");
  if (t.start && t.due && t.start > t.due)
    throw Error("Окончание не может быть раньше начала.");
  if (t.kind && t.kind !== "event" && t.kind !== "fact")
    throw Error("Неизвестный вид дела.");
  if (t.startTime && !TIME_RE.test(t.startTime))
    throw Error("Время начала: от 00:00 до 23:59.");
  if (t.startTime && t.kind !== "event")
    throw Error("Время начала задаётся только для события.");
  if (t.kind === "event") {
    if (t.birthday) throw Error("День рождения не может быть событием.");
    if (!t.start || !t.due)
      throw Error("Для события укажите дату начала и дату окончания.");
    if (!!t.startTime !== !!t.dueTime)
      throw Error("Укажите и время начала, и время окончания — или ни одного.");
    if (daysBetween(t.start, t.due) >= MAX_EVENT_DAYS)
      throw Error("Событие не может длиться больше 365 дней.");
    const length = eventMinutes(t);
    if (length !== null && length <= 0)
      throw Error("Окончание должно быть позже начала.");
  }
  if (t.reminder && !Number.isFinite(Date.parse(t.reminder)))
    throw Error("Проверьте время напоминания.");
  if (!Number.isFinite(t.minutes) || t.minutes < 0 || t.minutes > 1440)
    throw Error("Длительность: от 0 до 1440 минут.");
  if (t.birthday) {
    const { month, day } = t.birthday;
    if (
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > new Date(2000, month, 0).getDate()
    )
      throw Error("Проверьте дату дня рождения.");
    if (
      t.birthday.createdAt &&
      !Number.isFinite(Date.parse(t.birthday.createdAt))
    )
      throw Error("Проверьте дату создания дня рождения.");
    if (t.repeat || t.reminder)
      throw Error("Для дня рождения действуют три автоматических напоминания.");
  }
  if (t.repeat && !t.due)
    throw Error("Для повторения укажите срок первого дела.");
  if (t.repeat && !["daily", "weekly", "monthly"].includes(t.repeat))
    throw Error("Выберите правило повторения.");
  if (
    t.repeatInterval !== undefined &&
    (!Number.isInteger(t.repeatInterval) ||
      t.repeatInterval < 1 ||
      t.repeatInterval > 365)
  )
    throw Error("Интервал повторения: от 1 до 365.");
  if (
    t.repeatDay !== undefined &&
    (!Number.isInteger(t.repeatDay) || t.repeatDay < 1 || t.repeatDay > 31)
  )
    throw Error("День месяца: от 1 до 31.");
  if (
    t.repeatWeekdays !== undefined &&
    (new Set(t.repeatWeekdays).size !== t.repeatWeekdays.length ||
      t.repeatWeekdays.some(
        (day) => !Number.isInteger(day) || day < 0 || day > 6,
      ) ||
      (t.repeat === "weekly" && !t.repeatWeekdays.length))
  )
    throw Error("Выберите хотя бы один день недели.");
  if (t.repeatCount !== undefined && (!Number.isInteger(t.repeatCount) || t.repeatCount < 1 || t.repeatCount > 999 || !t.repeat || !t.repeatUntil)) throw Error("Проверьте количество повторений.");
  if (t.repeat && t.repeatUntil && t.repeatUntil < t.due)
    throw Error("Окончание повторений не может быть раньше даты дела.");
  if (t.repeat && t.repeatAnchor && t.repeatAnchor > t.due)
    throw Error("Начало серии не может быть позже даты дела.");
}
export function validateDependencies(tasks: Task[]) {
  const map = new Map(tasks.map((t) => [t.id, t]));
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id))
      throw Error("Получился круг зависимостей. Уберите одну из связей.");
    if (visited.has(id)) return;
    const task = map.get(id);
    if (!task) throw Error("Связанное дело не найдено.");
    visiting.add(id);
    for (const dep of task.dependsOn || []) visit(dep);
    visiting.delete(id);
    visited.add(id);
  }
  for (const t of tasks) visit(t.id);
}
export function saveTask(data: Data, task: Task): Data {
  validateTask(task);
  if (
    task.area !== "Личное" &&
    !getAreas(
      data.tasks,
      data.projects,
      (data.customAreas || []).map((area) => ({ area })),
    ).includes(task.area)
  )
    throw Error("Сфера не найдена.");
  if (data.deletedAreas?.includes(task.area)) throw Error("Эта сфера удалена.");
  if (task.projectId && !data.projects.some((p) => p.id === task.projectId))
    throw Error("Проект уже удалён. Выберите другой.");
  const tasks = data.tasks.some((t) => t.id === task.id)
    ? data.tasks.map((t) => (t.id === task.id ? task : t))
    : [...data.tasks, task];
  validateDependencies(tasks);
  return { ...data, tasks };
}
export function removeTask(data: Data, id: string): Data {
  const ids = new Set([id]);
  if (data.tasks.find((t) => t.id === id)?.repeat) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of data.tasks)
        if (t.previousId && (ids.has(t.id) || ids.has(t.previousId))) {
          if (!ids.has(t.id) || !ids.has(t.previousId)) changed = true;
          ids.add(t.id);
          ids.add(t.previousId);
        }
    }
  }
  return {
    ...data,
    tasks: data.tasks
      .filter((t) => !ids.has(t.id))
      .map((t) => ({
        ...t,
        dependsOn: (t.dependsOn || []).filter((dep) => !ids.has(dep)),
      })),
  };
}
export function nextOccurrence(task: Task): Task {
  if (!task.repeat || !task.due) throw Error("Повторение не настроено.");
  const nextDue = nextRepeatDate(task);
  const anchor = task.repeatDay || Number(task.due.slice(8));
  const delta = daysBetween(task.due, nextDue);
  let reminder = "";
  if (task.reminder) {
    const d = new Date(task.reminder);
    d.setDate(d.getDate() + delta);
    reminder = d.toISOString();
  }
  return {
    ...task,
    id: crypto.randomUUID(),
    previousId: task.id,
    status: "todo",
    start: task.start ? shiftDate(task.start, delta) : "",
    due: nextDue,
    reminder,
    repeatDay: anchor,
    repeatAnchor: task.repeatAnchor || task.due,
    subtasks: task.subtasks.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      done: false,
    })),
  };
}
export function completeTask(data: Data, id: string): Data {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) throw Error("Дело не найдено.");
  if (isFact(task)) throw Error("Факт нельзя выполнить.");
  if (isEvent(task)) throw Error("Событие нельзя выполнить.");
  if (task.status === "done") return data;
  const blocked = (task.dependsOn || []).some(
    (dep) => data.tasks.find((t) => t.id === dep)?.status !== "done",
  );
  if (blocked)
    throw Error(
      "Сначала завершите связанные предыдущие дела или уберите зависимость.",
    );
  let next = saveTask(data, { ...task, status: "done" });
  if (task.repeat) {
    next = saveTask(data, {
      ...task,
      status: "todo",
      repeatCompleted: [
        ...new Set([...(task.repeatCompleted || []), task.due]),
      ],
    });
  }
  return next;
}
export function applyTaskEdit(
  data: Data,
  task: Task,
  occurrenceDate?: string,
): Data {
  if (isFact(task)) return saveTask(data, task);
  if (isEvent(task)) {
    if (task.status === "done") throw Error("Событие нельзя выполнить.");
    return saveTask(data, { ...task, status: "todo", repeatCompleted: [] });
  }
  if (task.repeat) {
    const date = occurrenceDate || task.due;
    const done = new Set(task.repeatCompleted || []);
    if (task.status === "done") done.add(date);
    else done.delete(date);
    return saveTask(data, {
      ...task,
      status: "todo",
      repeatCompleted: [...done],
    });
  }
  const transition =
    task.status === "done" &&
    data.tasks.find((t) => t.id === task.id)?.status !== "done";
  const saved = saveTask(data, transition ? { ...task, status: "todo" } : task);
  return transition ? completeTask(saved, task.id) : saved;
}
// Moves a timed task within its day; a set reminder keeps the same lead time.
export function moveTaskTime(task: Task, time: string): Task {
  if (!task.due || !task.dueTime) throw Error("У дела нет времени.");
  if (isEvent(task)) throw Error("Время события меняется в редакторе.");
  const minute = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const delta = minute(time) - minute(task.dueTime);
  return {
    ...task,
    dueTime: time,
    reminder: task.reminder
      ? new Date(Date.parse(task.reminder) + delta * 60000).toISOString()
      : "",
  };
}
export function removeProject(data: Data, id: string): Data {
  return {
    ...data,
    projects: data.projects.filter((p) => p.id !== id),
    tasks: data.tasks.map((t) =>
      t.projectId === id ? { ...t, projectId: null } : t,
    ),
    notes: data.notes.map((n) =>
      n.projectId === id ? { ...n, projectId: null } : n,
    ),
  };
}
export function deliveryKey(t: Task) {
  return `${t.id}@${t.reminder}`;
}
export function dueReminders(
  tasks: Task[],
  delivered: Set<string>,
  now: number,
) {
  return tasks
    .filter((t) => t.status !== "done" && !isFact(t))
    .flatMap((task) => {
      if (!task.birthday && task.repeat && task.reminder) {
        const today = dayKey(new Date(now));
        const offset = daysBetween(task.due, dayKey(new Date(task.reminder)));
        return occurrencesBetween(
          [task],
          shiftDate(today, -14 - offset),
          shiftDate(today, -offset),
        ).filter(
          (item) =>
            item.status !== "done" &&
            Date.parse(item.reminder) <= now &&
            !delivered.has(deliveryKey(item)),
        );
      }
      if (!task.birthday)
        return task.reminder &&
          Date.parse(task.reminder) <= now &&
          !delivered.has(deliveryKey(task))
          ? [task]
          : [];
      return birthdayReminders(task, new Date(now).getFullYear())
        .filter(
          (item) =>
            Date.parse(item.at) <= now &&
            Date.parse(item.at) >=
              Math.max(
                now - 14 * 86400000,
                Date.parse(task.birthday!.createdAt || "1970-01-01"),
              ),
        )
        .flatMap((item) => {
          const occurrence = {
            ...task,
            reminder: item.at,
            title: task.title + " · " + item.label,
          };
          return delivered.has(deliveryKey(occurrence)) ? [] : [occurrence];
        });
    });
}
export function planDay(tasks: Task[], date: string, capacity: number) {
  let remaining = capacity;
  const available = new Set(
    tasks.filter((t) => t.status === "done").map((t) => t.id),
  );
  return tasks
    .filter(
      (t) => t.status !== "done" && t.minutes > 0 && !isEvent(t) && !isFact(t),
    )
    .sort(
      (a, b) =>
        (a.due || "9999").localeCompare(b.due || "9999") ||
        b.priority - a.priority,
    )
    .flatMap((t) => {
      if ((t.start && t.start > date) || t.minutes > remaining) return [];
      if ((t.dependsOn || []).some((id) => !available.has(id))) return [];
      remaining -= t.minutes;
      available.add(t.id);
      return [
        {
          id: t.id,
          title: t.title,
          minutes: t.minutes,
          reason:
            t.due && t.due <= date
              ? "Срок наступил"
              : "Ближайший срок и приоритет",
        },
      ];
    });
}
export function newTask(): Task {
  return {
    id: crypto.randomUUID(),
    title: "",
    area: "Работа",
    projectId: null,
    status: "todo",
    start: "",
    due: "",
    reminder: "",
    notes: "",
    priority: 1,
    minutes: 0,
    subtasks: [],
  };
}
export function demoData(): Data {
  const today = dayKey(new Date());
  const project = {
    id: "demo-study",
    name: "Новый семестр",
    area: "Учёба" as Area,
  };
  return {
    revision: 0,
    projects: [
      project,
      { id: "demo-work", name: "Запуск проекта", area: "Работа" },
    ],
    notes: [],
    tasks: [
      {
        ...newTask(),
        title: "Подготовить курсовую",
        area: "Учёба",
        projectId: project.id,
        start: shiftDate(today, -2),
        due: shiftDate(today, 5),
        status: "doing",
        minutes: 90,
        notes:
          "Собрать источники и составить структуру. Это демонстрационный пример.",
        subtasks: [
          { id: "a", title: "Выбрать тему", done: true },
          { id: "b", title: "Собрать источники", done: false },
          { id: "c", title: "Написать первый раздел", done: false },
        ],
      },
      {
        ...newTask(),
        title: "Презентация проекта",
        area: "Работа",
        projectId: "demo-work",
        start: today,
        due: shiftDate(today, 3),
        minutes: 60,
        priority: 2,
      },
      {
        ...newTask(),
        title: "Вечерняя прогулка",
        area: "Спорт",
        due: today,
        minutes: 30,
      },
      {
        ...newTask(),
        title: "Прочитать новую книгу",
        area: "Учёба",
        start: shiftDate(today, 1),
        due: shiftDate(today, 12),
        minutes: 45,
      },
      { ...newTask(), title: "Спланировать семейный отпуск", area: "Родные" },
      {
        ...newTask(),
        title: "Разобрать конспекты",
        area: "Учёба",
        projectId: project.id,
        due: shiftDate(today, 2),
        minutes: 40,
      },
    ],
  };
}

export function availableAreas(data: Data): Area[] {
  return getAreas(
    data.tasks,
    data.projects,
    (data.customAreas || []).map((area) => ({ area })),
  ).filter((area) => !data.deletedAreas?.includes(area));
}
export function removeLifeArea(data: Data, area: Area, destination = ""): Data {
  const options = availableAreas(data);
  if (!options.includes(area)) throw Error("Сфера уже удалена.");
  const hasContent =
    data.tasks.some((t) => t.area === area) ||
    data.projects.some((p) => p.area === area);
  if (hasContent && (!options.includes(destination) || destination === area))
    throw Error("Выберите сферу для переноса дел.");
  return {
    ...data,
    customAreas: (data.customAreas || []).filter((a) => a !== area),
    deletedAreas: [...new Set([...(data.deletedAreas || []), area])],
    tasks: data.tasks.map((t) =>
      t.area === area ? { ...t, area: destination } : t,
    ),
    projects: data.projects.map((p) =>
      p.area === area ? { ...p, area: destination } : p,
    ),
  };
}

export function nextRepeatDate(task: Task): string {
  if (!task.repeat || !task.due) throw Error("Повторение не настроено.");
  const interval = task.repeatInterval || 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 365)
    throw Error("Проверьте интервал повторения.");
  if (task.repeat === "daily") return shiftDate(task.due, interval);
  if (task.repeat === "monthly") {
    const date = new Date(task.due + "T12:00:00");
    const day = task.repeatDay || Number(task.due.slice(8));
    date.setDate(1);
    date.setMonth(date.getMonth() + interval);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, last));
    return dayKey(date);
  }
  const weekday = (key: string) =>
    (new Date(key + "T12:00:00").getDay() + 6) % 7;
  const weekdays = task.repeatWeekdays || [weekday(task.due)];
  if (
    !weekdays.length ||
    weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    throw Error("Выберите дни недели.");
  const base = task.repeatAnchor || task.due;
  const monday = shiftDate(base, -weekday(base));
  for (let offset = 1; offset <= interval * 7 + 7; offset++) {
    const candidate = shiftDate(task.due, offset);
    const week = Math.floor(daysBetween(monday, candidate) / 7);
    if (week % interval === 0 && weekdays.includes(weekday(candidate)))
      return candidate;
  }
  throw Error("Не удалось рассчитать повторение.");
}
export function repeatPreview(task: Task, count = 4): string[] {
  if (!task.repeat || !task.due) return [];
  try {
    validateTask({ ...task, title: task.title.trim() || "Предпросмотр" });
    const dates: string[] = repeatsOn(task, task.due) ? [task.due] : [];
    let current = task;
    while (dates.length < count) {
      const due = nextRepeatDate(current);
      if (task.repeatUntil && due > task.repeatUntil) break;
      dates.push(due);
      current = {
        ...current,
        due,
        repeatDay: current.repeatDay || Number(task.due.slice(8)),
        repeatAnchor: current.repeatAnchor || task.due,
      };
    }
    return dates;
  } catch {
    return [];
  }
}

export function birthdayDate(task: Task, year: number): string {
  if (!task.birthday) return task.due;
  const { month, day } = task.birthday;
  return dayKey(
    new Date(
      year,
      month - 1,
      Math.min(day, new Date(year, month, 0).getDate()),
      12,
    ),
  );
}
export function nextBirthdayDate(task: Task, now = new Date()): string {
  const today = dayKey(now);
  const date = birthdayDate(task, now.getFullYear());
  return date >= today ? date : birthdayDate(task, now.getFullYear() + 1);
}
export function birthdayReminders(
  task: Task,
  year: number,
): { at: string; label: string }[] {
  if (!task.birthday) return [];
  return [year - 1, year, year + 1].flatMap((y) => {
    const due = birthdayDate(task, y);
    return [
      { days: 7, label: "день рождения через неделю" },
      { days: 1, label: "день рождения завтра" },
      { days: 0, label: "день рождения сегодня" },
    ].map(({ days, label }) => {
      const date = new Date(shiftDate(due, -days) + "T09:00:00");
      return { at: date.toISOString(), label };
    });
  });
}
export function reminderTimes(task: Task, now: number): number[] {
  if (isFact(task) || task.status === "done") return [];
  if (task.birthday)
    return birthdayReminders(task, new Date(now).getFullYear())
      .map((i) => Date.parse(i.at))
      .filter(
        (time) =>
          time >=
          Math.max(
            now - 14 * 86400000,
            Date.parse(task.birthday!.createdAt || "1970-01-01"),
          ),
      );
  return task.reminder && Number.isFinite(Date.parse(task.reminder))
    ? [Date.parse(task.reminder)]
    : [];
}
