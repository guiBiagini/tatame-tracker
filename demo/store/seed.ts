/**
 * Dados da vitrine da Chrome Web Store. Tudo fictício: nomes, equipes e
 * eventos inventados (nenhuma consulta real é feita nesta página).
 */
import type { Athlete, EventSnapshot, TrackedEvent } from '../../src/core/model';
import { athletesItem, eventsItem, snapshotsItem } from '../../src/lib/storage';

const TEAM = 'Equipe Exemplo';
export const storeAthletes: Athlete[] = [
  { id: 'a1', name: 'Ana Exemplo Rocha', team: TEAM, aliases: [] },
  { id: 'a2', name: 'Bruno Fictício Dias', team: TEAM, aliases: [] },
  { id: 'a3', name: 'Carla Demonstração Nunes', team: TEAM, aliases: [] },
  { id: 'a4', name: 'João P. Silva', team: TEAM, aliases: ['João Pedro da Silva'] },
  { id: 'a5', name: 'Lucas Modelo Prado', team: TEAM, aliases: [] },
  { id: 'a6', name: 'Marina Teste Alves', team: TEAM, aliases: [] },
  { id: 'a7', name: 'Pedro Henrique Lima', team: TEAM, aliases: [] },
];

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export const storeEvents: TrackedEvent[] = [
  { id: 'ibjjf:9001', provider: 'ibjjf', externalId: '9001', url: 'https://www.bjjcompsystem.com/tournaments/9001/categories', name: 'Exemplo Open IBJJF 2026', date: '2026-11-21', addedAt: ago(9000) },
  { id: 'meucombate:900', provider: 'meucombate', externalId: '900', url: 'https://eventocbjje.com.br/cbjje/evento/900/informacoes', name: 'Copa Exemplo CBJJE', date: '2026-12-06', addedAt: ago(8000) },
  { id: 'ilutas:abc123def', provider: 'ilutas', externalId: 'abc123def', url: 'https://www.ilutas.com.br/Evento/?event=abc123def', name: 'Desafio Fictício de Jiu-Jitsu', date: '2027-01-17', addedAt: ago(7000) },
];

export const storeSnapshots: Record<string, EventSnapshot> = {
  'ibjjf:9001': {
    eventId: 'ibjjf:9001', fetchedAt: ago(3), name: 'Exemplo Open IBJJF 2026', date: '2026-11-21', bracketsPublished: true,
    entries: [
      { athleteId: 'a4', eventId: 'ibjjf:9001', category: 'Adult / Male / BLUE / Light', competitorName: 'João Pedro da Silva', competitorTeam: TEAM, matchScore: 1, status: 'scheduled',
        fights: [
          { fightNumber: '12', round: 'Oitavas', mat: 'Tatame 3', startsAt: '2026-11-21T10:20', opponent: 'Rival Um', finished: true, won: true },
          { fightNumber: '31', round: 'Semi-Final', mat: 'Tatame 3', startsAt: '2026-11-21T11:05', opponent: 'Rival Dois', opponentTeam: 'Outra Equipe', finished: false },
        ] },
      { athleteId: 'a1', eventId: 'ibjjf:9001', category: 'Adult / Female / PURPLE / Feather', competitorName: 'Ana Exemplo Rocha', competitorTeam: TEAM, matchScore: 1, status: 'scheduled',
        fights: [{ fightNumber: '18', round: 'Quartas', mat: 'Tatame 5', startsAt: '2026-11-21T09:40', opponent: 'Rival Três', finished: false }] },
      { athleteId: 'a7', eventId: 'ibjjf:9001', category: 'Master 1 / Male / BLACK / Medium', competitorName: 'Pedro Henrique Lima', competitorTeam: TEAM, matchScore: 1, status: 'scheduled',
        fights: [{ fightNumber: '52', round: 'Final', mat: 'Tatame 1', startsAt: '2026-11-21T14:30', opponent: 'Rival Quatro', finished: false }] },
    ],
  },
  'meucombate:900': {
    eventId: 'meucombate:900', fetchedAt: ago(42), name: 'Copa Exemplo CBJJE', date: '2026-12-06', bracketsPublished: false,
    entries: [
      { athleteId: 'a2', eventId: 'meucombate:900', category: 'Juvenil - Azul - Pena - Masculino', competitorName: 'Bruno Fictício Dias', competitorTeam: TEAM, matchScore: 1, status: 'registered', fights: [] },
      { athleteId: 'a3', eventId: 'meucombate:900', category: 'Adulto - Branca - Leve - Feminino', competitorName: 'Carla Demonstração Nunes', competitorTeam: TEAM, matchScore: 1, status: 'registered', fights: [] },
      { athleteId: 'a5', eventId: 'meucombate:900', category: 'Adulto - Roxa - Médio - Masculino', competitorName: 'Lucas M. Prado', competitorTeam: 'Equipe Exemplo Centro', matchScore: 0.7, status: 'registered', fights: [] },
    ],
  },
  'ilutas:abc123def': {
    eventId: 'ilutas:abc123def', fetchedAt: ago(180), name: 'Desafio Fictício de Jiu-Jitsu', date: '2027-01-17', bracketsPublished: false,
    entries: [
      { athleteId: 'a6', eventId: 'ilutas:abc123def', category: 'Peso GI - Adulto - Marrom - Leve - Feminino', competitorName: 'MARINA TESTE ALVES', competitorTeam: TEAM, matchScore: 1, status: 'registered', fights: [] },
    ],
  },
};

export async function seedStore() {
  await athletesItem.setValue(storeAthletes);
  await eventsItem.setValue(storeEvents);
  await snapshotsItem.setValue(storeSnapshots);
}
