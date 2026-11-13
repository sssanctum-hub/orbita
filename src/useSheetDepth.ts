import { useEffect } from "react";
export function useSheetDepth() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const open = [
        ...document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
      ];
      document.body.dataset.sheetDepth = String(open.length);
      document
        .querySelectorAll("[data-top-dialog]")
        .forEach((el) => el.removeAttribute("data-top-dialog"));
      open.at(-1)?.setAttribute("data-top-dialog", "true");
    };
    const observer = new MutationObserver((records) => {
      if (
        !records.some(
          (r) =>
            r.type === "attributes" ||
            [...r.addedNodes, ...r.removedNodes].some(
              (n) =>
                n instanceof Element &&
                (n.matches("dialog") || n.querySelector("dialog")),
            ),
        )
      )
        return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      delete document.body.dataset.sheetDepth;
    };
  }, []);
}
