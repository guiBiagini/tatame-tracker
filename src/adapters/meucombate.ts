import { sleep, type ProviderAdapter } from '../core/adapter';
import { epochToDate, epochToLocal } from '../core/dates';
import type { Competitor, Fight } from '../core/model';

/**
 * Meu Combate — plataforma multi-federação (ex.: CBJJE em eventocbjje.com.br).
 * O site é uma SPA que consome uma API JSON pública e paginada, então um único
 * adaptador atende qualquer federação hospedada nela, em qualquer domínio.
 *
 * URL reconhecida: https://<dominio>/<org>/evento/<id>/...
 *
 * Lutas (aba Cronograma → "Encontrar atleta", nov/2026):
 *   1. /event/{id}/program/filter/athlete?search_athlete_integer=<nº atleta>
 *      → chaves do atleta (`brackets_id`). O nº é o mesmo `id` da lista de inscritos.
 *   2. /event/{id}/program/filter/athlete/brackets?brackets_id[]=…
 *      → todas as lutas das chaves, com área, fase e horário previsto ao vivo.
 */

const API = 'https://api.meucombate.com.br/api:uxixvP46';
const MAX_PAGES = 200;
/** A API limita requisições em rajada; espaçar as páginas evita o HTTP 429. */
const PAGE_DELAY_MS = 400;
const ID_RE = /^\d{1,9}$/;
/** O `{id}` faz parte do caminho real da API (literal, não é placeholder nosso). */
const PROGRAM = `${API}/event/%7Bid%7D/program/filter/athlete`;

interface MCEvent {
  id: number;
  organizations_id: number;
  name: string;
  timezone?: string;
  has_brackets?: boolean;
  timeline_released?: boolean;
}

interface MCSearchItem {
  athletes_id: number;
  brackets_id?: number[];
}

/** Uma luta de uma chave (a API devolve todas as lutas das chaves pedidas). */
export interface MCFight {
  id: number;
  athletes_a_id: number | null;
  athletes_b_id: number | null;
  athletes_winner_id?: number | null;
  users_name_a?: string | null;
  users_name_b?: string | null;
  academies_a?: string | null;
  academies_b?: string | null;
  team_a?: { name?: string | null } | null;
  team_b?: { name?: string | null } | null;
  arenas_number?: number | null;
  brackets_stage_name?: string | null;
  status_fight?: string;
  order_fight?: number;
  fights_count?: number;
  /** Previsão ao vivo (ms); `eta_init` é a previsão original. */
  eta_live?: number | null;
  eta_init?: number | null;
}

interface MCEventListItem {
  events_id: number;
  events_first_day?: number;
  timezones?: string;
}

interface MCPage<T> {
  nextPage: number | null;
  items: T[];
}

interface MCCategory {
  absolute: boolean;
  gi_nogi: 'gi' | 'nogi' | string;
  gender: 'masc' | 'fem' | string;
  weight_name?: string;
  belts?: { belts_name: string }[];
  _categories_ages?: { ages_name: string }[];
  _athletes_of_events_categories: {
    id: number;
    user_name: string;
    teams_name: string | null;
    inscription_teams_name: string | null;
  }[];
}

export const meuCombateAdapter: ProviderAdapter = {
  id: 'meucombate',
  label: 'Meu Combate',
  // Área e horário previsto mudam ao longo do dia: consulta a cada 5 min no dia.
  liveSchedule: true,

  parseUrl(url) {
    const m = url.pathname.match(/^\/[^/]+\/evento\/(\d+)/);
    return m ? { externalId: m[1]! } : null;
  },

  async fetchEvent(ref, http) {
    const event = await http.json<MCEvent>(`${API}/event/me?events_id=${ref.externalId}`);
    const date = await findEventDate(http, event).catch(() => undefined);

    const competitors: Competitor[] = [];
    let page: number | null = 1;
    for (let i = 0; page && i < MAX_PAGES; i++) {
      if (i > 0) await sleep(PAGE_DELAY_MS);
      const data: MCPage<MCCategory> = await http.json<MCPage<MCCategory>>(
        `${API}/event/athletes?page=${page}&event_id=${ref.externalId}&search_academy=&search_athletes_id=`,
      );
      for (const cat of data.items) {
        const category = categoryLabel(cat);
        for (const a of cat._athletes_of_events_categories) {
          competitors.push({
            name: a.user_name.trim(),
            team: (a.inscription_teams_name ?? a.teams_name ?? undefined)?.trim(),
            category,
            externalId: String(a.id),
          });
        }
      }
      page = data.nextPage;
    }

    return {
      name: event.name,
      date,
      bracketsPublished: !!(event.has_brackets || event.timeline_released),
      competitors,
      context: { eventId: ref.externalId, timeZone: event.timezone },
    };
  },

  async fetchFights(ref, competitor, http, context) {
    const { eventId = ref.externalId, timeZone } = (context ?? {}) as { eventId?: string; timeZone?: string };
    const athleteId = competitor.externalId ?? '';
    if (!ID_RE.test(athleteId) || !ID_RE.test(eventId)) return [];

    const found = await http.json<MCSearchItem[]>(
      `${PROGRAM}?events_id=${eventId}&search_athlete_text=${athleteId}&search_athlete_integer=${athleteId}`,
    );
    const brackets = (found.find((a) => String(a.athletes_id) === athleteId)?.brackets_id ?? []).filter((b) =>
      ID_RE.test(String(b)),
    );
    if (!brackets.length) return [];

    const query = brackets.map((b) => `brackets_id%5B%5D=${b}`).join('&');
    const fights = await http.json<MCFight[]>(`${PROGRAM}/brackets?${query}`);
    return parseFights(fights, Number(athleteId), competitor.category, timeZone);
  },
};

/** Lutas em que o atleta aparece (as próximas fases só o incluem depois que ele vence). */
export function parseFights(fights: MCFight[], athleteId: number, category?: string, timeZone?: string): Fight[] {
  return fights
    .filter((f) => f.athletes_a_id === athleteId || f.athletes_b_id === athleteId)
    .sort((a, b) => (a.order_fight ?? 0) - (b.order_fight ?? 0))
    .map((f) => {
      const isA = f.athletes_a_id === athleteId;
      const eta = f.eta_live || f.eta_init;
      const finished = f.status_fight === 'finished';
      const fight: Fight = { category, finished };
      if (f.order_fight) fight.fightNumber = String(f.order_fight);
      if (f.brackets_stage_name) fight.round = f.brackets_stage_name;
      if (f.arenas_number) fight.mat = `Área ${f.arenas_number}`;
      if (eta) fight.startsAt = epochToLocal(eta, timeZone);
      const opponent = (isA ? f.users_name_b : f.users_name_a)?.trim();
      const opponentTeam = (isA ? f.academies_b || f.team_b?.name : f.academies_a || f.team_a?.name)?.trim();
      if (opponent) fight.opponent = opponent;
      if (opponent && opponentTeam) fight.opponentTeam = opponentTeam;
      if (finished && f.athletes_winner_id) fight.won = f.athletes_winner_id === athleteId;
      return fight;
    });
}

async function findEventDate(http: Parameters<ProviderAdapter['fetchEvent']>[1], event: MCEvent) {
  for (let page = 1; page <= 10; page++) {
    const list = await http.json<MCPage<MCEventListItem>>(
      `${API}/events?page=${page}&organizations_id=${event.organizations_id}&filter_status_events=active`,
    );
    const found = list.items.find((e) => e.events_id === event.id);
    if (found?.events_first_day) return epochToDate(found.events_first_day, found.timezones ?? event.timezone);
    if (!list.nextPage) break;
  }
  return undefined;
}

export function categoryLabel(cat: MCCategory): string {
  const parts = [
    cat.gi_nogi === 'gi' ? 'GI' : 'NO-GI',
    cat.gender === 'masc' ? 'Masculino' : cat.gender === 'fem' ? 'Feminino' : cat.gender,
    cat.belts?.map((b) => b.belts_name).join('/'),
    cat._categories_ages?.map((a) => a.ages_name).join('/'),
    cat.absolute ? 'Absoluto' : cat.weight_name,
  ];
  return parts.filter(Boolean).join(' / ');
}
