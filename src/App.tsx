import { areaMiniatures, sphereIcon } from "./areaAppearance";
import { awardExperience } from "./character";
import AccountPanel from "./components/AccountPanel";
import { MotionConfig } from "motion/react";
import { motionTokens, installMotionTokens } from "./motionTokens";
import { useNativeBack } from "./nativeBack";
import { TaskMotionContext } from "./taskMotion";
import { reorderTasks } from "./reorderTasks";
import { haptic } from "./haptics";
import { useExitMotion } from "./useExitMotion";
import { useSmoothCorners } from "./useSmoothCorners";
import TaskPressMenu from "./components/TaskPressMenu";
import { firstPendingDate, type CalendarOccurrence } from "./series";
import { useLayoutEffect, useEffect, useMemo, useRef, useState } from "react";
import {
  desktop,
  loadData,
  storeData,
  runtimeStatus,
  synchronizeAndroidReminders,
  android,
  recognizeSpeech,
} from "./api";
import {
  isEvent,
  newTask,
  dayKey,
  emptyData,
  demoData,
  applyTaskEdit,
  areaLabel,
  addLifeArea,
  availableAreas,
  removeLifeArea,
  removeTask,
  saveTask,
  moveTaskTime,
  type Data,
  type Task,
} from "./domain";
import MobileOrbit from "./components/MobileOrbit";
import TaskEditor from "./components/TaskEditor";
import Calendar from "./components/Calendar";
import RemoveArea from "./components/RemoveArea";
import AreaEditor from "./components/AreaEditor";
import VoiceInput from "./components/VoiceInput";
import { useNavigation } from "./useNavigation";
import type { Screen } from "./navigation";
import "./styles.css";
import "./soft-theme.css";
import "./today.css";
import "./minds.css";
import "./reference-theme.css";
import "./version-two.css";
import "./motion.css";
import "./pixel-polish.css";

export default function App() {
  useSmoothCorners();
  useLayoutEffect(() => installMotionTokens(), []);
  const [data, setData] = useState<Data>(emptyData);
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingDate, setEditingDate] = useState<string | undefined>();
  const [editing, setEditing] = useState<Task | null>(null);
  const [moved, setMoved] = useState<{ before: Task; text: string } | null>(
    null,
  );
  const {
    screen,
    push,
    replace,
    back: navigateBack,
    root: navigateRoot,
  } = useNavigation();
  const dismissRoute = useExitMotion(() =>
    document.querySelector<HTMLDialogElement>(
      "dialog.task-editor[open], dialog.area-editor[open]",
    ),
  );
  const back = () => dismissRoute(navigateBack);
  const backToRoot = () => dismissRoute(navigateRoot);
  useNativeBack(back);
  const lock = useRef(false);
  const activeAreas = useMemo(() => availableAreas(data), [data]);
  useEffect(() => {
    document.documentElement.dataset.theme = "light";

    let active = true;
    loadData()
      .then((d) => {
        if (active) {
          setData(d);
          setReady(true);
          void synchronizeAndroidReminders(d)
            .then((messages) => {
              if (active && messages.length) setError(messages.join(" "));
            })
            .catch((e) => {
              if (active) setError("Напоминания Android: " + String(e));
            });
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    const status = () => {
      void runtimeStatus()
        .then((messages) => {
          if (active && messages.length) setError(messages.join(" "));
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    };
    status();
    const timer = setInterval(status, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function commit(next: Data, reward = true) {
    if(reward)next=awardExperience(data,next);
    if (lock.current) throw Error("Дождитесь завершения сохранения.");
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = demo
        ? { ...next, revision: data.revision + 1 }
        : await storeData(next);
      setData(saved);
      if (!demo)
        void synchronizeAndroidReminders(saved, true)
          .then((messages) => {
            if (messages.length) setError(messages.join(" "));
          })
          .catch((e) =>
            setError(
              "Данные сохранены, но напоминания Android не обновились: " +
                String(e),
            ),
          );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!ready || demo) return;
    const resume = () => {
      if (document.visibilityState === "visible")
        void synchronizeAndroidReminders(data)
          .then((messages) => {
            if (messages.length) setError(messages.join(" "));
          })
          .catch((e) => setError("Напоминания Android: " + String(e)));
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, [data, ready, demo]);
  function openTask(task: Task, open: (patch: Partial<Screen>) => void = push) {
    setError("");
    const source = data.tasks.find((t) => t.id === task.id) || task;
    const date = source.repeat
      ? (task as CalendarOccurrence).occurrenceDate || firstPendingDate(source)
      : undefined;
    setEditingDate(date);
    setEditing(
      structuredClone({
        ...source,
        status: isEvent(source)
          ? "todo"
          : date && source.repeatCompleted?.includes(date)
            ? "done"
            : source.status,
      }),
    );
    open({ task: true, voice: false });
  }
  async function moveTask(task: Task, time: string) {
    const source = data.tasks.find((t) => t.id === task.id);
    if (!source) return;
    try {
      await commit(saveTask(data, moveTaskTime(source, time)));
      setMoved({
        before: source,
        text:
          "«" +
          source.title +
          "» — " +
          time +
          (source.reminder ? ", напоминание сдвинуто" : "") +
          (source.repeat ? ", для всей серии" : ""),
      });
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    if (!moved) return;
    const timer = setTimeout(() => setMoved(null), 6000);
    return () => clearTimeout(timer);
  }, [moved]);
  function enableDemo() {
    setData(demoData());
    setDemo(true);
    setReady(true);
    setError("");
  }
  const orbit = useMemo(
    () => (
      <MobileOrbit
        tasks={data.tasks}
        customAreas={data.customAreas || []}
        availableAreas={activeAreas}
        areaIcons={data.areaIcons || {}}
        editAreaIcon={() => {
          setError("");
          push({ editAreaIcon: true });
        }}
        removeArea={() => {
          setError("");
          push({ removeArea: true });
        }}
        area={activeAreas.includes(screen.area || "") ? screen.area : null}
        setArea={(area) => (area ? push({ area }) : back())}
        addArea={() => {
          setError("");
          push({ addArea: true });
        }}
        ready={ready}
        demo={demo}
        native={desktop}
        busy={busy}
        error={error}
        clearError={() => setError("")}
        openCalendar={backToRoot}
        openTask={openTask}
        add={(area) => {
          const today = new Date();
          openTask({
            ...newTask(),
            area,
            ...(area === "Дни рождения"
              ? {
                  birthday: {
                    month: today.getMonth() + 1,
                    day: today.getDate(),
                  },
                  due: dayKey(today),
                }
              : {}),
          });
        }}
        enableDemo={enableDemo}
      />
    ),
    [data, activeAreas, screen.area, ready, demo, busy, error],
  );
  const home = useMemo(
    () => (
      <main className="today-home" aria-label="Мой день">
        <Calendar
          areaIcons={data.areaIcons || {}}
          home
          tasks={data.tasks}
          select={openTask}
          create={(date, time) =>
            openTask({
              ...newTask(),
              area: activeAreas[0] || "Работа",
              due: date,
              dueTime: time || "",
            })
          }
          move={moveTask}
          ready={ready && activeAreas.length > 0}
          openOrbit={() => push({ orbit: true })}
          openVoice={() => {
            setError("");
            push({ voice: true });
          }}
        />
        {!ready && (
          <div className="today-notice">
            {desktop ? (
              <div
                className="loading-skeleton"
                role="status"
                aria-label="Загрузка дел"
              >
                <span />
                <span />
                <span />
              </div>
            ) : (
              <>
                <p>
                  Посмотрите приложение на примерах. Демо не сохраняется после
                  обновления страницы.
                </p>
                <button onClick={enableDemo}>Посмотреть демо</button>
              </>
            )}
          </div>
        )}
        {ready && !activeAreas.length && (
          <p className="today-notice">
            Откройте «Сферы» и добавьте сферу жизни для новых дел.
          </p>
        )}
        {moved && (
          <div className="today-toast" role="status">
            <span>{moved.text}</span>
            <button
              disabled={busy}
              onClick={() => {
                const before = moved.before;
                setMoved(null);
                void commit(saveTask(data, before)).catch((e) =>
                  setError(String(e)),
                );
              }}
            >
              Отменить
            </button>
          </div>
        )}
        {demo && (
          <p className="planner-demo">
            Демо · изменения только до обновления страницы
          </p>
        )}
        {error && (
          <div className="today-notice" role="alert">
            {error}
            <button onClick={() => setError("")}>Скрыть</button>
          </div>
        )}
      </main>
    ),
    [data, activeAreas, ready, demo, error, moved, busy],
  );
  async function actTask(
    task: Task,
    date: string | undefined,
    remove: boolean,
  ) {
    try {
      if (isEvent(task) && !remove) throw Error("Событие нельзя выполнить.");
      await commit(
        remove
          ? removeTask(data, task.id)
          : applyTaskEdit(
              data,
              { ...task, status: task.status === "done" ? "todo" : "done" },
              task.repeat ? date || firstPendingDate(task) : undefined,
            ),
      );
      if (!remove) haptic("success");
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }
  async function reorderVisible(ids: string[]) {
    try {
      await commit(reorderTasks(data, ids));
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }
  const taskActions = useMemo(
    () => ({ busy, act: actTask, reorder: reorderVisible }),
    [busy, data, demo],
  );
  return (
    <MotionConfig reducedMotion="user" transition={motionTokens.spring}>
      <TaskMotionContext.Provider value={taskActions}>
        <TaskPressMenu
          tasks={data.tasks}
          busy={busy}
          error={error}
          act={actTask}
        >
          <div className="orbit-app">
            {!demo && ready && <AccountPanel data={data} busy={busy} restore={next=>commit(next,false)} />}
            <div
              className="today-host"
              hidden={!!screen.orbit}
              aria-hidden={!!screen.orbit}
            >
              {home}
            </div>
            {screen.orbit && <div className="orbit-host">{orbit}</div>}
            {(screen.addArea || (screen.editAreaIcon && screen.area)) && (
              <AreaEditor
                edit={screen.editAreaIcon && screen.area ? {
                  name: areaLabel(screen.area),
                  icon: areaMiniatures.find(item => item.icon === sphereIcon(screen.area!, data.areaIcons))?.id ?? "",
                } : undefined}
                busy={busy}
                error={error}
                ready={ready}
                native={desktop}
                close={back}
                enableDemo={enableDemo}
                save={(name, icon) => {
                  void (async () => {
                    const area = screen.editAreaIcon ? screen.area : null;
                    await commit(area ? { ...data, areaIcons: { ...data.areaIcons, [area]: icon } } : addLifeArea(data, name, icon));
                    back();
                  })().catch((e) => setError(String(e)));
                }}
              />
            )}
            {screen.voice && !screen.task && (
              <VoiceInput
                areas={activeAreas}
                defaultArea={activeAreas[0] || "Работа"}
                speech={android}
                recognize={recognizeSpeech}
                close={back}
                confirm={(parsed) =>
                  // The voice sheet is replaced, so Back from the form returns home.
                  openTask({ ...newTask(), ...parsed }, replace)
                }
              />
            )}
            {screen.removeArea && screen.area && (
              <RemoveArea
                data={data}
                area={screen.area}
                busy={busy}
                error={error}
                close={back}
                remove={(destination) => {
                  void (async () => {
                    await commit(
                      removeLifeArea(data, screen.area!, destination),
                    );
                    backToRoot();
                  })().catch((e) => setError(String(e)));
                }}
              />
            )}
            {screen.task && editing && (
              <TaskEditor
                deletedAreas={data.deletedAreas || []}
                areaIcons={data.areaIcons || {}}
                remove={() => {
                  void (async () => {
                    await commit(removeTask(data, editing.id));
                    back();
                  })().catch((e) => setError(String(e)));
                }}
                customAreas={data.customAreas || []}
                key={editing.id}
                task={editing}
                occurrenceDate={editingDate}
                tasks={data.tasks}
                projects={data.projects}
                busy={busy}
                error={error}
                demo={demo}
                close={() => !busy && back()}
                save={(draft) => {
                  void (async () => {
                    await commit(applyTaskEdit(data, draft, editingDate));
                    back();
                  })().catch((e) => setError(String(e)));
                }}
              />
            )}
          </div>
        </TaskPressMenu>
      </TaskMotionContext.Provider>
    </MotionConfig>
  );
}
