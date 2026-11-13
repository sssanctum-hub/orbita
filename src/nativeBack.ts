import { useEffect, useRef } from "react";

// Called by the Android dispatcher, not WebView.canGoBack(). Dialogs take priority.
declare global {
  interface Window {
    __orbitaBack?: () => boolean;
  }
}
export function dispatchAppBack(fallback: () => void) {
  const dialogs = [
    ...document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
  ];
  const focused = document.activeElement?.closest<HTMLDialogElement>("dialog[open]");
  const top = focused || dialogs.at(-1);
  // A closing sheet still owns this gesture; never fall through to its parent.
  if (top?.dataset?.exiting === "true") return true;
  const overlay = new CustomEvent("orbita:overlay-back", {
    cancelable: true,
    detail: { dialog: top || null },
  });
  if (!window.dispatchEvent(overlay)) return true;
  if (top) {
    // cancel is non-bubbling, matching the browser's Escape / Android Back semantics.
    const event = new Event("cancel", { cancelable: true });
    if (top.dispatchEvent(event)) top.close();
    return true;
  }
  const local = new Event("orbita:local-back", { cancelable: true });
  if (!window.dispatchEvent(local)) return true;
  fallback();
  return true;
}
export function useNativeBack(back: () => void) {
  const latest = useRef(back);
  latest.current = back;
  useEffect(() => {
    const handler = () => dispatchAppBack(() => latest.current());
    window.__orbitaBack = handler;
    return () => {
      if (window.__orbitaBack === handler) delete window.__orbitaBack;
    };
  }, []);
}
