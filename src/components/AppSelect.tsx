import { useExitMotion } from "../useExitMotion";
import {
  Children,
  isValidElement,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown, X } from "lucide-react";
type Props = {
  children: ReactNode;
  value: string | number;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  "aria-label"?: string;
  onChange: (event: { target: { value: string } }) => void;
};
// A real modal keeps the picker above its parent editor and handles Android Back.
export default function AppSelect(props: Props) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const options = Children.toArray(props.children)
    .filter(isValidElement)
    .map((child) => {
      const p = child.props as { value: string | number; children: ReactNode };
      return { value: String(p.value), label: p.children };
    });
  const selected = options.find((o) => o.value === String(props.value));
  const dismiss = useExitMotion(dialog);
  function close() {
    dismiss(() => {
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    });
  }
  function show() {
    setOpen(true);
    dialog.current?.showModal();
    const buttons =
      dialog.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
    buttons?.[
      Math.max(
        0,
        options.findIndex((o) => o.value === String(props.value)),
      )
    ]?.focus();
  }
  return (
    <span className="app-select">
      <button
        type="button"
        id={props.id}
        ref={trigger}
        className="app-select-trigger"
        disabled={props.disabled}
        aria-label={props["aria-label"]}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          show();
        }}
      >
        <span>{selected?.label || "Выбрать"}</span>
        <ChevronDown size={17} />
      </button>
      <dialog
        ref={dialog}
        id={id}
        className="app-select-dialog"
        aria-label={props["aria-label"] || "Выберите вариант"}
        onCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          close();
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.target === dialog.current) close();
        }}
      >
        <header>
          <strong>{props["aria-label"] || "Выберите вариант"}</strong>
          <button type="button" aria-label="Закрыть список" onClick={close}>
            <X size={21} />
          </button>
        </header>
        <div
          className="app-select-options"
          role="listbox"
          aria-label={props["aria-label"] || "Варианты"}
          onKeyDown={(e) => {
            const buttons = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="option"]',
              ),
            );
            const index = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            let next = index;
            if (e.key === "ArrowDown") next = (index + 1) % buttons.length;
            else if (e.key === "ArrowUp")
              next = (index - 1 + buttons.length) % buttons.length;
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = buttons.length - 1;
            else return;
            e.preventDefault();
            buttons[next]?.focus();
          }}
        >
          {options.map((o) => (
            <button
              type="button"
              role="option"
              key={o.value}
              aria-selected={o.value === String(props.value)}
              onClick={(e) => {
                e.preventDefault();
                props.onChange({ target: { value: o.value } });
                close();
              }}
            >
              <span>{o.label}</span>
              {o.value === String(props.value) && <Check size={20} />}
            </button>
          ))}
        </div>
      </dialog>
    </span>
  );
}
