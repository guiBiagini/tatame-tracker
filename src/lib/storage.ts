import { storage } from 'wxt/utils/storage';
import type { Athlete, EventSnapshot, TrackedEvent } from '../core/model';

export const athletesItem = storage.defineItem<Athlete[]>('local:athletes', { fallback: [] });
export const eventsItem = storage.defineItem<TrackedEvent[]>('local:events', { fallback: [] });
/** Último resultado de cada evento, indexado por TrackedEvent.id. */
export const snapshotsItem = storage.defineItem<Record<string, EventSnapshot>>('local:snapshots', {
  fallback: {},
});

export interface Settings {
  notifications: boolean;
}
export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: { notifications: true },
});
