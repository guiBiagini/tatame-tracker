import { describe, expect, it } from 'vitest';
import { iLutasAdapter, parseChecagem } from '../src/adapters/ilutas';
import { fakeHttp, fixture } from './helpers';

const BASE = 'https://www.ilutas.com.br';

describe('ilutas.parseUrl', () => {
  it.each([
    [`${BASE}/evento/sulamericano`, 'slug:sulamericano'],
    [`${BASE}/checagem/list-all/?event=abc123`, 'abc123'],
    [`${BASE}/Evento/?event=abc123`, 'abc123'],
  ])('%s', (url, id) => {
    expect(iLutasAdapter.parseUrl(new URL(url))).toEqual({ externalId: id });
  });
});

describe('ilutas.parseChecagem', () => {
  const { name, competitors } = parseChecagem(fixture('ilutas-checagem.html'));

  it('lê o nome do evento do cabeçalho', () => {
    expect(name).toBe('Copa Exemplo de Jiu-Jitsu');
  });

  it('gera um competidor por categoria (peso e absoluto)', () => {
    expect(competitors).toEqual([
      { name: 'ANA FICTÍCIA ROCHA', team: 'ACADEMIA EXEMPLO', category: 'Peso GI - Adulto - Azul - Leve - Feminino' },
      { name: 'ANA FICTÍCIA ROCHA', team: 'ACADEMIA EXEMPLO', category: 'Abs GI - Adulto - Azul - Feminino' },
      { name: 'BRUNO EXEMPLO DIAS', team: 'OUTRA EQUIPE', category: 'Peso GI - Master 1 - Roxa - Médio - Masculino' },
    ]);
  });
});

describe('ilutas.fetchEvent', () => {
  it('resolve o slug, lê data da página do evento e inscritos da checagem', async () => {
    const http = fakeHttp({
      [`${BASE}/evento/copa-exemplo`]: fixture('ilutas-evento.html'),
      [`${BASE}/checagem/list-all/?event=abc123`]: fixture('ilutas-checagem.html'),
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
