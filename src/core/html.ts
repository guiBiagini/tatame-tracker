import { parseHTML } from 'linkedom';

/**
 * O service worker do MV3 não tem DOMParser; linkedom funciona igual
 * na extensão, nos testes (Node) e num futuro backend.
 */
export function parseDocument(html: string): Document {
  return parseHTML(html).document as unknown as Document;
}

export function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}
