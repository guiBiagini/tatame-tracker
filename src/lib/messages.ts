export type Message = { type: 'sync'; eventIds?: string[]; force?: boolean };

export interface SyncResponse {
  ok: boolean;
  changes: number;
  error?: string;
}
