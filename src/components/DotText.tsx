import { memo, useLayoutEffect, useRef } from "react";
import { motionTokens } from "../motionTokens";

// Dot-matrix lettering (5x7 cells) for the date header, in the spirit of an LED ticker.
const G: Record<string, string[]> = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  А: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  Б: ["#####", "#....", "#....", "####.", "#...#", "#...#", "####."],
  В: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  Г: ["#####", "#....", "#....", "#....", "#....", "#....", "#...."],
  Д: ["..##.", ".#.#.", ".#.#.", ".#.#.", ".#.#.", "#####", "#...#"],
  Е: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  Ё: [".#.#.", "#####", "#....", "####.", "#....", "#....", "#####"],
  Ж: ["#.#.#", "#.#.#", ".###.", "..#..", ".###.", "#.#.#", "#.#.#"],
  З: [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."],
  И: ["#...#", "#...#", "#..##", "#.#.#", "##..#", "#...#", "#...#"],
  Й: [".#.#.", "#...#", "#..##", "#.#.#", "##..#", "#...#", "#...#"],
  К: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  Л: ["..###", ".#..#", ".#..#", ".#..#", ".#..#", "#...#", "#...#"],
  М: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  Н: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  О: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  П: ["#####", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#"],
  Р: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  С: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  Т: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  У: ["#...#", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  Ф: ["..#..", ".###.", "#.#.#", "#.#.#", ".###.", "..#..", "..#.."],
  Х: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Ц: ["#..#.", "#..#.", "#..#.", "#..#.", "#..#.", "#####", "....#"],
  Ч: ["#...#", "#...#", "#...#", ".####", "....#", "....#", "....#"],
  Ш: ["#.#.#", "#.#.#", "#.#.#", "#.#.#", "#.#.#", "#.#.#", "#####"],
  Щ: ["#.#.#", "#.#.#", "#.#.#", "#.#.#", "#.#.#", "#####", "....#"],
  Ъ: ["##...", ".#...", ".#...", ".###.", ".#..#", ".#..#", ".###."],
  Ы: ["#...#", "#...#", "#...#", "##..#", "#.#.#", "#.#.#", "##..#"],
  Ь: ["#....", "#....", "#....", "####.", "#...#", "#...#", "####."],
  Э: [".###.", "#...#", "....#", ".####", "....#", "#...#", ".###."],
  Ю: ["#..#.", "#.#.#", "#.#.#", "###.#", "#.#.#", "#.#.#", "#..#."],
  Я: [".####", "#...#", "#...#", ".####", "..#.#", ".#..#", "#...#"],
  ":": [".....", "..#..", "..#..", ".....", "..#..", "..#..", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", "..##.", "..##."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "▤": ["#####", "#...#", "#####", ".....", "#####", "#...#", "#####"],
  "↗": [".####", "....#", "...##", "..#.#", ".#...", "#....", "....."],
  "→": [".....", "..#..", "...#.", "#####", "...#.", "..#..", "....."],
  "·": [".....", ".....", "..#..", ".###.", "..#..", ".....", "....."],
};
const SPACE = 3; // columns of an empty gap between words

type Props = {
  text: string;
  /** Pitch between dot centers, in px. */
  cell?: number;
  /** Shrinks to the container width when the text is wider than the room. */
  fit?: boolean;
  className?: string;
  animateKey?: string;
};

const DotText = memo(function DotText({
  text,
  cell = 6,
  fit = false,
  className,
  animateKey,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const previous = useRef(animateKey);
  useLayoutEffect(() => {
    if (previous.current === animateKey || animateKey === undefined) return;
    previous.current = animateKey;
    const el = svg.current;
    if (!el || !el.animate) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const waves = Array.from(el.querySelectorAll("path")).map((path, i) => path.animate(
      [{ opacity: reduced ? .5 : .08 }, { opacity: 1 }],
      { duration: reduced ? motionTokens.dots.reducedMs : motionTokens.dots.durationMs, delay: reduced ? 0 : i * motionTokens.dots.stepMs, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" },
    ));
    return () => waves.forEach(a => a.cancel());
  }, [animateKey]);
  const dots: [number, number][] = [];
  let column = 0;
  for (const char of text.toLocaleUpperCase("ru-RU")) {
    if (char === " ") {
      column += SPACE;
      continue;
    }
    const glyph = G[char];
    if (!glyph) {
      column += SPACE;
      continue;
    }
    glyph.forEach((row, y) => {
      for (let x = 0; x < 5; x++)
        if (row[x] === "#") dots.push([column + x, y]);
    });
    column += 6;
  }
  const columns = Math.max(1, column - 1);
  const width = columns * cell;
  const height = 7 * cell;
  const radius = cell * 0.4;
  const bands: string[][] = Array.from({length: animateKey === undefined ? 1 : 7}, () => []);
  dots.forEach(([x, y]) => {
      const cx = x * cell + cell / 2;
      const cy = y * cell + cell / 2;
      bands[Math.min(bands.length - 1, Math.floor(x / columns * bands.length))]!.push(`M${cx - radius},${cy}a${radius},${radius} 0 1,0 ${2 * radius},0a${radius},${radius} 0 1,0 ${-2 * radius},0`);
    });
  return (
    <svg
      ref={svg}
      className={"dot-text" + (className ? " " + className : "")}
      viewBox={`0 0 ${width} ${height}`}
      width={fit ? undefined : width}
      height={fit ? undefined : height}
      style={
        fit ? { width: "100%", maxWidth: width, height: "auto" } : undefined
      }
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {bands.map((paths, i) => <path key={i} d={paths.join(" ")} />)}
    </svg>
  );
});

export default DotText;
