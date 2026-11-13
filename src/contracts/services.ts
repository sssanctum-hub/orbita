// Interfaces for future adapters. No account, network endpoint or AI provider is enabled.
export interface AiPlanningProvider {
  suggest(
    input: { taskIds: string[]; availableMinutes: number },
    signal: AbortSignal,
  ): Promise<{
    explanation: string;
    changes: { taskId: string; proposedStart?: string; proposedDue?: string }[];
  }>;
}
export type SyncStatus =
  | { state: "disabled" }
  | { state: "offline"; queued: number }
  | { state: "syncing"; queued: number }
  | { state: "synced"; lastSync: string }
  | { state: "conflict"; entityIds: string[] };
export interface SyncTransport {
  connect(signal: AbortSignal): Promise<void>;
  disconnect(): Promise<void>;
  status(): SyncStatus;
}
