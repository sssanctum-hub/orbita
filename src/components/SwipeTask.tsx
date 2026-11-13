import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { Task } from "../domain";
import { useTaskActions } from "../taskMotion";
import { motionTokens } from "../motionTokens";
import { haptic } from "../haptics";
export default function SwipeTask({
  task,
  date,
  children,
  onGestureStart,
  timeDragging = false,
}: {
  task: Task;
  date: string;
  children: ReactNode;
  onGestureStart: () => void;
  timeDragging?: boolean;
}) {
  const x = useMotionValue(0),
    reduce = useReducedMotion();
  const { act, busy } = useTaskActions();
  const [revealed, setRevealed] = useState(false),
    [error, setError] = useState("");
  const shell = useRef<HTMLDivElement>(null),
    suppress = useRef(0);
  useEffect(() => {
    if (!revealed) return;
    const back = (event: Event) => {
      if ((event as CustomEvent).detail?.dialog) return;
      event.preventDefault();
      restore();
    };
    window.addEventListener("orbita:overlay-back", back);
    return () => window.removeEventListener("orbita:overlay-back", back);
  }, [revealed]);
  const restore = () => {
    setRevealed(false);
    animate(x, 0, reduce ? motionTokens.reduced : motionTokens.spring);
  };
  const remove = async () => {
    try {
      await act(task, date, true);
      haptic("impact");
    } catch (e) {
      setError(String(e));
      restore();
    }
  };
  return (
    <div
      ref={shell}
      className="day-swipe-shell"
      data-swipe-row="true"
      data-gesture-at={revealed ? Date.now() : undefined}
    >
      <button
        type="button"
        className="task-swipe-delete"
        aria-label={"Удалить: " + task.title}
        aria-hidden={!revealed}
        tabIndex={revealed ? 0 : -1}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void remove();
        }}
      >
        <Trash2 size={19} />
      </button>
      <motion.div
        className="day-swipe-content"
        onClickCapture={(e) => {
          if (Date.now() < suppress.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (revealed && (e.target as Element).closest(".day-event")) {
            e.preventDefault();
            e.stopPropagation();
            restore();
          }
        }}
        style={{ x }}
        drag={busy || timeDragging ? false : "x"}
        dragDirectionLock
        dragMomentum={false}
        dragConstraints={{ left: -88, right: 0 }}
        dragElastic={{ left: 0.25, right: 0.05 }}
        onDirectionLock={(axis) => {
          if (axis !== "x") return;
          suppress.current = Date.now() + 2000;
          setRevealed(true);
          onGestureStart();
        }}
        onDragEnd={(_, info) => {
          suppress.current = Date.now() + 180;
          if (info.offset.x < -motionTokens.gesture.swipeCommit) {
            void remove();
            return;
          }
          const open = info.offset.x < -42 || info.velocity.x < -500;
          setRevealed(open);
          animate(
            x,
            open ? -88 : 0,
            reduce ? motionTokens.reduced : motionTokens.spring,
          );
          if (open) haptic();
        }}
      >
        {children}
      </motion.div>
      {error && (
        <p className="task-row-error" role="alert">
          {error.replace(/^Error:\s*/, "")}
        </p>
      )}
    </div>
  );
}
