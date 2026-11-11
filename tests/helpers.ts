import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Http } from '../src/core/adapter';

export const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

/** Http falso: responde por prefixo de URL e registra as chamadas. */
export function fakeHttp(routes: Record<string, string | unknown>): Http & { calls: string[] } {
  const calls: string[] = [];
  const find = (url: string) => {
    calls.push(url);
    const key = Object.keys(routes)
      .filter((k) => url.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (key === undefined) throw new Error(`Rota não mapeada no teste: ${url}`);
    return routes[key];
  };
  return {
    calls,
    async text(url) {
      return find(url) as string;
    },
    async json<T>(url: string) {
      return find(url) as T;
    },
  };
}
