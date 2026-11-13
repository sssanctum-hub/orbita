// Serialize background work, coalescing waiting requests into the newest snapshot.
// Each caller waits for the run that includes its snapshot or a newer one.
export function latestQueue<T, R>(
  run: (value: T) => Promise<R>,
  merge: (waiting: T, latest: T) => T = (_waiting, latest) => latest,
) {
  type Waiter = {
    resolve: (value: R) => void;
    reject: (error: unknown) => void;
  };
  let running = false;
  let pending: { value: T; waiters: Waiter[] } | undefined;
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (pending) {
        const batch = pending;
        pending = undefined;
        try {
          const result = await run(batch.value);
          for (const w of batch.waiters) w.resolve(result);
        } catch (error) {
          for (const w of batch.waiters) w.reject(error);
        }
      }
    } finally {
      running = false;
    }
  }
  return (value: T): Promise<R> =>
    new Promise((resolve, reject) => {
      if (pending) {
        pending.value = merge(pending.value, value);
        pending.waiters.push({ resolve, reject });
      } else pending = { value, waiters: [{ resolve, reject }] };
      void drain();
    });
}
