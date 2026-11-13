import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../motionTokens";
export default function ProgressRing({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const reduce = useReducedMotion();
  return (
    <svg
      className="orbit-progress-ring"
      viewBox="0 0 64 64"
      aria-label={done + " из " + total + " дел выполнено"}
      role="img"
    >
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".12"
        strokeWidth="2"
      />
      <motion.circle
        cx="32"
        cy="32"
        r="29"
        fill="none"
        stroke="#32d879"
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
        initial={false}
        animate={{ pathLength: total ? done / total : 0 }}
        transition={reduce ? { duration: 0 } : motionTokens.gentle}
      />
    </svg>
  );
}
