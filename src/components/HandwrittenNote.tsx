import { useRef, useState, type PointerEvent } from "react";
import { Pencil, Undo2 } from "lucide-react";

export default function HandwrittenNote({ strokes, disabled, change }: {
  strokes: string[];
  disabled: boolean;
  change: (strokes: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const active = useRef<{ id: number; path: string } | null>(null);
  function point(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(400 * Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)));
    const y = Math.round(240 * Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)));
    return x + " " + y;
  }
  return <>
    <button type="button" className="note-pencil" disabled={disabled} aria-pressed={open} aria-label="Рукописная заметка" onClick={() => setOpen(!open)}>
      <Pencil size={18} />
    </button>
    {(open || strokes.length > 0) && <div className="note-paper">
      <svg viewBox="0 0 400 240" aria-label="Лист рукописной заметки"
        onPointerDown={event => {
          if (!open || disabled || active.current || event.button !== 0 || strokes.length >= 200) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const start = point(event);
          active.current = { id: event.pointerId, path: "M" + start + "L" + start };
          setDraft(active.current.path);
        }}
        onPointerMove={event => {
          const stroke = active.current;
          if (stroke?.id !== event.pointerId || stroke.path.length >= 8000) return;
          stroke.path += "L" + point(event);
          setDraft(stroke.path);
        }}
        onPointerUp={event => {
          if (active.current?.id !== event.pointerId) return;
          change([...strokes, active.current.path]);
          active.current = null;
          setDraft("");
        }}
        onLostPointerCapture={() => { active.current = null; setDraft(""); }}
        style={{ touchAction: open ? "none" : "pan-y" }}>
        {[...strokes, draft].map((path, index) => <path key={index} d={path} />)}
      </svg>
      {open && <button type="button" disabled={disabled || !strokes.length} onClick={() => change(strokes.slice(0, -1))}><Undo2 size={16} /> Отменить штрих</button>}
    </div>}
  </>;
}
