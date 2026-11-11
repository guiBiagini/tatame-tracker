import type { Athlete, EventSnapshot } from './model';
import { STATUS_LABEL } from './model';
import { MATCH_THRESHOLD } from './names';

const formatDate = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');

/** Texto pronto para colar no grupo da academia (formatação do WhatsApp). */
export function buildSummary(snapshots: EventSnapshot[], athletes: Athlete[]): string {
  const nameOf = (id: string) => athletes.find((a) => a.id === id)?.name ?? 'Atleta';
  const blocks: string[] = [];

  for (const snap of snapshots) {
    const entries = snap.entries.filter((e) => e.matchScore >= MATCH_THRESHOLD);
    if (!entries.length) continue;

    const lines = [`🥋 *${snap.name}*${snap.date ? ` – ${formatDate(snap.date)}` : ''}`];
    const sorted = [...entries].sort((a, b) => {
      const ta = a.fights.find((f) => !f.finished)?.startsAt ?? '9';
      const tb = b.fights.find((f) => !f.finished)?.startsAt ?? '9';
      return ta.localeCompare(tb) || nameOf(a.athleteId).localeCompare(nameOf(b.athleteId));
    });

    for (const entry of sorted) {
      lines.push('', `*${nameOf(entry.athleteId)}*`, `  ${entry.category}`);
      const upcoming = entry.fights.filter((f) => !f.finished);
      if (!upcoming.length) {
        lines.push(`  ${STATUS_LABEL[entry.status]}`);
        continue;
      }
      for (const f of upcoming) {
        const parts = [
          f.mat,
          f.startsAt ? f.startsAt.slice(11, 16) : f.when,
          f.fightNumber && `Luta ${f.fightNumber}${f.round ? ` (${f.round})` : ''}`,
          f.opponent && `vs ${f.opponent}`,
        ].filter(Boolean);
        lines.push(`  ${parts.join(' · ')}`);
      }
    }
    blocks.push(lines.join('\n'));
  }

  return blocks.length ? blocks.join('\n\n———\n\n') : 'Nenhum atleta da academia encontrado nos eventos acompanhados.';
}
