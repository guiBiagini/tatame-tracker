import type { Athlete, EventSnapshot, TrackedEvent } from '../src/core/model';
import { athletesItem, eventsItem, snapshotsItem } from '../src/lib/storage';

export const DEMO_EVENT_ID = 'ibjjf:demo';
const ILUTAS_DEMO_ID = 'ilutas:demo';
/** Eventos fictícios: o "Atualizar" da demo não os consulta. */
export const isDemoEvent = (id: string) => id.endsWith(':demo');

const athletes: Athlete[] = [
  { id: 'a1', name: 'Ana Exemplo Rocha', aliases: [] },
  { id: 'a2', name: 'Bruno Fictício Dias', aliases: [] },
  { id: 'a3', name: 'Carla Demonstração Nunes', aliases: [] },
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
  {
    id: ILUTAS_DEMO_ID,
    provider: 'ilutas',
    externalId: 'demo',
    url: 'https://www.ilutas.com.br/evento/demo',
    name: 'Copa Exemplo iLutas (dados fictícios)',
    date: '2026-11-22',
    addedAt: new Date().toISOString(),
  },
];

/** Evento fictício no formato iLutas: chave e previsão pelo cronograma, sem tatame. */
const iLutasSnapshot: EventSnapshot = {
  eventId: ILUTAS_DEMO_ID,
  fetchedAt: new Date().toISOString(),
  name: 'Copa Exemplo iLutas (dados fictícios)',
  date: '2026-11-22',
  bracketsPublished: true,
  entries: [
    {
      athleteId: 'a1',
      eventId: ILUTAS_DEMO_ID,
      category: 'Peso GI - Adulto - Azul - Leve - Feminino',
      competitorName: 'ANA EXEMPLO ROCHA',
      matchScore: 1,
      status: 'bracket_published',
      fights: [
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
      ],
    },
    {
      athleteId: 'a3',
      eventId: ILUTAS_DEMO_ID,
      category: 'Abs GI - Adulto - Branca - Feminino',
      competitorName: 'CARLA DEMONSTRAÇÃO NUNES',
      matchScore: 1,
      status: 'bracket_published',
      fights: [
        {
          category: 'Abs GI - Adulto - Branca - Feminino',
          finished: false,
          startsAt: '2026-11-22T16:30',
          estimated: true,
          note: 'Cronograma: 16:30 INICIO DOS ABSOLUTOS · Chave de 3: quem perde a 1ª luta enfrenta o 3º atleta',
          bracketSize: 3,
          round: 'Final',
          opponent: 'vencedor de ELISA RIVAL x FERNANDA TESTE',
        },
      ],
    },
  ],
};

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
  await snapshotsItem.setValue({ [DEMO_EVENT_ID]: demoSnapshot, [ILUTAS_DEMO_ID]: iLutasSnapshot });
}

export async function resetDemo() {
  await athletesItem.setValue([]);
  await eventsItem.setValue([]);
  await seedIfEmpty();
}
