import { sleep, type ProviderAdapter } from '../core/adapter';
import { epochToDate } from '../core/dates';
import type { Competitor } from '../core/model';

/**
 * Meu Combate — plataforma multi-federação (ex.: CBJJE em eventocbjje.com.br).
 * O site é uma SPA que consome uma API JSON pública e paginada, então um único
 * adaptador atende qualquer federação hospedada nela, em qualquer domínio.
 *
 * URL reconhecida: https://<dominio>/<org>/evento/<id>/...
 *
 * Ainda não mapeamos o endpoint de chaves/lutas (nenhum evento com chave
 * publicada na análise); `has_brackets` indica quando ela sai.
 */

const API = 'https://api.meucombate.com.br/api:uxixvP46';
const MAX_PAGES = 200;
/** A API limita requisições em rajada; espaçar as páginas evita o HTTP 429. */
const PAGE_DELAY_MS = 400;

interface MCEvent {
  id: number;
  organizations_id: number;
  name: string;
  timezone?: string;
  has_brackets?: boolean;
  timeline_released?: boolean;
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
    };
  },
};

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
