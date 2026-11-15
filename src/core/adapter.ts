import type { Competitor, EventSnapshot, Fight, ProviderId } from './model';

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
  /** Dados já carregados que o adaptador reaproveita em `fetchFights` (evita baixar de novo). */
  context?: unknown;
  /** Gravado no snapshot e devolvido na próxima consulta em `FetchOptions.previous.state`. */
  state?: Record<string, string>;
}

export interface FetchOptions {
  /** Resultado da consulta anterior do mesmo evento, se houver. */
  previous?: EventSnapshot;
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
  fetchEvent(ref: EventRef, http: Http, options?: FetchOptions): Promise<EventData>;
  /** Lutas, chave ou previsão de horário de um competidor encontrado. */
  fetchFights?(ref: EventRef, competitor: Competitor, http: Http, context?: unknown): Promise<Fight[]>;
  /**
   * A plataforma publica tatame/horário que mudam durante o evento: no dia,
   * a extensão consulta a cada 5 min em vez de 1 h.
   */
  liveSchedule?: boolean;
}

const RETRY_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 5;
/** Sem limite, um site que segura a conexão travaria a fila de sincronização. */
const REQUEST_TIMEOUT_MS = 20_000;
/** As maiores páginas reais (checagem do iLutas) ficam bem abaixo disso. */
const MAX_RESPONSE_BYTES = 10_000_000;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Timeout e queda de conexão: poucas tentativas extras (cada uma pode levar 20 s). */
const MAX_NETWORK_RETRIES = 2;

/**
 * `fetch` com nova tentativa quando o site limita requisições (429), está
 * instável (5xx), demora demais ou a conexão cai: respeita `Retry-After` e,
 * sem ele, espera 2s, 4s, 8s...
 */
async function politeFetch(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (err) {
      if (attempt >= MAX_NETWORK_RETRIES) {
        const reason = err instanceof Error && err.name === 'TimeoutError' ? 'tempo esgotado' : 'falha de conexão';
        throw new Error(`${reason} em ${url}`);
      }
      await sleep(2000 * 2 ** attempt);
      continue;
    }
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

/**
 * Decodifica pelo charset do `Content-Type`. `Response.text()` assume UTF-8,
 * mas há páginas em ISO-8859-1 (ex.: checagem do iLutas): "JOÃO" virava "JO�O".
 */
export function decodeBody(body: ArrayBuffer, contentType: string | null): string {
  const charset = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  try {
    return new TextDecoder(charset || 'utf-8').decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body); // charset desconhecido
  }
}

export const browserHttp: Http = {
  async text(url) {
    const res = await politeFetch(url);
    return decodeBody(await res.arrayBuffer(), res.headers.get('content-type'));
  },
  async json<T>(url: string) {
    return (await (await politeFetch(url)).json()) as T;
  },
};
