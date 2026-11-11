import { describe, expect, it } from 'vitest';
import { meuCombateAdapter } from '../src/adapters/meucombate';
import { fakeHttp } from './helpers';

const API = 'https://api.meucombate.com.br/api:uxixvP46';

// Formato real da API (nov/2026), dados fictícios.
const category = (id: number, overrides: object, athletes: { id: number; user_name: string; team: string }[]) => ({
  id,
  absolute: false,
  gi_nogi: 'gi',
  gender: 'masc',
  weight_name: 'Leve',
  belts: [{ belts_name: 'Azul', belts_order: 2 }],
  _categories_ages: [{ ages_name: 'Adulto', from_age: 18, to_age: 29 }],
  _athletes_of_events_categories: athletes.map((a) => ({
    id: a.id,
    user_name: a.user_name,
    teams_name: null,
    inscription_teams_name: a.team,
    inscriptions_status: 'approved',
  })),
  ...overrides,
});

describe('meucombate.parseUrl', () => {
  it('reconhece qualquer domínio no formato /<org>/evento/<id>', () => {
    expect(meuCombateAdapter.parseUrl(new URL('https://eventocbjje.com.br/cbjje/evento/95/informacoes/'))).toEqual({
      externalId: '95',
    });
    expect(meuCombateAdapter.parseUrl(new URL('https://eventocbjje.com.br/cbjje/eventos/'))).toBeNull();
  });
});

describe('meucombate.fetchEvent', () => {
  it('percorre todas as páginas e normaliza categorias', async () => {
    const http = fakeHttp({
      [`${API}/event/me?events_id=95`]: {
        id: 95,
        organizations_id: 16,
        name: 'MUNDIAL EXEMPLO',
        timezone: 'America/Sao_Paulo',
        has_brackets: false,
        timeline_released: false,
      },
      [`${API}/events?page=1&organizations_id=16`]: {
        nextPage: null,
        items: [{ events_id: 95, events_first_day: Date.UTC(2026, 10, 29, 12), timezones: 'America/Sao_Paulo' }],
      },
      [`${API}/event/athletes?page=1&event_id=95`]: {
        nextPage: 2,
        items: [category(1, {}, [{ id: 10, user_name: 'Ana Exemplo ', team: 'Equipe A' }])],
      },
      [`${API}/event/athletes?page=2&event_id=95`]: {
        nextPage: null,
        items: [
          category(2, { absolute: true, gender: 'fem', weight_name: 'Leve' }, [
            { id: 11, user_name: 'Bia Exemplo', team: 'Equipe B' },
          ]),
        ],
      },
    });

    const data = await meuCombateAdapter.fetchEvent(
      { provider: 'meucombate', externalId: '95', url: 'https://eventocbjje.com.br/cbjje/evento/95/' },
      http,
    );

    expect(data).toEqual({
      name: 'MUNDIAL EXEMPLO',
      date: '2026-11-29',
      bracketsPublished: false,
      competitors: [
        { name: 'Ana Exemplo', team: 'Equipe A', category: 'GI / Masculino / Azul / Adulto / Leve', externalId: '10' },
        { name: 'Bia Exemplo', team: 'Equipe B', category: 'GI / Feminino / Azul / Adulto / Absoluto', externalId: '11' },
      ],
    });
  });
});
