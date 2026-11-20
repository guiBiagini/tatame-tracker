import { describe, expect, it } from 'vitest';
import { resolveUrl } from '../src/adapters';
import { decodeBody } from '../src/core/adapter';
import { parseEnDate, parseIbjjfWhen, parsePtDate } from '../src/core/dates';
import { diffSnapshots } from '../src/core/diff';
import type { Athlete, EventSnapshot, TrackedEvent } from '../src/core/model';
import { isDue, refreshIntervalMinutes } from '../src/core/schedule';
import { buildSummary } from '../src/core/summary';
import { deriveStatus, syncEvent } from '../src/core/sync';
import { fakeHttp, fixture } from './helpers';

const athletes: Athlete[] = [{ id: 'a1', name: 'João P. Silva', aliases: [] }];

describe('resolveUrl', () => {
  it('escolhe o adaptador pela URL', () => {
    expect(resolveUrl('https://www.bjjcompsystem.com/tournaments/3386/categories')?.provider).toBe('ibjjf');
    expect(resolveUrl('https://www.ilutas.com.br/evento/sulamericano')?.provider).toBe('ilutas');
    expect(resolveUrl('https://eventocbjje.com.br/cbjje/evento/95/atletas/')?.provider).toBe('meucombate');
    expect(resolveUrl('https://smoothcomp.com/en/event/1')).toBeNull();
    expect(resolveUrl('não é url')).toBeNull();
  });

  it('aceita só http(s): a URL vira link no painel', () => {
    expect(resolveUrl('javascript:/x/evento/1;alert(1)')).toBeNull();
    expect(resolveUrl('data:/x/evento/1')).toBeNull();
    expect(resolveUrl('http://eventocbjje.com.br/cbjje/evento/95/')?.provider).toBe('meucombate');
  });
});

describe('datas', () => {
  it('converte data em português', () => {
    expect(parsePtDate('22 de Novembro de 2026 (Domingo)')).toBe('2026-11-22');
    expect(parsePtDate('07 de Março de 2027')).toBe('2027-03-07');
  });

  it('converte horário da IBJJF (24h e AM/PM)', () => {
    const ref = new Date('2026-11-01');
    expect(parseIbjjfWhen('Fri 11/06 at 16:58', ref)).toBe('2026-11-06T16:58');
    expect(parseIbjjfWhen('Fri 11/06 at 04:58 PM', ref)).toBe('2026-11-06T16:58');
    expect(parseIbjjfWhen('Fri 11/06 at 12:10 AM', ref)).toBe('2026-11-06T00:10');
  });
});

describe('refreshIntervalMinutes', () => {
  const now = new Date(2026, 10, 10, 9, 0);
  it.each([
    ['2026-12-20', true, 1440],
    ['2026-11-15', true, 180],
    ['2026-11-11', true, 60],
    ['2026-11-10', true, 5],
    ['2026-11-10', false, 60],
    ['2026-11-09', true, 360],
    ['2026-11-01', true, null],
  ])('evento em %s (cronograma ao vivo: %s) → %s min', (date, live, expected) => {
    expect(refreshIntervalMinutes(date, live, now)).toBe(expected);
  });

  it('isDue respeita o intervalo desde a última consulta', () => {
    const event = { id: 'e', date: '2026-11-10' } as TrackedEvent;
    const snap = (minAgo: number) =>
      ({ fetchedAt: new Date(now.getTime() - minAgo * 60_000).toISOString(), date: '2026-11-10' }) as EventSnapshot;
    expect(isDue(event, undefined, true, now)).toBe(true);
    expect(isDue(event, snap(2), true, now)).toBe(false);
    expect(isDue(event, snap(6), true, now)).toBe(true);
  });
});

describe('deriveStatus', () => {
  it('segue o ciclo de vida da inscrição', () => {
    expect(deriveStatus([], false)).toBe('registered');
    expect(deriveStatus([], true)).toBe('bracket_published');
    expect(deriveStatus([{ finished: false, mat: 'Tatame 1' }], true)).toBe('scheduled');
    expect(deriveStatus([{ finished: true }], true)).toBe('finished');
  });
});

describe('syncEvent + diff + resumo (IBJJF de ponta a ponta)', () => {
  const BASE = 'https://www.bjjcompsystem.com';
  const event: TrackedEvent = {
    id: 'ibjjf:9001',
    provider: 'ibjjf',
    externalId: '9001',
    url: `${BASE}/tournaments/9001/categories`,
    name: '',
    addedAt: '',
  };
  const http = fakeHttp({
    [`${BASE}/tournaments/9001/tournament_days/by_competitor?competitor_id=111`]: fixture('ibjjf-competitor.html'),
    [`${BASE}/tournaments/9001/tournament_days/7001`]: fixture('ibjjf-day.html'),
    [`${BASE}/tournaments`]: fixture('ibjjf-tournaments.html'),
  });
  const noSleep = async () => {};

  it('encontra o atleta e busca só as lutas dele', async () => {
    const snap = await syncEvent(event, athletes, http, { sleep: noSleep });
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0]).toMatchObject({ athleteId: 'a1', status: 'scheduled', category: 'Adult / Male / BLUE / Light' });
    expect(http.calls.filter((u) => u.includes('by_competitor'))).toHaveLength(1);
  });

  it('notifica quando a chave sai e quando tatame/horário mudam', async () => {
    const next = await syncEvent(event, athletes, http, { sleep: noSleep });
    const before: EventSnapshot = { ...next, bracketsPublished: false, entries: [] };
    const first = diffSnapshots(before, next, athletes);
    expect(first.map((c) => c.title)).toEqual(['Chave publicada', 'João P. Silva encontrado', 'João P. Silva: luta agendada']);

    const moved = structuredClone(next);
    moved.entries[0]!.fights[1]!.mat = 'Tatame 7';
    moved.entries[0]!.fights[1]!.startsAt = '2026-11-21T11:40';
    const second = diffSnapshots(next, moved, athletes);
    expect(second).toEqual([
      expect.objectContaining({ title: 'João P. Silva: horário/tatame mudou', message: 'Tatame 3 às 11:05 → Tatame 7 às 11:40' }),
    ]);
  });

  it('gera resumo para WhatsApp', async () => {
    const snap = await syncEvent(event, athletes, http, { sleep: noSleep });
    const text = buildSummary([snap], athletes);
    expect(text).toContain('*Exemplo International Open IBJJF Jiu-Jitsu Championship 2026*');
    expect(text).toContain('*João P. Silva*');
    expect(text).toContain('Tatame 3 · 11:05 · Luta 31 (Semi-Final) · vs Rival Dois');
  });
});

describe('decodeBody', () => {
  it('respeita o charset do cabeçalho (checagem do iLutas vem em ISO-8859-1)', () => {
    const latin1 = new Uint8Array([0x4a, 0x4f, 0xc3, 0x4f]).buffer; // "JOÃO"
    expect(decodeBody(latin1, 'text/html; charset=iso-8859-1')).toBe('JOÃO');
    const utf8 = new TextEncoder().encode('JOÃO').buffer;
    expect(decodeBody(utf8, 'text/html; charset=UTF-8')).toBe('JOÃO');
    expect(decodeBody(utf8, null)).toBe('JOÃO');
    expect(decodeBody(utf8, 'text/html; charset=inexistente')).toBe('JOÃO');
  });
});

describe('chave e previsão (sem tatame)', () => {
  const bracketFight = {
    category: 'Peso GI - Adulto - Azul - Leve',
    finished: false,
    estimated: true,
    startsAt: '2026-11-22T15:00',
    note: 'Cronograma: 15:00 FAIXA AZUL – ADULTO E MASTER',
    bracketSize: 4,
    round: 'Semifinal',
    opponent: 'Rival Um',
  };
  const snap = (fights: EventSnapshot['entries'][number]['fights']): EventSnapshot => ({
    eventId: 'ilutas:x',
    fetchedAt: '',
    name: 'Copa Exemplo',
    date: '2026-11-22',
    bracketsPublished: true,
    entries: [
      { athleteId: 'a1', eventId: 'ilutas:x', category: 'Peso GI - Adulto - Azul - Leve', competitorName: 'João', matchScore: 1, status: deriveStatus(fights, true), fights },
    ],
  });

  it('previsão não conta como luta agendada', () => {
    expect(deriveStatus([bracketFight], true)).toBe('bracket_published');
    expect(deriveStatus([{ finished: false, estimated: true, startsAt: '2026-11-22T15:00' }], false)).toBe('registered');
  });

  it('notifica adversário e previsão, não "luta agendada"', () => {
    const changes = diffSnapshots(snap([]), snap([bracketFight]), athletes);
    expect(changes).toEqual([
      expect.objectContaining({ title: 'João P. Silva: adversário na chave', message: 'Semifinal vs Rival Um' }),
      expect.objectContaining({ title: 'João P. Silva: previsão de horário', message: 'Por volta de 15:00 (FAIXA AZUL – ADULTO E MASTER)' }),
    ]);
    expect(diffSnapshots(snap([bracketFight]), snap([bracketFight]), athletes)).toEqual([]);
  });

  it('resumo marca a previsão', () => {
    expect(buildSummary([snap([bracketFight])], athletes)).toContain('previsão ~15:00 · Semifinal · vs Rival Um · chave de 4');
  });
});

describe('data em inglês (site da IBJJF)', () => {
  it.each([
    ['November 21st - 22nd, 2026', '2026-11-21'],
    ['Dates: May 3rd, 2027 (Saturday)', '2027-05-03'],
    ['August 30th - September 1st, 2026', '2026-08-30'],
  ])('%s → %s', (text, date) => {
    expect(parseEnDate(text)).toBe(date);
  });
});
