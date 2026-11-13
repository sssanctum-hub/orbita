import { invoke } from "@tauri-apps/api/core";
import { ArrowUpRight, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { loadData } from "../api";
import { areaLabel, availableAreas, isEvent, isFact, type Data } from "../domain";
import { sphereIcon } from "../areaAppearance";
import { wrapOrbitIndex } from "../orbitMath";
import "./orbit-overlay.css";

export default function OrbitOverlay() {
  const root = useRef<HTMLElement>(null);
  const [data, setData] = useState<Data>();
  const [selection, setSelection] = useState(0);
  const [hovered, setHovered] = useState<number>();
  const [focused, setFocused] = useState<number>();
  const [error, setError] = useState("");
  const areas = data ? availableAreas(data) : [];
  const preview = hovered ?? focused ?? selection;
  const area = areas[preview];
  const pending = data?.tasks.filter(task =>
    task.area === area && task.status !== "done" && !isFact(task) && !isEvent(task)
  ) ?? [];
  const next = pending.reduce<(typeof pending)[number] | undefined>((earliest, task) =>
    !earliest || (task.due ?? "9999") < (earliest.due ?? "9999") ? task : earliest, undefined);

  useEffect(() => {
    root.current?.focus();
    let active = true;
    loadData().then(value => {
      if (active) setData(value);
    }, () => {
      if (active) setError("Не удалось загрузить сферы");
    });
    return () => { active = false; };
  }, []);

  function close(openMain: boolean) {
    void invoke("finish_orbit_overlay", { openMain }).catch(() => setError("Не удалось закрыть кольцо"));
  }

  return (
    <main className="orbit-overlay" ref={root} tabIndex={0} aria-label="Кольцо Орбиты"
      onWheel={event => {
        if (!event.deltaY) return;
        setHovered(undefined);
        setFocused(undefined);
        setSelection(value => wrapOrbitIndex(value + Math.sign(event.deltaY), areas.length));
      }}
      onKeyDown={event => {
        if (event.key === "Escape") close(false);
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          root.current?.focus();
          setHovered(undefined);
          setFocused(undefined);
          setSelection(value => wrapOrbitIndex(value + (event.key === "ArrowRight" ? 1 : -1), areas.length));
        }
      }}>
      <div className="orbit-overlay-arc" aria-hidden="true" />
      {Array.from({ length: Math.min(7, areas.length) }, (_, slot) => {
        const offset = slot - Math.floor(Math.min(7, areas.length) / 2);
        const index = wrapOrbitIndex(selection + offset, areas.length);
        const item = areas[index]!;
        const Icon = sphereIcon(item, data?.areaIcons);
        const angle = offset * Math.PI / 9;
        const style = {
          "--arc-x": Math.sin(angle),
          "--arc-y": Math.cos(angle),
        } as CSSProperties;
        return <button key={item} className="orbit-overlay-sphere" type="button" style={style}
          aria-label={areaLabel(item)} aria-pressed={index === selection} data-preview={index === preview}
          onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(index); }}
          onPointerLeave={() => setHovered(value => value === index ? undefined : value)}
          onFocus={() => setFocused(index)} onBlur={() => setFocused(undefined)}
          onClick={() => { setHovered(undefined); setFocused(undefined); setSelection(index); }}>
          <Icon size={18} aria-hidden="true" />
        </button>;
      })}
      <div className="orbit-overlay-info">
        {error ? <span role="alert">{error}</span> : <strong>{area ? areaLabel(area) : data ? "Пока нет сфер" : "Загрузка…"}</strong>}
        {area && <span className="orbit-overlay-count">Незавершённых дел: {pending.length}</span>}
        {next && <span className="orbit-overlay-next" title={next.title}>{next.title}</span>}
        <div className="orbit-overlay-actions">
          <button type="button" onClick={() => close(true)}><ArrowUpRight size={14} /> Открыть Орбиту</button>
          <button className="orbit-overlay-close" type="button" aria-label="Скрыть кольцо" onClick={() => close(false)}><X size={15} /></button>
        </div>
      </div>
    </main>
  );
}
