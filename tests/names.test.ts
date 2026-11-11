import { describe, expect, it } from 'vitest';
import { matchAthletes } from '../src/core/sync';
import { athleteScore, MATCH_THRESHOLD, nameScore, normalize, POSSIBLE_THRESHOLD } from '../src/core/names';

describe('normalize', () => {
  it('remove acentos, caixa e pontuação', () => {
    expect(normalize('  JOÃO  P. da Sílva ')).toBe('joao p da silva');
  });
});

describe('nameScore', () => {
  it('nome idêntico (ignorando acento/caixa) = 1', () => {
    expect(nameScore('João Pedro da Silva', 'JOAO PEDRO DA SILVA')).toBe(1);
  });

  it('aceita nome do meio abreviado ou ausente', () => {
    expect(nameScore('João P. Silva', 'João Pedro da Silva')).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
    expect(nameScore('João Silva', 'João Pedro da Silva')).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it('sobrenome diferente não é correspondência', () => {
    expect(nameScore('João Silva', 'João Souza')).toBeLessThan(POSSIBLE_THRESHOLD);
  });

  it('nome do meio diferente nos dois lados = outra pessoa', () => {
    expect(nameScore('João P. Silva', 'João Henrique Santos Silva')).toBeLessThan(POSSIBLE_THRESHOLD);
    expect(nameScore('João P. Silva', 'João Victor Ribeiro da Silva')).toBeLessThan(POSSIBLE_THRESHOLD);
  });

  it('nome do meio faltando em um dos lados continua aceito', () => {
    expect(nameScore('João Pedro Santos Silva', 'João Santos Silva')).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it('nome incompleto no site vira só sugestão', () => {
    const score = nameScore('João P. Silva', 'João Pedro');
    expect(score).toBeGreaterThanOrEqual(POSSIBLE_THRESHOLD);
    expect(score).toBeLessThan(MATCH_THRESHOLD);
  });

  it('nomes sem relação têm pontuação baixa', () => {
    expect(nameScore('Ana Rocha', 'Bruno Dias')).toBeLessThan(0.2);
  });
});

describe('athleteScore', () => {
  it('apelido cadastrado vale como nome', () => {
    const athlete = { name: 'Carlos Eduardo Santos', aliases: ['Cadu Santos'], team: undefined };
    expect(athleteScore(athlete, { name: 'Cadu Santos' })).toBe(1);
  });

  it('equipe igual dá bônus de desempate', () => {
    const athlete = { name: 'João Silva', aliases: [], team: 'Gracie Barra' };
    const withTeam = athleteScore(athlete, { name: 'João Silva Costa', team: 'GRACIE BARRA BH' });
    const withoutTeam = athleteScore(athlete, { name: 'João Silva Costa', team: 'Checkmat' });
    expect(withTeam).toBeGreaterThan(withoutTeam);
  });
});

describe('matchAthletes', () => {
  const athlete = { id: 'a', name: 'Pedro Henrique Lima', aliases: [] };

  it('com correspondência certa, descarta sugestões do mesmo atleta', () => {
    const m = matchAthletes([athlete], [
      { name: 'Pedro Henrique Lima' },
      { name: 'Pedro Henrique' },
    ]);
    expect(m.map((x) => x.competitor.name)).toEqual(['Pedro Henrique Lima']);
  });

  it('sem correspondência certa, mostra no máximo 3 nomes', () => {
    const names = ['Pedro H', 'Pedro Henrique', 'Pedro Henrique L', 'Pedro Hen', 'Pedro'];
    const m = matchAthletes([athlete], names.map((name) => ({ name })));
    expect(new Set(m.map((x) => x.competitor.name)).size).toBeLessThanOrEqual(3);
  });
});
