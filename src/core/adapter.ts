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

const RETRY_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 5;
/** Sem limite, um site que segura a conexão travaria a fila de sincronização. */
const REQUEST_TIMEOUT_MS = 20_000;
/** As maiores páginas reais (checagem do iLutas) ficam bem abaixo disso. */
const MAX_RESPONSE_BYTES = 10_000_000;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `fetch` com nova tentativa quando o site limita requisições (429) ou está
 * instável (5xx): respeita `Retry-After` e, sem ele, espera 2s, 4s, 8s...
 */
async function politeFetch(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (res.ok) {
      if (Number(res.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
        throw new Error(`Resposta grande demais em ${url}`);
      }
      return res;
    }
    if (!RETRY_STATUS.has(res.status) || attempt >= MAX_RETRIES) {
      throw new Error(`HTTP ${res.status} em ${url}`);
    }
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(retryAfter > 0 ? Math.min(retryAfter, 60) * 1000 : 2000 * 2 ** attempt);
  }
}

export const browserHttp: Http = {
  async text(url) {
    return (await politeFetch(url)).text();
  },
  async json<T>(url: string) {
    return (await (await politeFetch(url)).json()) as T;
  },
};
