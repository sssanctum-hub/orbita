import HandwrittenNote from "./HandwrittenNote";
import { LayoutGroup, motion } from "motion/react";
import { useTaskSheet } from "../useTaskSheet";
import { motionTokens } from "../motionTokens";
import AttachmentsEditor from "./AttachmentsEditor";
import TimePicker from "./TimePicker";
import AppSelect from "./AppSelect";
import {
  useLayoutEffect,
  useMemo,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { sphereIcon, colorForArea } from "../areaAppearance";
import RepeatEditor from "./RepeatEditor";
import DatePicker from "./DatePicker";
import { prepareTaskDraft } from "../taskDraft";
import { minuteOf, timeOf } from "../daySchedule";
import {
  areaLabel,
  birthdayDate,
  dayKey,
  daysBetween,
  eventMinutes,
  eventTimeLabel,
  getAreas,
  isEvent,
  isFact,
  asFact,
  shiftDate,
  type Area,
  type Project,
  type Task,
} from "../domain";

type Props = {
  task: Task;
  occurrenceDate?: string;
  customAreas?: string[];
  deletedAreas?: string[];
  areaIcons?: Record<string, string>;
  remove: () => void;
  tasks: Task[];
  projects: Project[];
  busy: boolean;
  error: string;
  demo: boolean;
  save: (task: Task) => void;
  close: () => void;
};

function localInput(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${dayKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
const dateText = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });

const addMinutes = (time: string, plus: number) =>
  timeOf(Math.min(1439, Math.max(0, minuteOf(time) + plus)));

function resizeTextFields(dialog: HTMLDialogElement | null) {
  if (CSS.supports("field-sizing", "content")) return;
  dialog?.querySelectorAll("textarea").forEach((field) => {
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  });
}

export default function TaskEditor({
  task: initialTask,
  occurrenceDate,
  customAreas = [],
  deletedAreas = [],
  areaIcons = {},
  remove,
  tasks,
  projects,
  busy,
  error,
  demo,
  save,
  close,
}: Props) {
  const [task, change] = useState(initialTask);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const datePanelId = useId();
  const reminderPanelId = useId();
  const [panel, setPanel] = useState<"date" | "reminder" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const locked = busy || uploading;
  const sheet = useTaskSheet(dialog, close, locked);
  const bodyRef = useRef<HTMLDivElement>(null);
  const latestTask = useRef(task);
  latestTask.current = task;
  const fact = isFact(task);
  const swipeSuppress = useRef(0);
  const kindSwipe = useRef<{ x: number; y: number; at: number } | null>(null);
  const existing = tasks.some((item) => item.id === task.id);
  const today = dayKey(new Date());
  const Icon = sphereIcon(task.area, areaIcons);
  const areas = useMemo(() => getAreas(tasks, projects, [{ area: task.area }], customAreas.map(area => ({area}))).filter(area => !deletedAreas.includes(area)), [tasks, projects, task.area, customAreas, deletedAreas]);
  const dueText = !task.due
    ? "Без даты"
    : task.due === today
      ? "Сегодня"
      : task.due === shiftDate(today, 1)
        ? "Завтра"
        : dateText(task.due);
  const asEvent = isEvent(task);
  const eventDates = asEvent
    ? task.start === task.due
      ? dateText(task.start)
      : `${dateText(task.start)} — ${dateText(task.due)}`
    : "";
  const reminderText = task.reminder
    ? new Date(task.reminder).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Не забыть";

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    document.body.dataset.taskEditing = "true";
    return () => { delete document.body.dataset.taskEditing; window.OrbitaDevice?.setTitleEditing?.(false); element?.close(); };
  }, []);

  useLayoutEffect(() => {
    resizeTextFields(dialog.current);
  }, [task.title, task.notes]);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    let width = 0;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      resizeTextFields(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function setDue(due: string) {
    const date = new Date(due + "T12:00:00");
    change({
      ...task,
      due,
      repeatAnchor: undefined,
      repeatDay: undefined,
      ...(task.birthday && due
        ? {
            birthday: {
              ...task.birthday,
              month: date.getMonth() + 1,
              day: date.getDate(),
              createdAt: new Date().toISOString(),
            },
          }
        : {}),
    });
  }
  // Ordinary task <-> event "from–to". Dates and times carry over where they can.
  function setEvent(on: boolean) {
    if (!on && fact) {
      change({ ...task, kind: undefined });
      return;
    }
    if (on === asEvent && !fact) return;
    if (on) {
      const start = task.start || task.due || today;
      const due = task.due || start;
      const startTime = task.dueTime || "";
      change({
        ...task,
        kind: "event",
        status: "todo",
        repeatCompleted: [],
        start,
        due,
        startTime,
        dueTime: !startTime
          ? ""
          : start === due
            ? addMinutes(startTime, task.minutes || 60)
            : startTime,
        minutes: 0,
        repeatAnchor: undefined,
        repeatDay: undefined,
      });
    } else {
      const length = eventMinutes(task);
      const sameDay = task.start === task.due;
      change({
        ...task,
        kind: undefined,
        startTime: undefined,
        dueTime: sameDay ? task.startTime || "" : "",
        minutes: sameDay && length && length <= 1440 ? length : 0,
        repeatAnchor: undefined,
        repeatDay: undefined,
      });
    }
  }
  // Moving the start keeps the event's length.
  function setEventStart(start: string) {
    if (!start) return;
    const length =
      task.start && task.due ? daysBetween(task.start, task.due) : 0;
    change({
      ...task,
      start,
      due: shiftDate(start, Math.max(0, length)),
      repeatAnchor: undefined,
      repeatDay: undefined,
    });
  }
  function setEventEnd(due: string) {
    if (!due) return;
    change({ ...task, due, repeatAnchor: undefined, repeatDay: undefined });
  }
  function setEventTime(side: "start" | "end", value: string) {
    if (!value) return change({ ...task, startTime: "", dueTime: "" });
    const sameDay = task.start === task.due;
    if (side === "start") {
      const keepEnd = task.dueTime && !(sameDay && task.dueTime <= value);
      return change({
        ...task,
        startTime: value,
        dueTime: keepEnd
          ? task.dueTime
          : sameDay
            ? addMinutes(value, 60)
            : value,
      });
    }
    change({
      ...task,
      dueTime: value,
      startTime: task.startTime || addMinutes(value, -60),
    });
  }
  function setReminder(date: string, time: string) {
    change({
      ...task,
      reminder: date
        ? new Date(date + "T" + (time || "09:00") + ":00").toISOString()
        : "",
    });
  }

  return (
    <motion.dialog
      style={{ y: sheet.y, scale: sheet.scale }}
      ref={dialog}
      className="task-editor"
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        if (locked) return;
        if (confirmDelete) setConfirmDelete(false);
        else if (panel) setPanel(null);
        else close();
      }}
    >
      <form
        className="task-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (locked) return;
          save(prepareTaskDraft(task, ""));
        }}
      >
        <motion.header className="task-editor-header" {...sheet.headerGesture}>
          <motion.span className="sheet-header-glass" aria-hidden="true" />
          <span className="sheet-drag-handle" aria-hidden="true" />
          <button
            type="button"
            className="task-editor-back"
            aria-label="Закрыть дело"
            disabled={locked}
            onClick={close}
          >
            <ArrowLeft size={23} />
          </button>
          <motion.h2 id={heading}>
            {fact
              ? existing
                ? "Ваш факт"
                : "Новый факт"
              : task.birthday
                ? "День рождения"
                : existing
                  ? "Ваше дело"
                  : "Новое дело"}
          </motion.h2>
          <div className="task-area-select task-area-badge" style={{ "--area-color": colorForArea(task.area) } as CSSProperties}>
            <span className="task-area-badge-icon" aria-hidden="true"><Icon size={21} /></span>
            <span>
              <AppSelect
                id={heading + "-area"}
                aria-label="Сфера жизни"
                value={task.area}
                disabled={locked}
                onChange={(event) =>
                  change({
                    ...task,
                    area: event.target.value as Area,
                    projectId: null,
                    ...(event.target.value === "Дни рождения" && !fact
                      ? {
                          birthday: task.birthday || {
                            month: new Date().getMonth() + 1,
                            day: new Date().getDate(),
                          },
                          due: task.due || today,
                          reminder: "",
                          dueTime: "",
                          repeat: "" as const,
                        }
                      : { birthday: undefined }),
                  })
                }
              >
                {areas.map((area) => (
                  <option key={area} value={area}>
                    {areaLabel(area)}
                  </option>
                ))}
              </AppSelect>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </div>

        </motion.header>
        <div
          className="task-editor-body"
          ref={bodyRef}
          onClickCapture={(e) => {
            if (Date.now() < swipeSuppress.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onTouchCancel={() => { kindSwipe.current = null; }}
          onTouchMove={(e) => {
            if (e.touches.length > 1) kindSwipe.current = null;
          }}
          onTouchStart={(e) => {
            if (
              task.birthday ||
              locked ||
              e.touches.length !== 1 ||
              ((e.target as Element).matches("textarea") && (e.target as HTMLTextAreaElement).selectionStart !== (e.target as HTMLTextAreaElement).selectionEnd) ||
              e.touches[0]!.clientX < 24 || e.touches[0]!.clientX > innerWidth - 24 ||
              (e.target as Element).closest(
                "input,a,.attachments-editor,[role=spinbutton],.task-area-select,.task-inline-panel,.repeat-editor,.repeat-settings",
              )
            ) {
              kindSwipe.current = null;
              return;
            }
            kindSwipe.current = {
              x: e.touches[0]!.clientX,
              y: e.touches[0]!.clientY,
              at: Date.now(),
            };
          }}
          onTouchEnd={(e) => {
            const start = kindSwipe.current;
            kindSwipe.current = null;
            const touch = e.changedTouches[0];
            if (locked || !start || !touch || Date.now() - start.at > 1000) return;
            const dx = touch.clientX - start.x,
              dy = touch.clientY - start.y;
            if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            const current = fact ? 2 : asEvent ? 1 : 0,
              next = current + (dx < 0 ? 1 : -1);
            if (next < 0 || next > 2) return;
            e.preventDefault();
            swipeSuppress.current = Date.now() + 400;
            setPanel(null);
            if (next === 2) change(asFact(task));
            else setEvent(next === 1);
          }}
        >
          {task.repeat && (
            <p className="task-field-hint">
              Серия повторений. Изменения применяются ко всей серии.
              {occurrenceDate
                ? " Отметка выполнения: " + dateText(occurrenceDate) + "."
                : ""}
            </p>
          )}
          {!task.birthday && (
            <LayoutGroup id={heading}>
              <div
                className="task-kind-switch"
                style={
                  {
                    "--kind-index": fact ? 2 : asEvent ? 1 : 0,
                  } as CSSProperties
                }
                role="group"
                aria-label="Вид записи"
              >
                <button
                  type="button"
                  aria-pressed={!asEvent && !fact}
                  disabled={locked}
                  onClick={() => setEvent(false)}
                >
                  {!fact && !asEvent && (
                    <motion.span
                      layoutId="task-kind"
                      layoutDependency={fact ? 2 : asEvent ? 1 : 0}
                      className="spring-segment-thumb"
                      transition={motionTokens.spring}
                    />
                  )}
                  <span className="segment-label">Дело</span>
                </button>
                <button
                  type="button"
                  aria-pressed={asEvent}
                  disabled={locked}
                  onClick={() => setEvent(true)}
                >
                  {asEvent && (
                    <motion.span
                      layoutId="task-kind"
                      className="spring-segment-thumb"
                      transition={motionTokens.spring}
                    />
                  )}
                  <span className="segment-label">Событие</span>
                </button>
                <button
                  type="button"
                  aria-pressed={fact}
                  disabled={locked}
                  onClick={() => {
                    setPanel(null);
                    change(asFact(task));
                  }}
                >
                  {fact && (
                    <motion.span
                      layoutId="task-kind"
                      className="spring-segment-thumb"
                      transition={motionTokens.spring}
                    />
                  )}
                  <span className="segment-label">Факт</span>
                </button>
              </div>
            </LayoutGroup>
          )}
          <label className="task-title-field">
            <span className="visually-hidden">Название дела</span>
            <textarea
              onFocus={() => window.OrbitaDevice?.setTitleEditing?.(true)}
              onBlur={() => window.OrbitaDevice?.setTitleEditing?.(false)}
              onContextMenu={e => e.preventDefault()}
              required
              maxLength={200}
              rows={2}
              placeholder={
                task.birthday ? "Имя человека" : "Что хочется сделать?"
              }
              value={task.title}
              disabled={locked}
              onChange={(event) =>
                change({ ...task, title: event.target.value })
              }
            />
          </label>
          {task.birthday ? (
            <div className="birthday-settings">
              <DatePicker
                label="Дата дня рождения"
                value={birthdayDate(task, new Date().getFullYear())}
                disabled={locked}
                change={(date) => {
                  if (date) setDue(date);
                }}
              />
              <div className="birthday-reminders">
                <Bell size={20} />
                <strong>Напомним автоматически</strong>
                <div>
                  <span>За неделю</span>
                  <span>За день</span>
                  <span>В день рождения</span>
                </div>
                <p>
                  Ежегодно, в 09:00 по времени устройства. Для 29 февраля в
                  обычный год — 28 февраля.
                </p>
                {demo && <p>В демо уведомления не отправляются.</p>}
              </div>
            </div>
          ) : !fact ? (
            <>
              <div className="task-choice-cards">
                <button
                  type="button"
                  className="task-choice-card task-reminder-card"
                  aria-expanded={panel === "reminder"}
                  aria-controls={reminderPanelId}
                  onClick={() =>
                    setPanel(panel === "reminder" ? null : "reminder")
                  }
                >
                  <span>
                    <Bell size={19} />
                    <span>Напоминание</span>
                  </span>
                  <strong>{reminderText}</strong>
                  <small>
                    {task.reminder
                      ? dateText(localInput(task.reminder).slice(0, 10))
                      : "Выбрать время"}
                  </small>
                </button>
                <button
                  type="button"
                  className="task-choice-card task-date-card"
                  aria-expanded={panel === "date"}
                  aria-controls={datePanelId}
                  onClick={() => setPanel(panel === "date" ? null : "date")}
                >
                  <span>
                    <CalendarDays size={19} />
                    <span>Когда</span>
                  </span>
                  <strong>{asEvent ? eventDates : dueText}</strong>
                  <small>
                    {asEvent
                      ? eventTimeLabel(task) || "На весь день"
                      : task.dueTime ||
                        (task.due ? "Можно изменить" : "В своём ритме")}
                  </small>
                </button>
              </div>
              <div
                id={datePanelId}
                hidden={panel !== "date"}
                className="task-inline-panel"
              >
                {asEvent ? (
                  <>
                    <fieldset className="task-event-range">
                      <legend>Начало</legend>
                      <DatePicker
                        label="Дата начала"
                        value={task.start}
                        disabled={locked}
                        change={setEventStart}
                      />
                      <TimePicker
                        label="Время начала"
                        value={task.startTime || ""}
                        disabled={locked}
                        change={(value) => setEventTime("start", value)}
                      />
                    </fieldset>
                    <fieldset className="task-event-range">
                      <legend>Конец</legend>
                      <DatePicker
                        label="Дата окончания"
                        value={task.due}
                        disabled={locked}
                        change={setEventEnd}
                      />
                      <TimePicker
                        label="Время окончания"
                        value={task.dueTime || ""}
                        disabled={locked}
                        change={(value) => setEventTime("end", value)}
                      />
                    </fieldset>
                    <p className="task-field-hint">
                      Событие может идти несколько дней или через полночь. Без
                      времени оно занимает весь день. Напоминание настраивается
                      отдельно.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="task-date-shortcuts">
                      {[
                        ["Сегодня", today],
                        ["Завтра", shiftDate(today, 1)],
                        ["Без даты", ""],
                      ].map(([label, value]) => (
                        <button
                          type="button"
                          key={label}
                          aria-pressed={task.due === value}
                          disabled={locked}
                          onClick={() =>
                            change({
                              ...task,
                              due: value!,
                              dueTime: value ? task.dueTime : "",
                              repeatAnchor: undefined,
                              repeatDay: undefined,
                            })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <DatePicker
                      label="Своя дата"
                      value={task.due}
                      disabled={locked}
                      change={(due) =>
                        change({
                          ...task,
                          due,
                          dueTime: due ? task.dueTime : "",
                          repeatAnchor: undefined,
                          repeatDay: undefined,
                        })
                      }
                    />
                    {task.due && (
                      <TimePicker
                        label="Время дела"
                        value={task.dueTime || ""}
                        disabled={locked}
                        change={(dueTime) => change({ ...task, dueTime })}
                      />
                    )}
                    <p className="task-field-hint">
                      Время дела и напоминание настраиваются отдельно.
                    </p>
                  </>
                )}
              </div>
              <div
                id={reminderPanelId}
                hidden={panel !== "reminder"}
                className="task-inline-panel"
              >
                <DatePicker
                  label="Дата напоминания"
                  value={localInput(task.reminder).slice(0, 10)}
                  disabled={locked}
                  change={(date) =>
                    setReminder(
                      date,
                      localInput(task.reminder).slice(11) || "09:00",
                    )
                  }
                />
                {task.reminder && (
                  <TimePicker
                    label="Время напоминания"
                    value={localInput(task.reminder).slice(11)}
                    disabled={locked}
                    clearable={false}
                    change={(time) =>
                      setReminder(localInput(task.reminder).slice(0, 10), time)
                    }
                  />
                )}
                <div className="task-reminder-caption">
                  <span>
                    {demo
                      ? "В демо уведомления не отправляются."
                      : "По времени этого устройства."}
                  </span>
                  {task.reminder && (
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => change({ ...task, reminder: "" })}
                    >
                      Убрать
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="fact-caption">
              Факт хранится в сфере. Без срока и напоминания — к нему можно
              вернуться в любой момент.
            </p>
          )}
          <div className="task-note-field">
            <label htmlFor="task-note-text">{fact ? "Пара слов о факте" : "Пара слов о деле"}</label>
            <textarea
              id="task-note-text"
              rows={2}
              placeholder="Идея, ссылка или важная деталь…"
              value={task.notes}
              disabled={locked}
              onChange={(event) =>
                change({ ...task, notes: event.target.value })
              }
            />
          <HandwrittenNote strokes={task.handwriting || []} disabled={locked} change={handwriting => change({ ...latestTask.current, handwriting })} />
          </div>
          <AttachmentsEditor
            task={task}
            disabled={locked}
            busyChange={setUploading}
            change={(patch) => change({ ...latestTask.current, ...patch })}
          />
          {!task.birthday && !fact && (
            <RepeatEditor
              task={task}
              busy={busy}
              change={(next) =>
                // The repeat editor sets only the due date: move the start with it.
                change(
                  asEvent && next.due && next.due !== task.due
                    ? {
                        ...next,
                        start: shiftDate(
                          next.due,
                          -daysBetween(task.start, task.due),
                        ),
                      }
                    : next,
                )
              }
            />
          )}
          {existing && (
            <div className="task-actions">
              {!task.birthday &&
                !fact &&
                !asEvent &&
                task.status !== "done" && (
                  <button
                    type="button"
                    className="task-done"
                    disabled={locked}
                    onClick={() =>
                      save({
                        ...prepareTaskDraft(task, ""),
                        status: "done",
                      })
                    }
                  >
                    <Check size={20} />
                    Дело сделано
                  </button>
                )}
              {!task.birthday && !asEvent && task.status === "done" && (
                <button
                  type="button"
                  className="task-done"
                  disabled={locked}
                  onClick={() =>
                    save({
                      ...prepareTaskDraft(task, ""),
                      status: "todo",
                    })
                  }
                >
                  Вернуть в дела
                </button>
              )}
              {!confirmDelete ? (
                <button
                  type="button"
                  className="task-delete"
                  disabled={locked}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={17} />
                  {fact
                    ? "Удалить факт"
                    : task.repeat
                      ? "Удалить всю серию"
                      : "Удалить дело"}
                </button>
              ) : (
                <div
                  className="task-delete-confirm"
                  role="group"
                  aria-label="Подтверждение удаления дела"
                >
                  <p>
                    {task.repeat
                      ? "Удалить всю серию и все её будущие повторы?"
                      : "Удалить это дело? Его шаги и напоминание тоже будут удалены."}
                  </p>
                  <button type="button" disabled={locked} onClick={remove}>
                    Да, удалить дело
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Оставить
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="task-editor-footer">
          {error && (
            <p role="alert" className="task-editor-error">
              {error.replace(/^Error:\s*/, "")}
            </p>
          )}
          <button className="task-save" disabled={locked}>
            <span>
              {uploading
                ? "Готовим изображения…"
                : busy
                  ? "Сохраняем…"
                  : existing
                    ? "Сохранить"
                    : fact
                      ? "Добавить факт"
                      : asEvent
                        ? "Добавить событие"
                        : "Добавить дело"}
            </span>
            {existing ? <Check size={22} /> : <ArrowUpRight size={22} />}
          </button>
        </footer>
      </form>
    </motion.dialog>
  );
}
