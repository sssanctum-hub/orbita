import { animate, useMotionValue } from "motion/react";
import {
  useLayoutEffect,
  useRef,
  type RefObject,
  type PointerEvent,
} from "react";
import { motionTokens, reducedMotion } from "./motionTokens";
import { haptic } from "./haptics";

export function useTaskSheet(
  dialog: RefObject<HTMLDialogElement>,
  close: () => void,
  locked: boolean,
) {
  const y = useMotionValue(0),
    scale = useMotionValue(1);
  const start = useRef<{
    id: number;
    y: number;
    at: number;
    last: number;
    time: number;
    velocity: number;
  } | null>(null);
  const controls = useRef<ReturnType<typeof animate> | null>(null);
  const latest = useRef({ close, locked });
  latest.current = { close, locked };
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (!el.open) el.showModal();
    el.dataset.springSheet = "true";
    // A single native fade, independent from JS and without scaling the contents.
    const animation = el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: motionTokens.duration.reveal * 1000,
      easing: "ease-out",
    });
    return () => animation.cancel();
  }, [dialog]);
  const settle = () => {
    controls.current?.stop();
    controls.current = animate(
      y,
      0,
      reducedMotion() ? motionTokens.reduced : motionTokens.spring,
    );
    animate(
      scale,
      1,
      reducedMotion() ? motionTokens.reduced : motionTokens.spring,
    );
  };
  useLayoutEffect(() => () => controls.current?.stop(), []);
  return {
    y,
    scale,
    headerGesture: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (
          latest.current.locked ||
          !e.isPrimary ||
          e.button !== 0 ||
          (e.target as Element).closest("button,input,a")
        )
          return;
        if (
          e.clientX < motionTokens.gesture.edge ||
          e.clientX > innerWidth - motionTokens.gesture.edge
        )
          return;
        controls.current?.stop();
        start.current = {
          id: e.pointerId,
          y: e.clientY,
          at: performance.now(),
          last: e.clientY,
          time: performance.now(),
          velocity: 0,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const now = performance.now(),
          delta = e.clientY - s.y;
        s.velocity = ((e.clientY - s.last) / Math.max(1, now - s.time)) * 1000;
        s.last = e.clientY;
        s.time = now;
        y.set(delta > 0 ? delta : delta * 0.12);
        scale.set(1);
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        start.current = null;
        if (
          !latest.current.locked &&
          (y.get() > motionTokens.gesture.dismiss ||
            (y.get() > 40 && s.velocity > motionTokens.gesture.dismissVelocity))
        ) {
          haptic();
          latest.current.close();
        } else settle();
      },
      onPointerCancel: () => {
        start.current = null;
        settle();
      },
    },
  };
}
