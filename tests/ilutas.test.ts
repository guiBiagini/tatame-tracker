import { describe, expect, it } from 'vitest';
import {
  estimateStart,
  findSlot,
  firstFight,
  iLutasAdapter,
  parseBracket,
  parseChecagem,
  parseOptions,
  parseSchedule,
} from '../src/adapters/ilutas';
import { parseDocument } from '../src/core/html';
import type { Athlete, EventSnapshot, TrackedEvent } from '../src/core/model';
import { syncEvent } from '../src/core/sync';
import { fakeHttp, fixture } from './helpers';

const BASE = 'https://www.ilutas.com.br';
const CHAVES = `${BASE}/chaves/?event=abc123`;

describe('ilutas.parseUrl', () => {
  it.each([
    [`${BASE}/evento/sulamericano`, 'slug:sulamericano'],
    [`${BASE}/checagem/list-all/?event=abc123`, 'abc123'],
    [`${BASE}/Evento/?event=abc123`, 'abc123'],
  ])('%s', (url, id) => {
    expect(iLutasAdapter.parseUrl(new URL(url))).toEqual({ externalId: id });
  });

  it('rejeita identificadores que injetariam parâmetros na URL', () => {
    expect(iLutasAdapter.parseUrl(new URL(`${BASE}/Evento/?event=abc123%26admin%3D1`))).toBeNull();
    expect(iLutasAdapter.parseUrl(new URL(`${BASE}/Evento/?event=xyz`))).toBeNull();
    expect(iLutasAdapter.parseUrl(new URL(`${BASE}/evento/%3Fevent%3Dx`))).toBeNull();
  });

  it('revalida o identificador vindo do storage', async () => {
    const http = fakeHttp({});
    await expect(
      iLutasAdapter.fetchEvent({ provider: 'ilutas', externalId: 'abc&x=1', url: BASE }, http),
    ).rejects.toThrow('inválido');
    expect(http.calls).toHaveLength(0);
  });
});

describe('ilutas.parseChecagem', () => {
  const { name, competitors } = parseChecagem(fixture('ilutas-checagem.html'));

  it('lê o nome do evento do cabeçalho', () => {
    expect(name).toBe('Copa Exemplo de Jiu-Jitsu');
  });

  it('gera um competidor por categoria, com o código da chave', () => {
    expect(competitors).toEqual([
      { name: 'ANA FICTÍCIA ROCHA', team: 'ACADEMIA EXEMPLO', category: 'Peso GI - Adulto - Azul - Leve - Feminino', externalId: '1:1' },
      { name: 'ANA FICTÍCIA ROCHA', team: 'ACADEMIA EXEMPLO', category: 'Abs GI - Adulto - Azul - Feminino', externalId: '2:2' },
      { name: 'BRUNO EXEMPLO DIAS', team: 'OUTRA EQUIPE', category: 'Peso GI - Master 1 - Roxa - Médio - Masculino', externalId: '1:3' },
    ]);
  });
});

describe('ilutas: cronograma', () => {
  const rows = parseSchedule(parseDocument(fixture('ilutas-evento.html')));

  it('lê só as linhas com horário', () => {
    expect(rows[0]).toEqual({ time: '10:00', text: 'ABERTURA/ HINO NACIONAL' });
    expect(rows.map((r) => r.time)).toEqual(['10:00', '10:30', '11:40', '13:10', '14:00', '14:40', '15:00', '16:30']);
  });

  it.each([
    ['Peso GI - Adulto - Azul - Leve - Feminino', '15:00'],
    ['Peso GI - Master 1 - Azul - Pesado - Masculino', '15:00'],
    ['Peso GI - Juvenil - Azul - Leve - Masculino', '14:00'],
    ['Peso GI - Adulto - Roxa - Médio - Masculino', '14:40'], // "todas as idades"
    ['Peso GI - Infanto Juvenil - Amarela - Leve - Feminino', '13:10'], // não confunde com "juvenil"
    ['Peso GI - Pré-Mirim - Branca/Cinza - Pluma - Masculino', '11:40'],
    ['Peso NO-GI - Adulto - Azul - Leve - Masculino', '10:30'],
    ['Abs GI - Adulto - Azul - Feminino', '16:30'],
  ])('%s → %s', (category, time) => {
    expect(estimateStart(category, rows)?.time).toBe(time);
  });

  it('sem linha correspondente (ou ambígua), não arrisca previsão', () => {
    expect(estimateStart('Peso GI - Adulto - Marrom - Leve - Masculino', rows)).toBeUndefined();
    const ambiguous = [
      { time: '09:00', text: 'FAIXA AZUL – ADULTO' },
      { time: '13:00', text: 'FAIXA AZUL – ADULTO' },
    ];
    expect(estimateStart('Peso GI - Adulto - Azul - Leve - Feminino', ambiguous)).toBeUndefined();
  });
});

describe('ilutas: chaves', () => {
  const peso = parseBracket(fixture('ilutas-chave-peso.html'))!;

  it('lê tamanho, posições e equipes (ignora a linha comentada)', () => {
    expect(peso.size).toBe(4);
    expect(peso.slots).toHaveLength(16);
    expect(peso.slots.filter((s) => s.name)).toEqual([
      { seed: '01', name: 'ANA FICTÍCIA', team: 'ACADEMIA EXEMPLO' },
      { seed: '03', name: 'BEATRIZ MODELO', team: 'EQUIPE RIVAL' },
      { seed: '02', name: 'CLARA TESTE', team: 'TIME DEMO' },
      { seed: '04', name: 'DORA EXEMPLO', team: 'EQUIPE RIVAL' },
    ]);
  });

  it('acha o atleta pelo nome curto da chave', () => {
    expect(findSlot(peso, { name: 'Ana Fictícia Rocha', team: 'Academia Exemplo' })).toBe(0);
    expect(findSlot(peso, { name: 'Ana Rocha' })).toBe(-1);
  });

  it('calcula o primeiro adversário pulando posições vazias', () => {
    expect(firstFight(peso, 0)).toEqual({ opponent: 'BEATRIZ MODELO', opponentTeam: 'EQUIPE RIVAL', round: 'Semifinal' });
    const master = parseBracket(fixture('ilutas-chave-master.html'))!;
    expect(firstFight(master, 0)).toMatchObject({ opponent: 'CARLOS RIVAL', round: 'Final' });
    const abs = parseBracket(fixture('ilutas-chave-abs.html'))!;
    // Posição 02 espera o vencedor de 01 x 03 na final.
    expect(firstFight(abs, 8)).toEqual({ opponent: 'vencedor de ELISA RIVAL x ANA FICTÍCIA', round: 'Final' });
  });

  it('chave ainda não publicada: nenhum tipo de categoria', () => {
    expect(parseOptions(fixture('ilutas-chaves-vazia.html'), 'tpcateg')).toEqual([]);
    expect(parseOptions(fixture('ilutas-chaves.html'), 'tpcateg').map((o) => o.id)).toEqual(['1', '2']);
  });
});

describe('ilutas de ponta a ponta', () => {
  const event: TrackedEvent = {
    id: 'ilutas:abc123',
    provider: 'ilutas',
    externalId: 'abc123',
    url: `${BASE}/Evento/?event=abc123`,
    name: '',
    addedAt: '',
  };
  const athletes: Athlete[] = [{ id: 'a1', name: 'Ana Fictícia Rocha', team: 'Academia Exemplo', aliases: [] }];
  const noSleep = async () => {};
  const routes = (checagem: string, chaves = 'ilutas-chaves.html') => ({
    [`${BASE}/Evento/?event=abc123`]: fixture('ilutas-evento.html'),
    [`${BASE}/checagem/list-all/?event=abc123`]: fixture(checagem),
    [CHAVES]: fixture(chaves),
    [`${CHAVES}&tpcateg=1`]: fixture('ilutas-chaves-peso.html'),
    [`${CHAVES}&tpcateg=2`]: fixture('ilutas-chaves-abs.html'),
    [`${CHAVES}&tpcateg=1&categ=1`]: fixture('ilutas-chave-peso.html'),
    [`${CHAVES}&tpcateg=1&categ=3`]: fixture('ilutas-chave-master.html'),
    [`${CHAVES}&tpcateg=2&categ=9`]: fixture('ilutas-chave-abs.html'),
  });

  it('antes das chaves: inscrito, com previsão do cronograma', async () => {
    const snap = await syncEvent(event, athletes, fakeHttp(routes('ilutas-checagem.html', 'ilutas-chaves-vazia.html')), {
      sleep: noSleep,
    });
    expect(snap.bracketsPublished).toBe(false);
    expect(snap.entries.map((e) => [e.category, e.status, e.fights[0]?.startsAt])).toEqual([
      ['Peso GI - Adulto - Azul - Leve - Feminino', 'registered', '2026-11-22T15:00'],
      ['Abs GI - Adulto - Azul - Feminino', 'registered', '2026-11-22T16:30'],
    ]);
  });

  it('com chaves: adversário, fase e tamanho da chave (absoluto juntado pelo organizador)', async () => {
    const http = fakeHttp(routes('ilutas-checagem.html'));
    const snap = await syncEvent(event, athletes, http, { sleep: noSleep });
    expect(snap.bracketsPublished).toBe(true);
    const [peso, abs] = snap.entries;
    expect(peso).toMatchObject({ status: 'bracket_published', competitorId: '1:1' });
    expect(peso!.fights).toEqual([
      {
        category: 'Peso GI - Adulto - Azul - Leve - Feminino',
        finished: false,
        startsAt: '2026-11-22T15:00',
        estimated: true,
        note: 'Cronograma: 15:00 FAIXA AZUL – ADULTO E MASTER',
        bracketSize: 4,
        round: 'Semifinal',
        opponent: 'BEATRIZ MODELO',
        opponentTeam: 'EQUIPE RIVAL',
      },
    ]);
    expect(abs!.fights[0]).toMatchObject({ bracketSize: 3, round: 'Semifinal', opponent: 'ELISA RIVAL' });
    expect(abs!.fights[0]!.note).toContain('Chave de 3');
    // Só abre as chaves da atleta: peso (1), absoluto pelo código antigo (2, juntado) e o novo (9).
    expect(http.calls.filter((u) => u.includes('&categ='))).toEqual([
      `${CHAVES}&tpcateg=1&categ=1`,
      `${CHAVES}&tpcateg=2&categ=2`,
      `${CHAVES}&tpcateg=2&categ=9`,
    ]);
  });

  it('no dia do evento, sem checagem: reaproveita a consulta anterior', async () => {
    const before = await syncEvent(event, athletes, fakeHttp(routes('ilutas-checagem.html')), { sleep: noSleep });
    const http = fakeHttp(routes('ilutas-checagem-vazia.html'));
    const snap = await syncEvent(event, athletes, http, { sleep: noSleep, previous: before });
    expect(snap.entries.map((e) => e.fights[0]?.opponent)).toEqual(['BEATRIZ MODELO', 'ELISA RIVAL']);
    expect(snap.state).toBeUndefined();
  });

  it('evento adicionado só no dia: varre as chaves uma vez a cada 6 h', async () => {
    const http = fakeHttp(routes('ilutas-checagem-vazia.html'));
    const snap = await syncEvent(event, athletes, http, { sleep: noSleep });
    expect(snap.state?.fullScanAt).toBeDefined();
    // Nome curto da chave + equipe: aparece como correspondência a confirmar.
    expect(snap.entries.map((e) => [e.competitorName, e.category])).toEqual([
      ['ANA FICTÍCIA', 'Peso GI - Adulto - Azul - Leve - Feminino'],
      ['ANA FICTÍCIA', 'Abs GI - Adulto - Azul/Roxa - Feminino'],
    ]);

    const again = fakeHttp(routes('ilutas-checagem-vazia.html'));
    const empty = { ...snap, entries: [] } satisfies EventSnapshot;
    const next = await syncEvent(event, athletes, again, { sleep: noSleep, previous: empty });
    expect(again.calls.filter((u) => u.includes('&categ='))).toHaveLength(0);
    expect(next.state?.fullScanAt).toBe(snap.state?.fullScanAt);
  });

  it('resolve o slug também pelo link das chaves (checagem fora do ar)', async () => {
    const http = fakeHttp({
      ...routes('ilutas-checagem.html'),
      [`${BASE}/evento/copa-exemplo`]: fixture('ilutas-evento.html').replace('checagem/list-all/?event=abc123', 'chaves/?event=abc123'),
    });
    const data = await iLutasAdapter.fetchEvent(
      { provider: 'ilutas', externalId: 'slug:copa-exemplo', url: `${BASE}/evento/copa-exemplo` },
      http,
    );
    expect(data.name).toBe('Copa Exemplo de Jiu-Jitsu');
    expect(data.date).toBe('2026-11-22');
    expect(data.competitors).toHaveLength(3);
  });
});
