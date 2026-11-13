import type { Transition } from "motion/react";

// Bounded, compositor-friendly motion: no long spring tails or list stagger.
const ease = [0.2, 0.8, 0.2, 1] as [number, number, number, number];
export const motionTokens = {
  spring: { type: "tween", duration: 0.16, ease } as Transition,
  gentle: { type: "tween", duration: 0.14, ease } as Transition,
  press: { type: "tween", duration: 0.1, ease } as Transition,
  fade: { duration: 0.12, ease: "linear" } as Transition,
  reduced: { duration: 0.08, ease: "linear" } as Transition,
  duration: {
    check: 0.12,
    bounce: 0.14,
    reveal: 0.12,
    revealDelay: 0,
    exitFade: 0.1,
  },
  dots: { durationMs: 140, stepMs: 12, reducedMs: 80 },
  stagger: 0,
  maxStagger: 0,
  settleMs: 180,
  completionMs: 120,
  gesture: {
    edge: 26,
    swipeReveal: 88,
    swipeCommit: 152,
    dismiss: 120,
    dismissVelocity: 650,
  },
} as const;
export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export function installMotionTokens() {
  const style = document.documentElement.style;
  for (const [name, value] of Object.entries({
    "--ease-spring": "cubic-bezier(.2,.8,.2,1)",
    "--ease-out": "cubic-bezier(.2,.8,.2,1)",
    "--motion-sheet": "120ms",
    "--motion-control": "120ms",
    "--motion-screen": "0ms",
    "--motion-surface": "0ms",
    "--motion-press": "80ms",
  }))
    style.setProperty(name, value);
}
