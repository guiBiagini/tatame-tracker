import type { EventRef, ProviderAdapter } from '../core/adapter';
import type { ProviderId } from '../core/model';
import { ibjjfAdapter } from './ibjjf';
import { iLutasAdapter } from './ilutas';
import { meuCombateAdapter } from './meucombate';

/**
 * Ordem importa: adaptadores identificados por domínio vêm antes do
 * Meu Combate, que é reconhecido pelo formato do caminho (domínios próprios).
 */
export const ADAPTERS: ProviderAdapter[] = [ibjjfAdapter, iLutasAdapter, meuCombateAdapter];

export function getAdapter(id: ProviderId): ProviderAdapter {
  const adapter = ADAPTERS.find((a) => a.id === id);
  if (!adapter) throw new Error(`Plataforma desconhecida: ${id}`);
  return adapter;
}

export function resolveUrl(input: string): EventRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  for (const adapter of ADAPTERS) {
    const parsed = adapter.parseUrl(url);
    if (parsed) return { provider: adapter.id, externalId: parsed.externalId, url: url.href };
  }
  return null;
}
