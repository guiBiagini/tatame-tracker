import { getAdapter } from '../adapters';
import type { Http } from './adapter';
import type { Athlete, Competitor, Entry, EntryStatus, EventSnapshot, Fight, TrackedEvent } from './model';
import { athleteScore, MATCH_THRESHOLD, POSSIBLE_THRESHOLD } from './names';

const FIGHT_REQUEST_DELAY_MS = 300;

interface Match {
  athlete: Athlete;
  competitor: Competitor;
  score: number;
}

const MAX_POSSIBLE_NAMES = 3;

/**
 * Cruza os atletas da academia com os inscritos. Se o atleta foi encontrado
 * com certeza, as sugestões dele são descartadas; senão, ficam só os
 * MAX_POSSIBLE_NAMES nomes mais parecidos (em eventos grandes, nomes comuns
 * geravam dezenas de sugestões).
 */
export function matchAthletes(athletes: Athlete[], competitors: Competitor[]): Match[] {
  const matches: Match[] = [];
  for (const athlete of athletes) {
    const found = competitors
      .map((competitor) => ({ athlete, competitor, score: athleteScore(athlete, competitor) }))
      .filter((m) => m.score >= POSSIBLE_THRESHOLD);
    const sure = found.filter((m) => m.score >= MATCH_THRESHOLD);
    if (sure.length) {
      matches.push(...sure);
      continue;
    }
    const bestNames = [...new Set(found.sort((a, b) => b.score - a.score).map((m) => m.competitor.name))].slice(
      0,
      MAX_POSSIBLE_NAMES,
    );
    matches.push(...found.filter((m) => bestNames.includes(m.competitor.name)));
  }
  return matches;
}

export function deriveStatus(fights: Fight[], bracketsPublished: boolean): EntryStatus {
  if (fights.length && fights.every((f) => f.finished)) return 'finished';
  if (fights.some((f) => !f.finished && (f.mat || f.startsAt))) return 'scheduled';
  if (bracketsPublished || fights.length) return 'bracket_published';
  return 'registered';
}

/** Busca o evento, encontra os atletas da academia e monta o snapshot normalizado. */
export async function syncEvent(
  event: TrackedEvent,
  athletes: Athlete[],
  http: Http,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<EventSnapshot> {
  const adapter = getAdapter(event.provider);
  const ref = { provider: event.provider, externalId: event.externalId, url: event.url };
  const data = await adapter.fetchEvent(ref, http);
  const entries: Entry[] = [];

  for (const { athlete, competitor, score } of matchAthletes(athletes, data.competitors)) {
    let fights: Fight[] = [];
    if (adapter.fetchFights) {
      fights = await adapter.fetchFights(ref, competitor, http);
      await sleep(FIGHT_REQUEST_DELAY_MS); // gentileza com o servidor
    }

    // Uma entrada por categoria (peso e absoluto aparecem separados).
    const byCategory = new Map<string, Fight[]>();
    for (const fight of fights) {
      const key = fight.category ?? competitor.category ?? '—';
      byCategory.set(key, [...(byCategory.get(key) ?? []), fight]);
    }
    if (!byCategory.size) byCategory.set(competitor.category ?? '—', []);

    for (const [category, categoryFights] of byCategory) {
      entries.push({
        athleteId: athlete.id,
        eventId: event.id,
        category,
        competitorName: competitor.name,
        competitorTeam: competitor.team,
        matchScore: score,
        status: deriveStatus(categoryFights, data.bracketsPublished),
        fights: categoryFights,
      });
    }
  }

  return {
    eventId: event.id,
    fetchedAt: new Date().toISOString(),
    name: data.name,
    date: data.date,
    bracketsPublished: data.bracketsPublished,
    entries,
  };
}
