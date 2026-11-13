import type { Data } from "./domain";
// Replace only the slots belonging to this visible list. Other spheres, facts,
// dates and series keep their original values and positions. SQLite stores order.
export function reorderTasks(data: Data, ids: string[]): Data {
  const unique = new Set(ids);
  if (unique.size !== ids.length)
    throw Error("Повторяющееся дело в порядке списка.");
  const map = new Map(data.tasks.map((task) => [task.id, task]));
  if (ids.some((id) => !map.has(id)))
    throw Error("Список изменился. Попробуйте ещё раз.");
  let i = 0;
  return {
    ...data,
    tasks: data.tasks.map((task) =>
      unique.has(task.id) ? map.get(ids[i++]!)! : task,
    ),
  };
}
