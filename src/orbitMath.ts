export function wrapOrbitIndex(index: number, count: number): number {
  return count > 0 ? ((index % count) + count) % count : 0;
}

// Neighbours across the end of the array stay adjacent on the same arc.
export function orbitOffset(
  index: number,
  position: number,
  count: number,
): number {
  return count > 1
    ? wrapOrbitIndex(index - position + count / 2, count) - count / 2
    : 0;
}

// Only visible neighbours are visited, regardless of the number of tasks.
export function visibleOrbitIndices(position: number, count: number): number[] {
  const indices = new Set<number>();
  for (
    let i = Math.ceil(position - 3.6);
    i <= Math.floor(position + 3.6);
    i++
  ) {
    if (count) indices.add(wrapOrbitIndex(i, count));
  }
  return [...indices].filter(
    (i) => Math.abs(orbitOffset(i, position, count)) <= 3.6,
  );
}
