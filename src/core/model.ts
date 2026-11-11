/**
 * Modelo normalizado. A interface e o núcleo só conhecem estes tipos;
 * cada adaptador traduz o formato da sua plataforma para cá.
 */

export type ProviderId = 'ibjjf' | 'meucombate' | 'ilutas';

/** Atleta da academia cadastrado pelo usuário. */
export interface Athlete {
  id: string;
  name: string;
  /** Equipe como costuma aparecer nas inscrições; ajuda a desempatar homônimos. */
  team?: string;
  /** Outras grafias do nome (apelido, nome abreviado etc.). */
  aliases: string[];
}

/** Campeonato acompanhado (o usuário cola a URL e o adaptador identifica). */
export interface TrackedEvent {
  /** `${provider}:${externalId}` */
  id: string;
  provider: ProviderId;
  externalId: string;
  url: string;
  name: string;
  /** Primeiro dia do evento, `YYYY-MM-DD`, quando a plataforma informa. */
  date?: string;
  addedAt: string;
}

/**
 * Ciclo de vida de uma inscrição. Muitas organizações só publicam chave e
 * cronograma perto do evento, então "registered" é um estado normal, não erro.
 */
export type EntryStatus = 'registered' | 'bracket_published' | 'scheduled' | 'finished';

export interface Fight {
  category?: string;
  fightNumber?: string;
  round?: string;
  mat?: string;
  /** Texto original da plataforma, ex.: "Fri 11/06 at 16:58". */
  when?: string;
  /** Horário local do evento, `YYYY-MM-DDTHH:mm` (sem fuso). */
  startsAt?: string;
  opponent?: string;
  opponentTeam?: string;
  finished: boolean;
  won?: boolean;
}

/** Um competidor como aparece na lista de inscritos da plataforma. */
export interface Competitor {
  name: string;
  team?: string;
  category?: string;
  externalId?: string;
}

/** Atleta da academia × evento × categoria. */
export interface Entry {
  athleteId: string;
  eventId: string;
  category: string;
  competitorName: string;
  competitorTeam?: string;
  /** 0–1. Abaixo de MATCH_THRESHOLD a interface mostra como "possível". */
  matchScore: number;
  status: EntryStatus;
  fights: Fight[];
}

export interface EventSnapshot {
  eventId: string;
  fetchedAt: string;
  name: string;
  date?: string;
  bracketsPublished: boolean;
  entries: Entry[];
  error?: string;
}

export const STATUS_LABEL: Record<EntryStatus, string> = {
  registered: 'Inscrito – chave ainda não publicada',
  bracket_published: 'Chave publicada – aguardando horário',
  scheduled: 'Luta agendada',
  finished: 'Lutas encerradas',
};
