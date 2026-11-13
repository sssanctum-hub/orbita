import { describe, expect, it } from "vitest";
import { backupDue, BACKUP_INTERVAL } from "./backupSchedule";
describe("daily local backups", () => {
 it("backs up changes initially and after a day, never unchanged data", () => {
  expect(backupDue(100, 0, true)).toBe(true);
  expect(backupDue(BACKUP_INTERVAL, 100, true)).toBe(false);
  expect(backupDue(BACKUP_INTERVAL + 100, 100, true)).toBe(true);
  expect(backupDue(BACKUP_INTERVAL * 2, 100, false)).toBe(false);
  expect(backupDue(50, 100, true)).toBe(false);
 });
});
