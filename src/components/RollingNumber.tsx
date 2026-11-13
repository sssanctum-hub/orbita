import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { motionTokens } from "../motionTokens";
import DotText from "./DotText";
export default function RollingNumber({
  value,
  dotted = false,
  pad = 0,
  animateKey,
}: {
  value: number;
  dotted?: boolean;
  pad?: number;
  animateKey?: string;
}) {
  const reduce = useReducedMotion(),
    previous = useRef(value);
  const direction = value >= previous.current ? 1 : -1;
  previous.current = value;
  const text = String(value).padStart(pad, "0");
  if (dotted) return <span className="rolling-number is-dotted" aria-label={text}><span aria-hidden="true"><DotText text={text} cell={10.5} animateKey={animateKey ?? text} /></span></span>;
  return (
    <span
      className={"rolling-number" + (dotted ? " is-dotted" : "")}
      aria-label={text}
    >
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <motion.span
          key={text}
          aria-hidden="true"
          initial={{ opacity: 0, y: reduce ? 0 : direction * 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -direction * 10 }}
          transition={reduce ? motionTokens.reduced : motionTokens.gentle}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
