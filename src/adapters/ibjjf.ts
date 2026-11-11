import type { EventRef, Http, ProviderAdapter } from '../core/adapter';
import { parseIbjjfWhen } from '../core/dates';
import { clean, parseDocument } from '../core/html';
import type { Competitor, Fight } from '../core/model';

/**
 * IBJJF / CBJJ — bjjcompsystem.com (HTML gerado no servidor).
 *
 * Fluxo:
 *  1. /tournaments → nome do torneio (<select>) e link "Order of Fights" (dia).
 *  2. Página do dia → JSON com todos os competidores (id, nome) embutido no
 *     filtro "By Athlete" (`data-react-props`).
 *  3. /tournament_days/by_competitor?competitor_id=X → lutas com tatame,
 *     horário, número da luta, fase e adversário.
 *
 * Antes de a chave sair, a página do dia não existe: o evento fica
 * "inscrito – chave ainda não publicada".
 */

const BASE = 'https://www.bjjcompsystem.com';

export const ibjjfAdapter: ProviderAdapter = {
  id: 'ibjjf',
  label: 'IBJJF (bjjcompsystem)',

  parseUrl(url) {
    if (!/(^|\.)bjjcompsystem\.com$/.test(url.hostname)) return null;
    const m = url.pathname.match(/\/tournaments\/(\d+)/) ?? url.search.match(/tournament_id=(\d+)/);
    return m ? { externalId: m[1]! } : null;
  },

  async fetchEvent(ref, http) {
    const listDoc = parseDocument(await http.text(`${BASE}/tournaments`));
    const option = listDoc.querySelector(`#tournament_id option[value="${ref.externalId}"]`);
    const name = clean(option?.textContent) || `Torneio IBJJF ${ref.externalId}`;

    const dayPath = findDayPath(listDoc, ref.externalId);
    if (!dayPath) return { name, bracketsPublished: false, competitors: [] };

    const dayDoc = parseDocument(await http.text(BASE + dayPath));
    return { name, bracketsPublished: true, competitors: parseCompetitors(dayDoc) };
  },

  async fetchFights(ref: EventRef, competitor: Competitor, http: Http) {
    if (!competitor.externalId) return [];
    const html = await http.text(
      `${BASE}/tournaments/${ref.externalId}/tournament_days/by_competitor?competitor_id=${competitor.externalId}`,
    );
    return parseCompetitorFights(html, competitor.externalId);
  },
};

function findDayPath(doc: Document, tournamentId: string): string | undefined {
  const re = new RegExp(`^/tournaments/${tournamentId}/tournament_days/\\d+$`);
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') ?? '';
    if (re.test(href)) return href;
  }
  return undefined;
}

export function parseCompetitors(dayDoc: Document): Competitor[] {
  const el = dayDoc.querySelector('.tournament-day__competitor-filter [data-react-props]');
  if (!el) return [];
  const props = JSON.parse(el.getAttribute('data-react-props') ?? '{}') as { competitors?: unknown };
  const raw = typeof props.competitors === 'string' ? JSON.parse(props.competitors) : props.competitors;
  if (!Array.isArray(raw)) return [];
  return raw.map((c: { id: number; name: string }) => ({
    name: clean(c.name),
    externalId: String(c.id),
  }));
}

export function parseCompetitorFights(html: string, competitorId: string, reference?: Date): Fight[] {
  const doc = parseDocument(html);
  // A página repete a lista para mobile e desktop; usamos só a versão mobile.
  const items = doc.querySelectorAll('.visible-xs .tournament-day__matches > li');
  const fights: Fight[] = [];

  for (const li of items) {
    const header = clean(li.querySelector('.search-match-header')?.textContent);
    // "Fri 11/06 at 16:58 - Mat 8: Fight 20 - Semi-Final"
    const when = clean(li.querySelector('.search-match-header__when')?.textContent) || undefined;
    const mat = header.match(/Mat\s+(\d+)/i)?.[1];
    const fightNumber = header.match(/Fight\s+(\d+)/i)?.[1];
    const round = header.match(/Fight\s+\d+\s*-\s*(.+)$/i)?.[1]?.trim();

    const competitors = [...li.querySelectorAll('.match-card__competitor')];
    const me = competitors.find((c) => c.getAttribute('id') === `competitor-${competitorId}`);
    const other = competitors.find((c) => c !== me);
    const otherName = clean(other?.querySelector('.match-card__competitor-name')?.textContent);
    const isBye = !!other?.querySelector('.match-card__bye');
    const finished = /match--finished/.test(li.getAttribute('class') ?? '');
    const iLost = !!me?.querySelector('.match-competitor--loser');
    const otherLost = !!other?.querySelector('.match-competitor--loser');

    fights.push({
      category: clean(li.querySelector('.tournament-day__category-name')?.textContent) || undefined,
      fightNumber,
      round,
      mat: mat ? `Tatame ${mat}` : undefined,
      when,
      startsAt: when ? parseIbjjfWhen(when, reference) : undefined,
      opponent: isBye ? 'BYE' : otherName || undefined,
      opponentTeam: clean(other?.querySelector('.match-card__club-name')?.textContent) || undefined,
      finished,
      won: finished ? (iLost ? false : otherLost ? true : undefined) : undefined,
    });
  }
  return fights;
}
