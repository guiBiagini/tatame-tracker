import { describe, expect, it } from 'vitest';
import { ibjjfAdapter, parseCompetitorFights } from '../src/adapters/ibjjf';
import { fakeHttp, fixture } from './helpers';

const BASE = 'https://www.bjjcompsystem.com';
const ref = (id: string) => ({ provider: 'ibjjf' as const, externalId: id, url: `${BASE}/tournaments/${id}/categories` });

describe('ibjjf.parseUrl', () => {
  it.each([
    [`${BASE}/tournaments/3386/categories`, '3386'],
    [`${BASE}/tournaments/3386/tournament_days/5251`, '3386'],
    [`${BASE}/?tournament_id=3386`, '3386'],
  ])('%s', (url, id) => {
    expect(ibjjfAdapter.parseUrl(new URL(url))).toEqual({ externalId: id });
  });

  it('ignora outros domínios', () => {
    expect(ibjjfAdapter.parseUrl(new URL('https://ibjjf.com/events'))).toBeNull();
  });
});

describe('ibjjf.fetchEvent', () => {
  it('lê nome do torneio e competidores do filtro "By Athlete"', async () => {
    const http = fakeHttp({
      [`${BASE}/tournaments`]: fixture('ibjjf-tournaments.html'),
      [`${BASE}/tournaments/9001/tournament_days/7001`]: fixture('ibjjf-day.html'),
    });
    const data = await ibjjfAdapter.fetchEvent(ref('9001'), http);
    expect(data.name).toBe('Exemplo International Open IBJJF Jiu-Jitsu Championship 2026');
    expect(data.bracketsPublished).toBe(true);
    expect(data.competitors).toEqual([
      { name: 'João Pedro da Silva', externalId: '111' },
      { name: 'Carlos Exemplo Souza', externalId: '222' },
      { name: 'Maria Fictícia Lima', externalId: '333' },
    ]);
  });

  it('sem "Order of Fights" = chave ainda não publicada', async () => {
    const http = fakeHttp({ [`${BASE}/tournaments`]: fixture('ibjjf-tournaments.html') });
    const data = await ibjjfAdapter.fetchEvent(ref('9002'), http);
    expect(data.bracketsPublished).toBe(false);
    expect(data.competitors).toEqual([]);
  });
});

describe('ibjjf.parseCompetitorFights', () => {
  const fights = parseCompetitorFights(fixture('ibjjf-competitor.html'), '111', new Date('2026-11-01'));

  it('usa só o bloco mobile (sem duplicar)', () => {
    expect(fights).toHaveLength(2);
  });

  it('extrai tatame, horário, luta, fase e adversário', () => {
    expect(fights[1]).toEqual({
      category: 'Adult / Male / BLUE / Light',
      fightNumber: '31',
      round: 'Semi-Final',
      mat: 'Tatame 3',
      when: 'Sat 11/21 at 11:05',
      startsAt: '2026-11-21T11:05',
      opponent: 'Rival Dois',
      opponentTeam: 'Outra Equipe',
      finished: false,
      won: undefined,
    });
  });

  it('identifica luta encerrada e vencedor', () => {
    expect(fights[0]).toMatchObject({ finished: true, won: true, opponent: 'Rival Um', fightNumber: '12' });
  });
});
