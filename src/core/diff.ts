import type { Athlete, Entry, EventSnapshot, Fight } from './model';
import { MATCH_THRESHOLD } from './names';

export interface Change {
  athleteId?: string;
  title: string;
  message: string;
}

const entryKey = (e: Entry) => `${e.athleteId}|${e.category}`;
const fightKey = (f: Fight) => f.fightNumber ?? `${f.round ?? ''}|${f.opponent ?? ''}`;
const time = (f: Fight) => f.startsAt?.slice(11, 16) ?? f.when ?? '?';

/**
 * O que mudou entre duas consultas do mesmo evento, já em texto de notificação.
 * Ignora correspondências incertas de nome para não gerar alarme falso.
 */
export function diffSnapshots(
  previous: EventSnapshot | undefined,
  next: EventSnapshot,
  athletes: Athlete[],
): Change[] {
  if (next.error) return [];
  const changes: Change[] = [];
  const nameOf = (id: string) => athletes.find((a) => a.id === id)?.name ?? 'Atleta';

  if (previous && !previous.bracketsPublished && next.bracketsPublished) {
    changes.push({ title: 'Chave publicada', message: next.name });
  }

  const before = new Map((previous?.entries ?? []).map((e) => [entryKey(e), e]));
  for (const entry of next.entries) {
    if (entry.matchScore < MATCH_THRESHOLD) continue;
    const name = nameOf(entry.athleteId);
    const old = before.get(entryKey(entry));

    if (!old && previous) {
      changes.push({
        athleteId: entry.athleteId,
        title: `${name} encontrado`,
        message: `${next.name} – ${entry.category}`,
      });
    }

    const oldFights = new Map((old?.fights ?? []).map((f) => [fightKey(f), f]));
    for (const fight of entry.fights) {
      if (fight.finished) continue;
      const prev = oldFights.get(fightKey(fight));
      const where = [fight.mat, time(fight)].filter(Boolean).join(' às ');
      if (!prev || (!prev.mat && !prev.startsAt)) {
        if (fight.mat || fight.startsAt) {
          changes.push({
            athleteId: entry.athleteId,
            title: `${name}: luta agendada`,
            message: `${where}${fight.opponent ? ` vs ${fight.opponent}` : ''}`,
          });
        }
      } else if (prev.mat !== fight.mat || prev.startsAt !== fight.startsAt) {
        changes.push({
          athleteId: entry.athleteId,
          title: `${name}: horário/tatame mudou`,
          message: `${[prev.mat, time(prev)].filter(Boolean).join(' às ')} → ${where}`,
        });
      }
    }
  }
  return changes;
}
