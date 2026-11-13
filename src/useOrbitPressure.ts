import { useLayoutEffect, type RefObject, type DependencyList } from "react";
import { orbitInset } from "./orbitPressure";

export function useOrbitPressure(
  root: RefObject<HTMLElement>,
  deps: DependencyList,
) {
  useLayoutEffect(() => {
    const element = root.current;
    const button = element
      ?.closest(".planner")
      ?.querySelector(".orbit-switch-button");
    if (!element || !button) return;
    let frame: number | null = null;
    const cards = [...element.querySelectorAll<HTMLElement>(".day-placed")];
    const bubbles = [
      ...element.querySelectorAll<HTMLElement>(".week-bubble-slot"),
    ];
    const lastValues = new WeakMap<HTMLElement, string>();
    const writeValue = (slot: HTMLElement, property: string, value: number) => {
      const rounded = Math.round(value * 100) / 100 + "px";
      if (lastValues.get(slot) === rounded) return;
      lastValues.set(slot, rounded);
      slot.style.setProperty(property, rounded);
    };
    const update = () => {
      frame = null;
      const box = button.getBoundingClientRect();
      const cx = box.left + box.width / 2,
        cy = box.top + box.height / 2;
      // Read untransformed slots first. Wrappers never change size on scroll.
      const cardInsets = cards.map((slot) => {
        const r = slot.getBoundingClientRect();
        return Math.min(
          r.width * 0.35,
          orbitInset(r.top, r.bottom, r.right, cx, cy),
        );
      });
      const rows = new Map<string, { slot: HTMLElement; rect: DOMRect }[]>();
      bubbles.forEach((slot) => {
        const rect = slot.getBoundingClientRect();
        const key = String(rect.top);
        const row = rows.get(key) || [];
        row.push({ slot, rect });
        rows.set(key, row);
      });
      const shifts: [HTMLElement, number][] = [];
      rows.forEach((row) => {
        const last = row[row.length - 1]!.rect;
        // Include the stack sheets and a small air gap.
        const inset = orbitInset(
          last.top,
          last.bottom,
          last.right + 10,
          cx,
          cy,
        );
        const step =
          row.length > 1 ? Math.min(26, inset / (row.length - 1)) : 0;
        row.forEach(({ slot }, i) =>
          shifts.push([
            slot,
            row.length === 1 ? Math.min(16, inset) : step * i,
          ]),
        );
      });
      cards.forEach((slot, i) =>
        writeValue(slot, "--pressure-inset", cardInsets[i]!),
      );
      shifts.forEach(([slot, shift]) =>
        writeValue(slot, "--bubble-shift", shift),
      );
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    const scrollRoot = element.closest(".planner-surface") || element;
    scrollRoot.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    scrollRoot.addEventListener("animationend", schedule);
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    observer.observe(button);
    schedule();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      scrollRoot.removeEventListener("scroll", schedule, true);
      scrollRoot.removeEventListener("animationend", schedule);
      window.removeEventListener("resize", schedule);
      cards.forEach((slot) => slot.style.removeProperty("--pressure-inset"));
      bubbles.forEach((slot) => slot.style.removeProperty("--bubble-shift"));
    };
  }, deps);
}
