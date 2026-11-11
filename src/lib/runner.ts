import { getAdapter } from '../adapters';
import { browserHttp } from '../core/adapter';
import { diffSnapshots, type Change } from '../core/diff';
import type { EventSnapshot } from '../core/model';
import { isDue } from '../core/schedule';
import { syncEvent } from '../core/sync';
import { athletesItem, eventsItem, snapshotsItem } from './storage';

export interface RunOptions {
  /** Atualiza só estes eventos; sem isso, todos os que estão "vencidos". */
  eventIds?: string[];
  force?: boolean;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Atualiza eventos, grava os snapshots e devolve as mudanças para notificar.
 * Execuções são enfileiradas: alarme e clique em "Atualizar" não se atropelam.
 */
export function runSync(options: RunOptions = {}): Promise<Change[]> {
  const run = queue.then(() => doRunSync(options));
  queue = run.catch(() => {});
  return run;
}

async function doRunSync({ eventIds, force = false }: RunOptions): Promise<Change[]> {
  const [athletes, events, snapshots] = await Promise.all([
    athletesItem.getValue(),
    eventsItem.getValue(),
    snapshotsItem.getValue(),
  ]);
  const changes: Change[] = [];

  for (const event of events) {
    if (eventIds && !eventIds.includes(event.id)) continue;
    const previous = snapshots[event.id];
    const live = !!getAdapter(event.provider).fetchFights;
    if (!force && !isDue(event, previous, live)) continue;

    let next: EventSnapshot;
    try {
      next = await syncEvent(event, athletes, browserHttp);
    } catch (err) {
      // Mantém os dados anteriores visíveis e registra o erro.
      next = {
        ...(previous ?? { eventId: event.id, name: event.name, bracketsPublished: false, entries: [] }),
        fetchedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      };
    }

    changes.push(...diffSnapshots(previous, next, athletes));
    snapshots[event.id] = next;
    await snapshotsItem.setValue({ ...snapshots });

    // Nome e data reais vêm da plataforma depois da primeira consulta.
    if (!next.error && (event.name !== next.name || event.date !== next.date)) {
      const current = await eventsItem.getValue();
      await eventsItem.setValue(
        current.map((e) => (e.id === event.id ? { ...e, name: next.name, date: next.date } : e)),
      );
    }
  }
  return changes;
}
