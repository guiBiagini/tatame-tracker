import type { EventRef, Http, ProviderAdapter } from '../core/adapter';
import { parseEnDate, parseIbjjfWhen } from '../core/dates';
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
 *
 * Também aceita o link de divulgação (ibjjf.com/events/<slug> ou
 * /events/<id>/...): a página do evento aponta para o torneio no bjjcompsystem.
 */

const BASE = 'https://www.bjjcompsystem.com';
const SITE = 'https://ibjjf.com';
const ID_RE = /^\d{1,9}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;

/**
 * Código do torneio no bjjcompsystem. Com link do ibjjf.com, lê a página do
 * evento, que também traz a data (o bjjcompsystem não publica a data).
 */
async function resolveTournament(ref: EventRef, http: Http): Promise<{ id: string; date?: string }> {
  if (ID_RE.test(ref.externalId)) return { id: ref.externalId };
  const slug = ref.externalId.startsWith('slug:') ? ref.externalId.slice(5) : '';
  if (!SLUG_RE.test(slug)) throw new Error('Identificador de evento IBJJF inválido');
  const html = await http.text(`${SITE}/events/${slug}`);
  const id = html.match(/bjjcompsystem\.com\/tournaments\/(\d{1,9})/)?.[1] ?? html.match(/\/events\/(\d{1,9})\//)?.[1];
  if (!id) throw new Error('Torneio não encontrado na página do evento IBJJF');
  return { id, date: parseEnDate(parseDocument(html).body?.textContent ?? '') };
}

export const ibjjfAdapter: ProviderAdapter = {
  id: 'ibjjf',
  label: 'IBJJF (bjjcompsystem)',
  liveSchedule: true,

  parseUrl(url) {
    if (/(^|\.)ibjjf\.com$/.test(url.hostname)) {
      const id = url.pathname.match(/^\/events\/(\d{1,9})(\/|$)/)?.[1];
      if (id) return { externalId: id };
      const slug = url.pathname.match(/^\/events\/([^/]+)\/?$/)?.[1];
      return slug && SLUG_RE.test(slug) ? { externalId: `slug:${slug}` } : null;
    }
    if (!/(^|\.)bjjcompsystem\.com$/.test(url.hostname)) return null;
    const m = url.pathname.match(/\/tournaments\/(\d+)/) ?? url.search.match(/tournament_id=(\d+)/);
    return m ? { externalId: m[1]! } : null;
  },

  async fetchEvent(ref, http) {
    const { id, date } = await resolveTournament(ref, http);
    const listDoc = parseDocument(await http.text(`${BASE}/tournaments`));
    const option = listDoc.querySelector(`#tournament_id option[value="${id}"]`);
    const name = clean(option?.textContent) || `Torneio IBJJF ${id}`;
    const context = { id };

    const dayPath = findDayPath(listDoc, id);
    if (!dayPath) return { name, date, bracketsPublished: false, competitors: [], context };

    const dayDoc = parseDocument(await http.text(BASE + dayPath));
    return { name, date, bracketsPublished: true, competitors: parseCompetitors(dayDoc), context };
  },

  async fetchFights(ref: EventRef, competitor: Competitor, http: Http, context?: unknown) {
    const id = (context as { id?: string } | undefined)?.id ?? ref.externalId;
    if (!competitor.externalId || !ID_RE.test(id) || !ID_RE.test(competitor.externalId)) return [];
    const html = await http.text(
      `${BASE}/tournaments/${id}/tournament_days/by_competitor?competitor_id=${competitor.externalId}`,
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
