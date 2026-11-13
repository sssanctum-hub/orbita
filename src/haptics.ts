declare global {
  interface Window {
    OrbitaDevice?: { haptic(kind: string): void; showKeyboard?(): void; setTitleEditing?(active: boolean): void; updateTasks?(json: string): void; widgetError?(): string };
  }
}
export const vibrationKey = "orbita-vibration";
let last = 0;
export function haptic(kind: "selection" | "success" | "impact" | "sphere" = "selection") {
  try {
    if (localStorage.getItem(vibrationKey) === "off" || Date.now() - last < 70) return;
    last = Date.now();
    if (window.OrbitaDevice) window.OrbitaDevice.haptic(kind);
    else navigator.vibrate?.(kind === "success" ? [8, 28, 8] : kind === "sphere" ? 4 : 8);
  } catch {
    /* Haptics are optional and never block an action. */
  }
}

// One delegated listener also covers controls inside native dialogs.
export function installControlHaptics() {
  const selector = [
    ".planner-modes button", ".task-kind-switch button",
    ".orbit-switch-button", ".dock-button", ".backlog-button",
    ".task-choice-card", ".time-picker-trigger",
    ".time-picker-confirm", ".time-picker-clear",
    ".sphere-controls button", ".orbit-core",
  ].join(",");
  const click = (event: MouseEvent) => {
    if (!event.isTrusted || event.defaultPrevented) return;
    const control = event.target instanceof Element ? event.target.closest(selector) : null;
    if (!control || control.matches(":disabled, [aria-disabled=true], [aria-pressed=true], [aria-selected=true]")) return;
    haptic();
  };
  document.addEventListener("click", click, true);
  return () => document.removeEventListener("click", click, true);
}
