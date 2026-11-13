import { dialAngle, dialDetent, dialDragStep, dialTarget, settleDial } from "../orbitDial";
import { haptic } from "../haptics";
import { createOrbitSound } from "../orbitSound";
import ProgressRing from "./ProgressRing";
import { useChangeMotion } from "../useChangeMotion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Plus, ArrowLeft, CalendarDays, X, Trash2, Pencil } from "lucide-react";
import { isEvent, isFact, areaLabel, type Task, type Area } from "../domain";
import { sphereIcon, colorForArea } from "../areaAppearance";
import { orbitOffset, visibleOrbitIndices, wrapOrbitIndex } from "../orbitMath";
import { reminderBadge } from "../reminderBadge";

type Props = {
  tasks: Task[];
  customAreas: string[];
  availableAreas: string[];
  areaIcons: Record<string, string>;
  removeArea: () => void;
  editAreaIcon: () => void;
  area: Area | null;
  setArea: (area: Area | null) => void;
  addArea: () => void;
  ready: boolean;
  demo: boolean;
  native: boolean;
  busy: boolean;
  error: string;
  openCalendar: () => void;
  openTask: (task: Task) => void;
  add: (area: Area) => void;
  enableDemo: () => void;
  clearError: () => void;
};

export default function MobileOrbit({
  tasks,
  customAreas,
  availableAreas,
  areaIcons,
  removeArea,
  editAreaIcon,
  area,
  setArea,
  addArea,
  ready,
  demo,
  native,
  busy,
  error,
  openCalendar,
  openTask,
  add,
  enableDemo,
  clearError,
}: Props) {
  const [wide, setWide] = useState(() => matchMedia("(min-width: 900px) and (min-height: 420px)").matches);
  useEffect(() => {
    const query = matchMedia("(min-width: 900px) and (min-height: 420px)");
    const sync = () => setWide(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const [sphere, setSphere] = useState<Area>("Любовь");
  const [selected, setSelected] = useState<Partial<Record<Area, string>>>({});
  const [drag, setDrag] = useState(0);
  const previousAreaCount = useRef(customAreas.length);
  useEffect(() => {
    if (customAreas.length > previousAreaCount.current)
      setSphere(customAreas[customAreas.length - 1]!);
    previousAreaCount.current = customAreas.length;
  }, [customAreas]);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const stage = useRef<HTMLElement>(null);
  useChangeMotion(stage, area || "");
  const pointer = useRef<{
    id: number;
    y: number;
    lastY: number;
    time: number;
    position: number;
    reduced: boolean;
    moved: boolean;
    samples: { time: number; position: number }[];
  } | null>(null);
  const frame = useRef<number | null>(null);
  const pendingDrag = useRef(0);
  const cancelSettle = useRef<(() => void) | null>(null);
  const sound = useMemo(createOrbitSound, []);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("orbita-dial-sound") !== "off");
  const lastNotch = useRef(0);
  const shownDrag = useRef(0);
  useEffect(() => () => { cancelSettle.current?.(); sound.close(); }, [sound]);
  useEffect(() => { cancelSettle.current?.(); resetDrag(); }, [area]);
  function resetDrag() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    shownDrag.current = 0;
    lastNotch.current = 0;
    setDrag(0);
  }
  useEffect(() => {
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);
  const ignoreClickUntil = useRef(0);
  const wheelTime = useRef(0);
  const lastFlick = useRef({ time: -Infinity, velocity: 0, count: 0 });
  const preview = useRef<HTMLDialogElement>(null);
  const visible = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.area === area &&
          (isFact(task) || isEvent(task) || task.status !== "done"),
      ),
    [tasks, area],
  );
  const items = useMemo(
    () =>
      area
        ? visible.map((task) => ({
            id: task.id,
            title: task.title,
            area: task.area,
            task,
          }))
        : availableAreas.map((a) => ({
            id: a,
            title: areaLabel(a),
            area: a,
            task: undefined,
          })),
    [area, visible, availableAreas],
  );
  const badges = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = area ? task.id : task.area;
      const group = grouped.get(key);
      if (group) group.push(task);
      else grouped.set(key, [task]);
    }
    return new Map(
      items.map((item) => [
        item.id,
        reminderBadge(grouped.get(item.id) || [], now),
      ]),
    );
  }, [tasks, items, area, now]);
  const chosenId = area ? selected[area] : sphere;
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === chosenId),
  );
  const position = index + dialDetent(drag);
  const desktopSlots = Math.min(12, items.length);
  const focusedItem = items[wrapOrbitIndex(Math.round(position), items.length)];
  const ringItems = wide
    ? Array.from({ length: desktopSlots }, (_, slot) =>
        wrapOrbitIndex(Math.round(position) + slot - Math.floor(desktopSlots / 2), items.length))
    : visibleOrbitIndices(position, items.length);
  function showPosition(value: number, speed = 0) {
    shownDrag.current = value;
    setDrag(value);
    const notch = Math.round(dialDetent(value));
    if (notch !== lastNotch.current && soundOn) sound.play("tick", speed);
    lastNotch.current = notch;
  }
  function settle(value: number, speed: number, target: number, extraGlide = 0) {
    cancelSettle.current?.();
    cancelSettle.current = settleDial(value, speed, target, matchMedia("(prefers-reduced-motion: reduce)").matches, showPosition, () => { if (soundOn) sound.play("seat"); }, () => {
      if (!area && wrapOrbitIndex(index + target, items.length) !== index) haptic("sphere");
      select(index + target);
      resetDrag();
    }, extraGlide);
  }
  const needsDemo = !!area && !ready && !native;

  useEffect(() => {
    if (needsDemo) preview.current?.showModal();
    else preview.current?.close();
  }, [needsDemo]);

  function select(next: number) {
    const item = items[wrapOrbitIndex(next, items.length)];
    if (!item) return;
    if (area) setSelected((old) => ({ ...old, [area]: item.id }));
    else setSphere(item.area);
  }
  function enter(i: number) {
    const item = items[i];
    if (!item) return;
    cancelSettle.current?.();
    resetDrag();
    select(i);
    if (item.task) openTask(item.task);
    else {
      haptic("sphere");
      setArea(item.area);
      stage.current?.focus();
    }
  }
  function back() {
    setArea(null);
    setDrag(0);
    stage.current?.focus();
  }
  return (
    <main
      className={"mobile-orbit-home" + (wide ? " orbit-desktop" : "")}
      style={
        {
          "--orbit-color": colorForArea(items[index]?.area || sphere),
        } as CSSProperties
      }
      aria-label={demo ? "Орбита · деморежим" : "Орбита"}
    >
      <section
        ref={stage}
        className={"sphere-stage" + (drag ? " is-dragging" : "")}
        tabIndex={0}
        aria-label={area ? "Дела: " + areaLabel(area) : "Сферы жизни"}
        aria-roledescription="карусель"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (soundOn) sound.prepare();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            settle(shownDrag.current, 0, Math.round(shownDrag.current) + direction);
            event.currentTarget.focus();
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            cancelSettle.current?.();
            resetDrag();
            select(event.key === "Home" ? 0 : items.length - 1);
            event.currentTarget.focus();
          } else if (event.key === "Escape" && area) back();
          else if (
            (event.key === "Enter" || event.key === " ") &&
            event.target === event.currentTarget
          ) {
            event.preventDefault();
            enter(index);
          }
        }}
        onWheel={(event) => {
          if (
            Math.abs(event.deltaY) < 8 ||
            Date.now() - wheelTime.current < 220
          )
            return;
          wheelTime.current = Date.now();
          if (soundOn) sound.prepare();
          const direction = event.deltaY > 0 ? 1 : -1;
          settle(shownDrag.current, 0, Math.round(shownDrag.current) + direction);
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left + 24 ||
            event.clientX > bounds.right - 24 ||
            event.clientY > bounds.bottom - 32
          )
            return;
          cancelSettle.current?.();
          if (soundOn) sound.prepare();
          lastNotch.current = Math.round(shownDrag.current);
          const time = performance.now();
          pointer.current = {
            id: event.pointerId,
            y: event.clientY,
            lastY: event.clientY,
            time,
            position: shownDrag.current,
            reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
            samples: [{time, position: shownDrag.current}],
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          const start = pointer.current;
          if (!start || start.id !== event.pointerId) return;
          const distance = start.y - event.clientY;
          if (!start.moved && Math.abs(distance) > 8) {
            start.moved = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          if (start.moved) {
            const time = performance.now();
            start.position += dialDragStep(start.lastY - event.clientY, time - start.time, start.reduced);
            start.lastY = event.clientY;
            start.time = time;
            pendingDrag.current = start.position;
            start.samples.push({time, position: pendingDrag.current});
            while(start.samples.length > 2 && time - start.samples[0]!.time > 90) start.samples.shift();
            if (frame.current === null)
              frame.current = requestAnimationFrame(() => {
                frame.current = null;
                showPosition(pendingDrag.current);
              });
          }
        }}
        onPointerUp={(event) => {
          const start = pointer.current;
          if (!start || start.id !== event.pointerId) return;
          if (start.moved) {
            if(frame.current !== null) cancelAnimationFrame(frame.current);
            frame.current = null;
            const position = start.position + dialDragStep(start.lastY - event.clientY, performance.now() - start.time, start.reduced);
            const first = start.samples[0]!, last = start.samples.at(-1)!;
            const velocity = performance.now() - last.time <= 70 && last.time > first.time
              ? (last.position - first.position) * 1000 / (last.time - first.time) : 0;
            const now = performance.now();
            const previous = lastFlick.current;
            const fast = !start.reduced && Math.abs(velocity) >= 2.5;
            const sameDirection = velocity * previous.velocity > 0;
            const count = fast && sameDirection && now - previous.time <= 850
              ? Math.min(previous.count + 1, 4)
              : Number(fast);
            lastFlick.current = { time: now, velocity, count };
            const momentum = velocity * (1 + .28 * Math.max(0, count - 1));
            const extraGlide = count ? Math.min(.7, .035 * Math.abs(momentum) + .09 * (count - 1)) : 0;
            settle(position, momentum, dialTarget(position, momentum, start.reduced), extraGlide);
            ignoreClickUntil.current = performance.now() + 350;
          }
          pointer.current = null;
          if (!start.moved && shownDrag.current) settle(shownDrag.current, 0, Math.round(shownDrag.current));
        }}
        onPointerCancel={() => {
          pointer.current = null;
          resetDrag();
          ignoreClickUntil.current = performance.now() + 350;
        }}
      >
        {wide ? <div className="desktop-orbit-ring" aria-hidden="true" /> : <svg
          className="sphere-curve"
          aria-hidden="true"
        >
          <circle className="orbit-guide" cy="50%" r={455} fill="none" stroke="#a9a9ab" strokeWidth={1.1} />
        </svg>}
        <button type="button" className="orbit-sound-toggle" aria-pressed={soundOn} onPointerDown={event => event.stopPropagation()} onClick={() => { if (!soundOn) sound.prepare(); localStorage.setItem("orbita-dial-sound", soundOn ? "off" : "on"); setSoundOn(!soundOn); }}>{soundOn ? "Звук" : "Без звука"}</button>
        <span className="sphere-marker" aria-hidden="true" />
        {ringItems.map((i) => {
          const item = items[i]!;
          const offset = orbitOffset(i, position, items.length);
          const distance = Math.abs(offset);
          if (!wide && distance > 3.6) return null;
          const angle = offset * 2 * Math.PI / Math.max(1, desktopSlots);
          const Icon = sphereIcon(item.area, areaIcons);
          const badge = badges.get(item.id);
          const badgeText =
            badge === "due"
              ? "Время напоминания наступило"
              : "Есть напоминание";
          const isSelected = distance < .12;
          const highlight = Math.max(0, 1 - Math.max(0, distance - .12) * 3.2);
          return (
            <button
              key={item.id}
              data-task-id={item.task?.id}
              className={"sphere-item" + (isSelected ? " selected" : "")}
              aria-label={
                (area ? "Открыть дело: " : "Открыть сферу: ") + item.title
              }
              aria-current={isSelected ? "true" : undefined}
              title={item.title}
              aria-description={badge ? badgeText : undefined}
              style={
                {
                  "--sphere-color": colorForArea(item.area),
                  ...(wide ? {
                    "--ring-x": .5 * Math.sin(angle),
                    "--ring-y": -.5 * Math.cos(angle),
                    "--ring-opacity": items.length > desktopSlots ? Math.min(1, Math.max(0, 6 - distance)) : 1,
                  } : { top: "50%" }),
                  "--dial-highlight": highlight,
                  opacity: Math.max(0, 1 - Math.max(0, distance - 1.15) * .27),
                  transform: `translate3d(${512 * (1 - Math.cos(offset * dialAngle))}px, calc(-50% + ${512 * Math.sin(offset * dialAngle)}px), 0) rotate(${-offset * 11.6 * .45}deg)`,
                } as CSSProperties & Record<`--${string}`, number | string | undefined>
              }
              onClick={() => {
                if (performance.now() < ignoreClickUntil.current) return;
                enter(i);
              }}
            >
              <span className="sphere-title">
                {item.task && isFact(item.task) && (
                  <small className="orbit-fact-label">Факт</small>
                )}
                {item.title}
              </span>
              <span className="sphere-icon">
                <Icon size={29} strokeWidth={1.65} />
                {badge && (
                  <span
                    className={"sphere-reminder-dot " + badge}
                    role="img"
                    aria-label={badgeText}
                  />
                )}
              </span>
            </button>
          );
        })}
        {wide && focusedItem && <div className="desktop-orbit-center">
          <span>{area ? areaLabel(area) : "Сферы жизни"}</span>
          <strong>{focusedItem.title}</strong>
          <button type="button" onPointerDown={event => event.stopPropagation()}
            onClick={() => enter(wrapOrbitIndex(Math.round(position), items.length))}>
            {area ? "Открыть дело" : "Открыть сферу"}
          </button>
        </div>}
        {area && ready && !items.length && (
          <div className="sphere-empty" role="status">
            Пока нет дел
          </div>
        )}
        {area && native && !ready && (
          <div className="sphere-empty" role="status">
            Загрузка…
          </div>
        )}
      </section>
      <aside className="orbit-desktop-panel" aria-label="Навигация по сферам">
      {wide && <>
        <h1>{area ? areaLabel(area) : "Орбита"}</h1>
        <p>Вращайте кольцо колесом мыши или перетаскиванием.</p>
        <nav aria-label={area ? "Дела сферы" : "Список сфер"}>
          {items.map((item, itemIndex) => {
            const Icon = sphereIcon(item.area, areaIcons);
            return (
              <button key={item.id} type="button" aria-current={item.id === focusedItem?.id ? "true" : undefined}
                onClick={() => enter(itemIndex)}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.title}</span>
              </button>
            );
          })}
        </nav>
      </>}
      <button
        className="orbit-core"
        aria-label="Перейти к календарю"
        title="Календарь"
        onClick={openCalendar}
      >
        <ProgressRing
          done={
            tasks.filter(
              (t) =>
                !isFact(t) &&
                !isEvent(t) &&
                (!area || t.area === area) &&
                t.status === "done",
            ).length
          }
          total={
            tasks.filter((t) => !isFact(t) && (!area || t.area === area)).length
          }
        />
        <CalendarDays size={21} strokeWidth={1.7} />
      </button>
      {!area && (
        <button
          className="orbit-add-area"
          aria-label="Добавить сферу жизни"
          title="Добавить сферу жизни"
          onClick={addArea}
        >
          <Plus size={24} />
        </button>
      )}
      {area && ready && (
        <div className="sphere-area-actions">
        <button type="button" aria-label="Сменить иконку сферы" title="Сменить иконку сферы" disabled={busy} onClick={editAreaIcon}>
          <Pencil size={20} />
        </button>
        <button
          className="sphere-remove-area"
          aria-label={"Удалить сферу: " + areaLabel(area)}
          title="Удалить сферу"
          disabled={busy}
          onClick={removeArea}
        >
          <Trash2 size={20} />
        </button>
        </div>
      )}
      <div className="sphere-controls">
        {area ? (
          <button
            aria-label="Назад к сферам жизни"
            title="Назад"
            onClick={back}
          >
            <ArrowLeft size={23} />
          </button>
        ) : (
          <span />
        )}
        {area && ready && (
          <button
            aria-label={"Добавить дело: " + areaLabel(area)}
            title="Добавить дело"
            disabled={busy}
            onClick={() => add(area)}
          >
            <Plus size={26} />
          </button>
        )}
      </div>
      </aside>
      {error && (
        <div className="sphere-error" role="alert">
          {error}
          <button aria-label="Скрыть ошибку" onClick={clearError}>
            <X size={20} />
          </button>
        </div>
      )}
      {needsDemo && (
        <dialog
          ref={preview}
          className="sphere-preview"
          aria-labelledby="sphere-preview-title"
          onCancel={(event) => {
            event.preventDefault();
            back();
          }}
        >
          <button
            className="sphere-preview-close"
            aria-label="Закрыть"
            onClick={back}
          >
            <X size={22} />
          </button>
          <h2 id="sphere-preview-title">Посмотреть демо?</h2>
          <p>
            Примеры можно менять. После обновления страницы они сбросятся;
            личные данные не используются.
          </p>
          <button className="sphere-preview-start" onClick={enableDemo}>
            Посмотреть демо
          </button>
        </dialog>
      )}
    </main>
  );
}
