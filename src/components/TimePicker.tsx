import { haptic } from "../haptics";
import {wrapWheel,wheelValue,wheelStart} from "../timeWheel";
import { useExitMotion } from "../useExitMotion";
import {
  useId,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Check, Clock3, X } from "lucide-react";
type Props = {
  label: string;
  value: string;
  change: (value: string) => void;
  disabled?: boolean;
  clearable?: boolean;
};
const ROW = 64;
const pad = (n: number) => String(n).padStart(2, "0");
function Wheel({
  label,
  count,
  initial,
  wheelRef,
}: {
  label: string;
  count: number;
  initial: number;
  wheelRef: RefObject<HTMLDivElement>;
}) {
  const [selected, setSelected] = useState(initial);
  const frame = useRef(0);
  const previous = useRef(initial);
  const interacted = useRef(false);
  const visible = useRef(new Set<number>());
  const paint = () => {
    const el = wheelRef.current;
    if (!el) return;
    let position = el.scrollTop / ROW;
    if (position < count * .5 || position > count * 4.5) {
      position = count * 2 + wrapWheel(position,count);
      el.scrollTop = position * ROW;
    }
    const value = wheelValue(position,count);
    if (value !== previous.current) {
      previous.current = value;
      setSelected(value);
      if (interacted.current) haptic();
    }
    // Update only the visible seven rows, not every minute on every frame.
    const next = new Set<number>();
    const from = Math.max(0, Math.floor(position - 3.5)),
      to = Math.min(count * 5 - 1, Math.ceil(position + 3.5));
    for (let i = from; i <= to; i++) {
      const node = el.children[i] as HTMLElement,
        distance = i - position,
        depth = Math.abs(distance);
      if (depth >= 3.5) continue;
      next.add(i);
      node.style.visibility = "visible";
      const direction = label === "Часы" ? -1 : 1;
      node.style.transform = `translateX(${direction * depth * depth * 10}px) scale(${1 - depth * 0.12})`;
      node.style.opacity = String(Math.max(0.15, 1 - depth * 0.22));
    }
    for (const i of visible.current)
      if (!next.has(i))
        (el.children[i] as HTMLElement).style.visibility = "hidden";
    visible.current = next;
  };
  useLayoutEffect(() => {
    const el = wheelRef.current;
    if (el) {
      for (const child of el.children)
        (child as HTMLElement).style.visibility = "hidden";
      el.scrollTop = wheelStart(initial,count) * ROW;
    }
    paint();
  }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  function choose(n: number) {
    interacted.current = true;
    const next = wrapWheel(n,count);
    const current = (wheelRef.current?.scrollTop || 0) / ROW;
    const raw = count - 1 - next;
    const row = raw + Math.round((current - raw) / count) * count;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    wheelRef.current?.scrollTo({
      top: row * ROW,
      behavior: reduced ? "instant" : "smooth",
    });
  }
  return (
    <div className="time-wheel-column">
      <span className="time-wheel-caption">{label}</span>
      <div
        ref={wheelRef}
        className="time-wheel-scroll"
        onPointerDown={() => { interacted.current = true; }}
        onTouchStart={() => { interacted.current = true; }}
        onWheel={() => { interacted.current = true; }}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={selected}
        aria-valuetext={pad(selected)}
        onScroll={() => {
          cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(paint);
        }}
        onKeyDown={(e) => {
          const step: Record<string, number> = {
            ArrowUp: 1,
            ArrowDown: -1,
            PageUp: 5,
            PageDown: -5,
          };
          if (e.key in step) {
            e.preventDefault();
            choose(selected + step[e.key]!);
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            choose(e.key === "Home" ? 0 : count - 1);
          }
        }}
      >
        {Array.from({ length: count * 5 }, (_, i) => {
          const n = wheelValue(i,count);
          return (
            <div
              key={i}
              aria-hidden="true"
              className="time-wheel-number"
              onClick={() => choose(n)}
            >
              {pad(n)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TimePicker({
  label,
  value,
  change,
  disabled,
  clearable = true,
}: Props) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const hours = useRef<HTMLDivElement>(null),
    minutes = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState("09:00");
  useLayoutEffect(() => {
    if (open) {
      hours.current?.scrollTo({
        top: wheelStart(Number(seed.slice(0, 2)),24) * ROW,
        behavior: "instant",
      });
      minutes.current?.scrollTo({
        top: wheelStart(Number(seed.slice(3)),60) * ROW,
        behavior: "instant",
      });
      hours.current?.focus();
    }
  }, [open, seed]);
  const dismiss = useExitMotion(dialog);
  function close() {
    dismiss(() => {
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    });
  }
  function show() {
    setSeed(value || "09:00");
    setOpen(true);
    dialog.current?.showModal();
  }
  function confirm() {
    const h = wheelValue((hours.current?.scrollTop || 0) / ROW,24);
    const m = wheelValue((minutes.current?.scrollTop || 0) / ROW,60);
    change(pad(h) + ":" + pad(m));
    close();
  }
  return (
    <div className="task-time-row">
      <span>{label}</span>
      <button
        type="button"
        className="time-picker-trigger"
        ref={trigger}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={show}
      >
        <Clock3 size={21} />
        <span>{value || "Выбрать время"}</span>
      </button>
      <dialog
        ref={dialog}
        id={id}
        className="time-picker-dialog"
        aria-labelledby={id + "-title"}
        onCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          close();
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.target === dialog.current) close();
        }}
      >
        <header>
          <h3 id={id + "-title"}>{label}</h3>
          <p>Прокрутите часы и минуты</p>
        </header>
        {open && (
          <div className="time-wheels">
            <Wheel
              label="Часы"
              count={24}
              initial={Number(seed.slice(0, 2))}
              wheelRef={hours}
            />
            <span className="time-wheel-colon" aria-hidden="true">
              :
            </span>
            <Wheel
              label="Минуты"
              count={60}
              initial={Number(seed.slice(3))}
              wheelRef={minutes}
            />
          </div>
        )}
        <footer>
          <button
            type="button"
            className="time-picker-cancel"
            aria-label="Отменить выбор времени"
            onClick={close}
          >
            <X size={22} />
          </button>
          {clearable ? (
            <button
              type="button"
              className="time-picker-clear"
              onClick={() => {
                change("");
                close();
              }}
            >
              Без времени
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="time-picker-confirm"
            aria-label="Подтвердить время"
            onClick={confirm}
          >
            <Check size={25} />
          </button>
        </footer>
      </dialog>
    </div>
  );
}
