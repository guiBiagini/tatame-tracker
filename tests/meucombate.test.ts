import { describe, expect, it } from 'vitest';
import { meuCombateAdapter, parseFights, type MCFight } from '../src/adapters/meucombate';
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
      context: { eventId: '95', timeZone: 'America/Sao_Paulo' },
    });
  });
});

describe('meucombate: lutas (área e horário)', () => {
  const PROGRAM = `${API}/event/%7Bid%7D/program/filter/athlete`;
  // Formato real de /program/filter/athlete/brackets (nov/2026), dados fictícios.
  const fight = (o: object): MCFight => ({
    athletes_a_id: null,
    athletes_b_id: null,
    id: 900,
    arenas_number: 10,
    fights_count: 7,
    status_fight: 'scheduled',
    athletes_winner_id: 0,
    users_name_a: null,
    users_name_b: null,
    academies_a: null,
    academies_b: null,
    team_a: null,
    team_b: null,
    ...o,
  });
  const ETA = Date.UTC(2026, 10, 26, 15, 22); // 12:22 em São Paulo
  const brackets = [
    fight({ order_fight: 1, brackets_stage_name: 'Quartas', athletes_a_id: 11, athletes_b_id: 12, users_name_a: 'Outro Um', users_name_b: 'Outro Dois' }),
    fight({
      order_fight: 3,
      brackets_stage_name: 'Quartas',
      athletes_a_id: 101,
      athletes_b_id: 202,
      users_name_a: 'Ana Exemplo',
      users_name_b: 'Rival Fictícia',
      team_b: { name: 'Equipe Rival' },
      eta_init: ETA + 60_000,
      eta_live: ETA,
    }),
    fight({ order_fight: 6, brackets_stage_name: 'Semifinal', athletes_a_id: null, athletes_b_id: 101, status_fight: 'waiting', eta_init: ETA + 1_200_000 }),
    fight({ order_fight: 7, brackets_stage_name: 'Final', athletes_a_id: null, athletes_b_id: null, status_fight: 'waiting' }),
  ];
  const http = fakeHttp({
    [`${PROGRAM}?events_id=95&search_athlete_text=101&search_athlete_integer=101`]: [
      { athletes_id: 1012, brackets_id: [555] },
      { athletes_id: 101, brackets_id: [900] },
    ],
    [`${PROGRAM}/brackets?brackets_id%5B%5D=900`]: brackets,
  });
  const ref = { provider: 'meucombate' as const, externalId: '95', url: '' };

  it('busca a chave pelo nº do atleta e devolve só as lutas dele, com área e horário local', async () => {
    const fights = await meuCombateAdapter.fetchFights!(
      ref,
      { name: 'Ana Exemplo', externalId: '101', category: 'GI / Feminino / Azul / Adulto / Leve' },
      http,
      { eventId: '95', timeZone: 'America/Sao_Paulo' },
    );
    expect(fights).toEqual([
      {
        category: 'GI / Feminino / Azul / Adulto / Leve',
        finished: false,
        fightNumber: '3',
        round: 'Quartas',
        mat: 'Área 10',
        startsAt: '2026-11-26T12:22', // previsão ao vivo, não a original
        opponent: 'Rival Fictícia',
        opponentTeam: 'Equipe Rival',
      },
      {
        category: 'GI / Feminino / Azul / Adulto / Leve',
        finished: false,
        fightNumber: '6',
        round: 'Semifinal',
        mat: 'Área 10',
        startsAt: '2026-11-26T12:42',
      },
    ]);
    expect(http.calls).toHaveLength(2);
  });

  it('marca vitória/derrota de lutas encerradas', () => {
    const done = [fight({ order_fight: 3, athletes_a_id: 101, athletes_b_id: 202, users_name_b: 'Rival', status_fight: 'finished', athletes_winner_id: 101 })];
    expect(parseFights(done, 101)[0]).toMatchObject({ finished: true, won: true });
    expect(parseFights(done, 202)[0]).toMatchObject({ finished: true, won: false });
  });

  it('não monta URL com identificador inválido', async () => {
    const empty = fakeHttp({});
    expect(await meuCombateAdapter.fetchFights!(ref, { name: 'x', externalId: '1&x=2' }, empty, {})).toEqual([]);
    expect(empty.calls).toHaveLength(0);
  });
});
