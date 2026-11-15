import { sleep, type Http, type ProviderAdapter } from '../core/adapter';
import { parsePtDate } from '../core/dates';
import { clean, parseDocument } from '../core/html';
import type { Competitor, EventSnapshot, Fight } from '../core/model';
import { normalize, teamMatches, tokens } from '../core/names';

/**
 * iLutas — plataforma usada por várias federações (CBJJC, FMAS/PFBJJ, FCJJE,
 * FEJJES...). HTML gerado no servidor. A plataforma não publica tatame nem
 * horário por luta; o que existe:
 *
 *   - checagem (lista de inscritos): some da página no dia do evento;
 *   - chaves por categoria (`/chaves/?event=&tpcateg=&categ=`), com os mesmos
 *     códigos de categoria dos links da checagem;
 *   - cronograma: tabela livre do organizador, um horário por grupo
 *     ("15:00 FAIXA AZUL – ADULTO E MASTER"). Vira *previsão* de horário.
 *
 * URLs reconhecidas:
 *   /evento/<slug>
 *   /Evento/?event=<hash>  ou  /checagem/list-all/?event=<hash>
 */

const BASE = 'https://www.ilutas.com.br';
/** Validados antes de entrar na URL: impedem injeção de parâmetros (&, #, ?). */
const HASH_RE = /^[a-f0-9]{6,64}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9._-]*$/i;
const TYPE_RE = /^\d{1,3}$/;
const CATEG_RE = /^\d{1,12}$/;

/**
 * Varredura completa: até 3 páginas de chave ao mesmo tempo (cada uma leva
 * ~1 s no iLutas; uma por vez, 250 chaves passavam de 5 min), com pausa curta.
 */
const SCAN_CONCURRENCY = 3;
const SCAN_DELAY_MS = 150;
/** Varredura completa (todas as chaves) no máximo a cada 6 h. */
const FULL_SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Quantas chaves parecidas abrir ao procurar um atleta pela categoria. */
const MAX_CANDIDATE_BRACKETS = 3;

export interface ScheduleRow {
  time: string;
  text: string;
}

export interface Option {
  id: string;
  label: string;
}

export interface BracketSlot {
  seed: string;
  name: string;
  team?: string;
}

export interface Bracket {
  size: number;
  /** Folhas da árvore na ordem de confronto: metade esquerda e depois a direita. */
  slots: BracketSlot[];
}

interface IlutasContext {
  hash: string;
  date?: string;
  schedule: ScheduleRow[];
  types: Option[];
  lists: Map<string, Option[]>;
  brackets: Map<string, Bracket>;
}

export const iLutasAdapter: ProviderAdapter = {
  id: 'ilutas',
  label: 'iLutas',

  parseUrl(url) {
    if (!/(^|\.)ilutas\.com\.br$/.test(url.hostname)) return null;
    const hash = url.searchParams.get('event');
    if (hash) return HASH_RE.test(hash) ? { externalId: hash } : null;
    const slug = url.pathname.match(/^\/evento\/([^/?#]+)/i)?.[1];
    return slug && SLUG_RE.test(slug) ? { externalId: `slug:${slug}` } : null;
  },

  async fetchEvent(ref, http, options = {}) {
    // Revalida o que veio do storage antes de montar URLs.
    const valid = ref.externalId.startsWith('slug:')
      ? SLUG_RE.test(ref.externalId.slice(5))
      : HASH_RE.test(ref.externalId);
    if (!valid) throw new Error('Identificador de evento iLutas inválido');
    let hash = ref.externalId;
    let eventHtml: string;
    if (hash.startsWith('slug:')) {
      eventHtml = await http.text(`${BASE}/evento/${hash.slice(5)}`);
      // No dia do evento o link da checagem some; o das chaves continua.
      const found = eventHtml.match(/(?:checagem\/list-all|chaves)\/\?event=([a-f0-9]{6,64})/i)?.[1];
      if (!found) throw new Error('Lista de inscritos (checagem) não encontrada na página do evento');
      hash = found;
    } else {
      eventHtml = await http.text(`${BASE}/Evento/?event=${hash}`);
    }

    const eventDoc = parseDocument(eventHtml);
    const date = parsePtDate(eventDoc.body?.textContent ?? '');
    const checagem = await http
      .text(`${BASE}/checagem/list-all/?event=${hash}`)
      .then(parseChecagem)
      .catch(() => ({ name: '', competitors: [] as Competitor[] })); // fora do ar no dia do evento
    const types = parseOptions(await http.text(`${BASE}/chaves/?event=${hash}`), 'tpcateg');
    const ctx: IlutasContext = {
      hash,
      date,
      schedule: parseSchedule(eventDoc),
      types,
      lists: new Map(),
      brackets: new Map(),
    };

    let competitors = checagem.competitors;
    let state = options.previous?.state;
    if (!competitors.length) {
      competitors = fromPreviousEntries(options.previous);
      if (!competitors.length && types.length && fullScanDue(options.previous)) {
        competitors = await scanAllBrackets(ctx, http);
        state = { ...state, fullScanAt: new Date().toISOString() };
      }
    }

    return {
      name: checagem.name || eventTitle(eventDoc) || 'Evento iLutas',
      date,
      bracketsPublished: types.length > 0,
      competitors,
      context: ctx,
      ...(state && { state }),
    };
  },

  async fetchFights(_ref, competitor, http, context) {
    const ctx = context as IlutasContext | undefined;
    if (!ctx) return [];
    const row = estimateStart(competitor.category ?? '', ctx.schedule);
    const found = ctx.types.length ? await findInBrackets(ctx, competitor, http) : undefined;
    if (!found && !row) return [];

    const fight: Fight = { category: competitor.category, finished: false };
    if (row) {
      if (ctx.date) fight.startsAt = `${ctx.date}T${row.time}`;
      else fight.when = row.time;
      fight.estimated = true;
      fight.note = `Cronograma: ${row.time} ${row.text}`;
    }
    if (found) {
      const { bracket, index } = found;
      const { opponent, opponentTeam, round } = firstFight(bracket, index);
      fight.bracketSize = bracket.size;
      if (round) fight.round = round;
      if (opponent) fight.opponent = opponent;
      if (opponentTeam) fight.opponentTeam = opponentTeam;
      if (bracket.size === 3) {
        fight.note = [fight.note, 'Chave de 3: quem perde a 1ª luta enfrenta o 3º atleta'].filter(Boolean).join(' · ');
      }
    }
    return [fight];
  },
};

/* --------------------------------------------------------------- páginas */

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

    const categories = [...block.querySelectorAll('a[href*="filter/?type="]')]
      .map((a) => ({ category: clean(a.previousSibling?.textContent), externalId: categoryId(a.getAttribute('href')) }))
      .filter((c) => c.category);

    if (!categories.length) competitors.push({ name: athleteName, team, category: undefined });
    for (const c of categories) {
      competitors.push({ name: athleteName, team, category: c.category, ...(c.externalId && { externalId: c.externalId }) });
    }
  }
  return { name, competitors };
}

/** "../filter/?type=1&event=…&categ=5683261" → "1:5683261" (mesmos códigos das chaves). */
function categoryId(href: string | null): string | undefined {
  const query = new URLSearchParams(href?.split('?')[1] ?? '');
  const type = query.get('type') ?? '';
  const categ = query.get('categ') ?? '';
  return TYPE_RE.test(type) && CATEG_RE.test(categ) ? `${type}:${categ}` : undefined;
}

/** Opções numéricas de um `<select>` da página de chaves (tipos ou categorias). */
export function parseOptions(html: string, select: 'tpcateg' | 'categ'): Option[] {
  const doc = parseDocument(html);
  return [...doc.querySelectorAll(`select[name="${select}"] option`)]
    // O site escreve <OPTION VALUE=…>, e o linkedom preserva a caixa do atributo.
    .map((o) => ({
      id: [...o.attributes].find((a) => a.name.toLowerCase() === 'value')?.value ?? '',
      label: clean(o.textContent),
    }))
    .filter((o) => (select === 'tpcateg' ? TYPE_RE : CATEG_RE).test(o.id));
}

/** Linhas "horário + grupo" da aba Cronograma da página do evento. */
export function parseSchedule(doc: Document): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  for (const tr of doc.querySelectorAll('#cronograma tr')) {
    const cells = [...tr.querySelectorAll('td')].map((td) => clean(td.textContent));
    const at = cells.findIndex((c) => /^\d{1,2}\s*[:h]\s*\d{2}$/i.test(c));
    if (at < 0) continue;
    const [h, m] = cells[at]!.split(/\s*[:h]\s*/i);
    const text = cells.filter((_, i) => i !== at).join(' ').trim();
    if (text) rows.push({ time: `${h!.padStart(2, '0')}:${m}`, text });
  }
  return rows;
}

/** Chave de uma categoria: posições em ordem de confronto, com nome e equipe. */
export function parseBracket(html: string): Bracket | undefined {
  const doc = parseDocument(html);
  const root = doc.querySelector('#chaves-de-campeonato');
  if (!root) return undefined;
  const size = Number(clean(root.textContent).match(/Atletas:\s*(\d+)/i)?.[1] ?? NaN);
  const slots: BracketSlot[] = [];
  for (const ul of root.querySelectorAll('ul')) {
    if (ul.classList.contains('apenas-linhas')) continue;
    for (const li of ul.children) {
      if (!/\bgame-top(-r)?\b/.test(li.className)) continue;
      const name = clean(li.querySelector('a')?.textContent);
      const next = li.nextElementSibling;
      const team = next && /\btext-cinza\b/.test(next.className) ? clean(next.textContent) : '';
      slots.push({ seed: clean(li.querySelector('.cinza')?.textContent), name, ...(name && team && { team }) });
    }
  }
  if (!slots.length) return undefined;
  return { size: Number.isFinite(size) ? size : slots.filter((s) => s.name).length, slots };
}

/* ---------------------------------------------------------------- chaves */

const ROUND_FROM_TOP = ['Final', 'Semifinal', 'Quartas de final', 'Oitavas de final'];

/**
 * Primeiro confronto do atleta na posição `index`: sobe a árvore até achar
 * o primeiro bloco vizinho com alguém (posições vazias passam direto).
 */
export function firstFight(
  bracket: Bracket,
  index: number,
): { opponent?: string; opponentTeam?: string; round?: string } {
  const n = bracket.slots.length;
  if (n < 2 || (n & (n - 1)) !== 0) return {}; // layout desconhecido: só o tamanho da chave
  const levels = Math.log2(n);
  for (let level = 1; level <= levels; level++) {
    const half = 2 ** (level - 1);
    const blockStart = Math.floor(index / (half * 2)) * half * 2;
    const siblingStart = index - blockStart < half ? blockStart + half : blockStart;
    const rivals = bracket.slots.slice(siblingStart, siblingStart + half).filter((s) => s.name);
    if (!rivals.length) continue;
    const round = ROUND_FROM_TOP[levels - level] ?? `${level}ª rodada`;
    if (rivals.length === 1) return { opponent: rivals[0]!.name, opponentTeam: rivals[0]!.team, round };
    if (rivals.length === 2) return { opponent: `vencedor de ${rivals[0]!.name} x ${rivals[1]!.name}`, round };
    return { round };
  }
  return { round: 'Sem adversário na chave' };
}

/** Posição do competidor na chave: o nome curto da chave contido no nome completo. */
export function findSlot(bracket: Bracket, competitor: Competitor): number {
  const full = tokens(competitor.name);
  let best = -1;
  let bestScore = 0;
  bracket.slots.forEach((slot, i) => {
    const short = tokens(slot.name);
    if (!short.length || short[0] !== full[0]) return;
    let at = 0;
    for (const t of full) if (t === short[at]) at++;
    if (at < short.length) return; // algum nome da chave não está no nome completo
    const score = short.length + (teamMatches(competitor.team, slot.team) ? 10 : 0);
    if (score > bestScore) [best, bestScore] = [i, score];
  });
  return best;
}

async function getBracket(ctx: IlutasContext, http: Http, type: string, categ: string) {
  const key = `${type}:${categ}`;
  if (!ctx.brackets.has(key)) {
    const bracket = parseBracket(await http.text(`${BASE}/chaves/?event=${ctx.hash}&tpcateg=${type}&categ=${categ}`));
    if (!bracket) return undefined;
    ctx.brackets.set(key, bracket);
  }
  return ctx.brackets.get(key);
}

async function getList(ctx: IlutasContext, http: Http, type: string) {
  if (!ctx.lists.has(type)) {
    ctx.lists.set(type, parseOptions(await http.text(`${BASE}/chaves/?event=${ctx.hash}&tpcateg=${type}`), 'categ'));
  }
  return ctx.lists.get(type)!;
}

async function findInBrackets(ctx: IlutasContext, competitor: Competitor, http: Http) {
  const tried = new Set<string>();
  const look = async (type: string, categ: string) => {
    tried.add(`${type}:${categ}`);
    const bracket = await getBracket(ctx, http, type, categ);
    const index = bracket ? findSlot(bracket, competitor) : -1;
    return bracket && index >= 0 ? { bracket, index } : undefined;
  };

  // 1) Código da categoria vindo da checagem: uma consulta só.
  const [type, categ] = competitor.externalId?.split(':') ?? [];
  if (type && categ && TYPE_RE.test(type) && CATEG_RE.test(categ) && ctx.types.some((t) => t.id === type)) {
    const found = await look(type, categ);
    if (found) return found;
  }

  // 2) Categoria juntada/renomeada pelo organizador: procura chaves parecidas.
  const wanted = parseCategory(competitor.category ?? '');
  for (const t of ctx.types.filter((t) => sameKind(features(t.label), wanted.features))) {
    const candidates = (await getList(ctx, http, t.id))
      .filter((o) => !tried.has(`${t.id}:${o.id}`) && categoryFits(wanted, parseCategory(o.label)))
      .slice(0, MAX_CANDIDATE_BRACKETS);
    for (const o of candidates) {
      const found = await look(t.id, o.id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Sem checagem: reaproveita os competidores encontrados na consulta anterior. */
function fromPreviousEntries(previous?: EventSnapshot): Competitor[] {
  const seen = new Set<string>();
  const competitors: Competitor[] = [];
  for (const e of previous?.entries ?? []) {
    const key = `${e.competitorName}|${e.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    competitors.push({
      name: e.competitorName,
      team: e.competitorTeam,
      category: e.category,
      ...(e.competitorId && { externalId: e.competitorId }),
    });
  }
  return competitors;
}

function fullScanDue(previous?: EventSnapshot): boolean {
  const last = Date.parse(previous?.state?.fullScanAt ?? '');
  return !Number.isFinite(last) || Date.now() - last > FULL_SCAN_INTERVAL_MS;
}

/**
 * Último recurso (evento adicionado só no dia, já sem checagem): lê todas as
 * chaves. Pode passar de 200 páginas, por isso é espaçada e rara.
 */
async function scanAllBrackets(ctx: IlutasContext, http: Http): Promise<Competitor[]> {
  const jobs: { type: Option; option: Option; prefix: string }[] = [];
  for (const type of ctx.types) {
    const prefix = categoryPrefix(features(type.label));
    for (const option of await getList(ctx, http, type.id)) jobs.push({ type, option, prefix });
  }

  let next = 0;
  let failures = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { type, option } = jobs[next++]!;
      // Uma chave que não abre não derruba a varredura inteira.
      await getBracket(ctx, http, type.id, option.id).catch(() => failures++);
      await sleep(SCAN_DELAY_MS);
    }
  };
  await Promise.all(Array.from({ length: SCAN_CONCURRENCY }, worker));
  if (failures > jobs.length / 2) throw new Error(`Não foi possível abrir ${failures} de ${jobs.length} chaves do iLutas`);

  // Montado na ordem das listas (não na ordem em que as respostas chegaram).
  return jobs.flatMap(({ type, option, prefix }) =>
    (ctx.brackets.get(`${type.id}:${option.id}`)?.slots ?? [])
      .filter((slot) => slot.name)
      .map((slot) => ({
        name: slot.name,
        team: slot.team,
        category: `${prefix} - ${option.label}`,
        externalId: `${type.id}:${option.id}`,
      })),
  );
}

/* ----------------------------------------------------- categoria × cronograma */

const DIVISIONS = ['pre mirim', 'infanto juvenil', 'mirim', 'infantil', 'juvenil', 'adulto', 'master'];
const BELTS = ['branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta', 'colorida'];

export interface Features {
  nogi: boolean;
  abs: boolean;
  desafio: boolean;
  divisions: Set<string>;
  belts: Set<string>;
  /** "todas as idades": a linha não restringe a divisão. */
  anyAge: boolean;
}

/** Lê modalidade, absoluto, divisão de idade e faixa de um texto livre. */
export function features(text: string): Features {
  let t = ` ${normalize(text)} `;
  const f: Features = {
    nogi: / no ?gi |sem kimono/.test(t),
    abs: / abs(oluto|olutos)? /.test(t),
    desafio: / desafio /.test(t),
    divisions: new Set(),
    belts: new Set(),
    anyAge: /todas as idades/.test(t),
  };
  for (const d of DIVISIONS) {
    // "infanto juvenil" não pode contar também como "juvenil" (idem pré-mirim).
    if (t.includes(` ${d} `)) {
      f.divisions.add(d);
      t = t.replace(` ${d} `, ' ');
    }
  }
  for (const b of BELTS) if (t.includes(` ${b} `)) f.belts.add(b);
  return f;
}

const sameKind = (a: Features, b: Features) => a.nogi === b.nogi && a.abs === b.abs && a.desafio === b.desafio;

function categoryPrefix(f: Features): string {
  return `${f.desafio ? 'Desafio Kids' : f.abs ? 'Abs' : 'Peso'} ${f.nogi ? 'NO-GI' : 'GI'}`;
}

/**
 * Linha do cronograma que corresponde à categoria. Só devolve se houver uma
 * única linha mais específica: na dúvida, nenhuma previsão.
 */
export function estimateStart(category: string, rows: ScheduleRow[]): ScheduleRow | undefined {
  const a = features(category);
  let best: ScheduleRow[] = [];
  let bestScore = 0;
  for (const row of rows) {
    const r = features(row.text);
    if (!r.divisions.size && !r.belts.size && !r.abs && !r.desafio && !r.nogi) continue; // "ABERTURA", "SUPER LUTA"
    if (!sameKind(a, r)) continue;
    if (r.divisions.size && !r.anyAge && ![...a.divisions].some((d) => r.divisions.has(d))) continue;
    if (r.belts.size && ![...a.belts].some((b) => r.belts.has(b))) continue;
    const score = (r.divisions.size ? 1 : 0) + (r.belts.size ? 1 : 0) + Number(r.abs) + Number(r.desafio) + Number(r.nogi);
    if (score > bestScore) [best, bestScore] = [[row], score];
    else if (score === bestScore) best.push(row);
  }
  return best.length === 1 ? best[0] : undefined;
}

interface ParsedCategory {
  features: Features;
  division: string;
  weight?: string;
  gender?: 'f' | 'm';
}

/** "Peso GI - Adulto - Azul - Leve - Feminino" ou "Adulto - Azul/Roxa - Masculino". */
function parseCategory(text: string): ParsedCategory {
  const parts = text.split(/\s+-\s+/).map(normalize).filter(Boolean);
  const genderAt = parts.findIndex((p) => /^(fem|mas)/.test(p));
  const gender = genderAt >= 0 ? (parts[genderAt]!.startsWith('fem') ? 'f' : 'm') : undefined;
  const beltAt = parts.findIndex((p) => p.split(' ').some((w) => BELTS.includes(w)));
  const weight = beltAt >= 0 && genderAt > beltAt + 1 ? parts[beltAt + 1] : undefined;
  const division = beltAt > 0 ? parts[beltAt - 1]! : '';
  return { features: features(text), division, weight, gender };
}

function categoryFits(athlete: ParsedCategory, bracket: ParsedCategory): boolean {
  if (athlete.gender && bracket.gender && athlete.gender !== bracket.gender) return false;
  if (athlete.division !== bracket.division) return false;
  if (athlete.weight && bracket.weight && athlete.weight !== bracket.weight) return false;
  return [...athlete.features.belts].some((b) => bracket.features.belts.has(b));
}
