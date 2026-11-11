import type { Competitor, Fight, ProviderId } from './model';

/** Acesso HTTP injetado: `fetch` na extensão, fixtures nos testes. */
export interface Http {
  text(url: string): Promise<string>;
  json<T>(url: string): Promise<T>;
}

export interface EventRef {
  provider: ProviderId;
  externalId: string;
  url: string;
}

export interface EventData {
  name: string;
  date?: string;
  bracketsPublished: boolean;
  competitors: Competitor[];
}

/**
 * Contrato de integração. Um adaptador por *plataforma* (não por federação):
 * várias federações usam o mesmo sistema.
 */
export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  /** Reconhece a URL colada pelo usuário. Retorna null se não for desta plataforma. */
  parseUrl(url: URL): { externalId: string } | null;
  fetchEvent(ref: EventRef, http: Http): Promise<EventData>;
  /** Só para plataformas que publicam tatame/horário por atleta. */
  fetchFights?(ref: EventRef, competitor: Competitor, http: Http): Promise<Fight[]>;
}

export const browserHttp: Http = {
  async text(url) {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return res.text();
  },
  async json<T>(url: string) {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return (await res.json()) as T;
  },
};
