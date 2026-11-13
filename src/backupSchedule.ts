export const BACKUP_INTERVAL = 24 * 60 * 60 * 1000;
export function backupDue(now: number, lastSuccess: number, changed: boolean) {
  return changed && (lastSuccess === 0 || now - lastSuccess >= BACKUP_INTERVAL);
}
