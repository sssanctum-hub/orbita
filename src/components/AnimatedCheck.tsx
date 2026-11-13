import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../motionTokens";
export default function AnimatedCheck({
  checked,
  label,
  disabled,
  onClick,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      className={"animated-check" + (checked ? " is-checked" : "")}
      data-task-control="true"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      animate={{ scale: 1 }}
      transition={
        reduce
          ? motionTokens.reduced
          : { duration: motionTokens.duration.bounce }
      }
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <motion.path
          d="M7 12.2l3.1 3.1L17 8.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={
            reduce
              ? motionTokens.reduced
              : { duration: motionTokens.duration.check }
          }
        />
      </svg>
    </motion.button>
  );
}
