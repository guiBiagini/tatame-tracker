import type { ProviderAdapter } from '../core/adapter';
import { parsePtDate } from '../core/dates';
import { clean, parseDocument } from '../core/html';
import type { Competitor } from '../core/model';

/**
 * iLutas — plataforma usada por várias federações (CBJJC, FMAS/PFBJJ, FCJJE,
 * FEJJES...). HTML gerado no servidor; a "checagem" traz todos os inscritos
 * numa página só. A plataforma não publica tatame/horário por atleta.
 *
 * URLs reconhecidas:
 *   /evento/<slug>
 *   /Evento/?event=<hash>  ou  /checagem/list-all/?event=<hash>
 */

const BASE = 'https://www.ilutas.com.br';

export const iLutasAdapter: ProviderAdapter = {
  id: 'ilutas',
  label: 'iLutas',

  parseUrl(url) {
    if (!/(^|\.)ilutas\.com\.br$/.test(url.hostname)) return null;
    const hash = url.searchParams.get('event');
    if (hash) return { externalId: hash };
    const slug = url.pathname.match(/^\/evento\/([^/?#]+)/i)?.[1];
    return slug ? { externalId: `slug:${slug}` } : null;
  },

  async fetchEvent(ref, http) {
    let hash = ref.externalId;
    let eventHtml: string;
    if (hash.startsWith('slug:')) {
      eventHtml = await http.text(`${BASE}/evento/${hash.slice(5)}`);
      const found = eventHtml.match(/checagem\/list-all\/\?event=([a-f0-9]+)/i)?.[1];
      if (!found) throw new Error('Lista de inscritos (checagem) não encontrada na página do evento');
      hash = found;
    } else {
      eventHtml = await http.text(`${BASE}/Evento/?event=${hash}`);
    }

    const checagem = await http.text(`${BASE}/checagem/list-all/?event=${hash}`);
    const { name, competitors } = parseChecagem(checagem);
    const eventDoc = parseDocument(eventHtml);

    return {
      name: name || eventTitle(eventDoc) || 'Evento iLutas',
      date: parsePtDate(eventDoc.body?.textContent ?? ''),
      bracketsPublished: false,
      competitors,
    };
  },
};

function eventTitle(doc: Document): string | undefined {
  // <title>iLUTAS - Campeonato de Jiu-Jitsu: Sul-Americano de Jiu-Jitsu</title>
  return clean(doc.querySelector('title')?.textContent).split(': ').slice(1).join(': ') || undefined;
}

export function parseChecagem(html: string): { name: string; competitors: Competitor[] } {
  const doc = parseDocument(html);
  const name = clean(doc.querySelector('.header-cinza h2')?.textContent).replace(/^Checagem\s+/i, '');

  const competitors: Competitor[] = [];
  for (const block of doc.querySelectorAll('td .col-lg-10')) {
    const nameEl = [...block.children].find((el) => el.tagName === 'B');
    const athleteName = clean(nameEl?.textContent);
    if (!athleteName) continue;

    const teamLink = block.querySelector('a[href*="team/?type=equ"]');
    const team = clean(teamLink?.previousSibling?.textContent) || undefined;

    const categoryLinks = [...block.querySelectorAll('a[href*="filter/?type="]')];
    const categories = categoryLinks.map((a) => clean(a.previousSibling?.textContent)).filter(Boolean);

    for (const category of categories.length ? categories : [undefined]) {
      competitors.push({ name: athleteName, team, category });
    }
  }
  return { name, competitors };
}
