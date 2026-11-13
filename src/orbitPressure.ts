// Reserve only the circle's immediate halo, and only on its row.
export function orbitInset(
  top: number,
  bottom: number,
  right: number,
  cx: number,
  cy: number,
) {
  if (cy < top - 8 || cy > bottom + 8) return 0;
  const distance = Math.max(top - cy, cy - bottom, 0);
  const radius = 38;
  return Math.max(
    0,
    right - (cx - Math.sqrt(radius * radius - distance * distance)),
  );
}
export function orbitPressure(
  top: number,
  bottom: number,
  right: number,
  width: number,
  cx: number,
  cy: number,
) {
  return width <= 0
    ? 1
    : Math.max(0.65, 1 - orbitInset(top, bottom, right, cx, cy) / width);
}
