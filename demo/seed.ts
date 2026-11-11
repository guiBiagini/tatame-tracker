import type { Athlete, EventSnapshot, TrackedEvent } from '../src/core/model';
import { athletesItem, eventsItem, snapshotsItem } from '../src/lib/storage';

export const DEMO_EVENT_ID = 'ibjjf:demo';

const athletes: Athlete[] = [
  { id: 'a1', name: 'HEITOR SANTOS DE CARAVALHO', aliases: [] },
  { id: 'a2', name: 'Luiz Miguel Estevão Santos', aliases: [] },
  { id: 'a3', name: 'ROGER RANIERI GONCALVES DE MELO', aliases: [] },
  { id: 'd1', name: 'João P. Silva', team: 'Equipe Exemplo', aliases: [] },
  { id: 'd2', name: 'Pedro Henrique Lima', team: 'Equipe Exemplo', aliases: [] },
];

const events: TrackedEvent[] = [
  {
    id: 'meucombate:95',
    provider: 'meucombate',
    externalId: '95',
    url: 'https://eventocbjje.com.br/cbjje/evento/95/informacoes',
    name: 'Mundial CBJJE',
    addedAt: new Date().toISOString(),
  },
  {
    id: DEMO_EVENT_ID,
    provider: 'ibjjf',
    externalId: 'demo',
    url: 'https://www.bjjcompsystem.com/tournaments/demo',
    name: 'Exemplo Open IBJJF (dados fictícios)',
    date: '2026-11-14',
    addedAt: new Date().toISOString(),
  },
];

/** Evento fictício no formato IBJJF: mostra como ficam tatame, horário e lutas. */
const demoSnapshot: EventSnapshot = {
  eventId: DEMO_EVENT_ID,
  fetchedAt: new Date().toISOString(),
  name: 'Exemplo Open IBJJF (dados fictícios)',
  date: '2026-11-14',
  bracketsPublished: true,
  entries: [
    {
      athleteId: 'd1',
      eventId: DEMO_EVENT_ID,
      category: 'Adult / Male / BLUE / Light',
      competitorName: 'João Pedro da Silva',
      competitorTeam: 'Equipe Exemplo',
      matchScore: 0.95,
      status: 'scheduled',
      fights: [
        {
          fightNumber: '12',
          round: 'Oitavas',
          mat: 'Tatame 3',
          startsAt: '2026-11-14T10:20',
          opponent: 'Rival Um',
          opponentTeam: 'Outra Equipe',
          finished: true,
          won: true,
        },
        {
          fightNumber: '31',
          round: 'Semi-Final',
          mat: 'Tatame 3',
          startsAt: '2026-11-14T11:05',
          opponent: 'Rival Dois',
          opponentTeam: 'Outra Equipe',
          finished: false,
        },
      ],
    },
    {
      athleteId: 'd2',
      eventId: DEMO_EVENT_ID,
      category: 'Adult / Male / BLUE / Absolute',
      competitorName: 'Pedro H. Lima Costa',
      competitorTeam: 'Time Diferente',
      matchScore: 0.7,
      status: 'scheduled',
      fights: [
        {
          fightNumber: '44',
          round: 'Quartas',
          mat: 'Tatame 5',
          startsAt: '2026-11-14T14:30',
          opponent: 'Rival Três',
          finished: false,
        },
      ],
    },
  ],
};

export async function seedIfEmpty() {
  if ((await athletesItem.getValue()).length || (await eventsItem.getValue()).length) return;
  await athletesItem.setValue(athletes);
  await eventsItem.setValue(events);
  await snapshotsItem.setValue({ [DEMO_EVENT_ID]: demoSnapshot });
}

export async function resetDemo() {
  await athletesItem.setValue([]);
  await eventsItem.setValue([]);
  await seedIfEmpty();
}
