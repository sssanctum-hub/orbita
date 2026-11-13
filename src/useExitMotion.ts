import { useCallback, useEffect, useRef, type RefObject } from "react";
import { motionTokens } from "./motionTokens";
type Target = RefObject<HTMLDialogElement> | (() => HTMLDialogElement | null);
export function useExitMotion(target: Target) {
  const active = useRef<(() => void) | null>(null);
  useEffect(() => () => active.current?.(), []);
  return useCallback(
    (after: () => void = () => {}) => {
      if (active.current) return;
      const candidate =
        typeof target === "function" ? target() : target.current;
      if (!candidate?.open) {
        after();
        return;
      }
      const el: HTMLDialogElement = candidate;
      const inert = el.inert;
      el.inert = true;
      el.dataset.exiting = "true";
      if (!el.animate || document.hidden) {
        el.close();
        el.inert = inert;
        delete el.dataset.exiting;
        after();
        return;
      }
      // Opacity only: no source-rectangle reads, full-window morph or repainting text.
      const animation = el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], {
        duration: motionTokens.duration.exitFade * 1000,
        easing: "ease-out",
        fill: "both",
      });
      let finished = false;
      const timer = setTimeout(finish, 150);
      function clean() {
        clearTimeout(timer);
        el.inert = inert;
        delete el.dataset.exiting;
        active.current = null;
      }
      function finish() {
        if (finished) return;
        finished = true;
        el.close();
        animation.cancel();
        clean();
        after();
      }
      active.current = () => {
        finished = true;
        animation.cancel();
        clean();
      };
      void animation.finished.then(finish, () => {});
    },
    [target],
  );
}
