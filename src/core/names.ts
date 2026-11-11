/**
 * Comparação de nomes tolerante a acentos, caixa, partículas ("de", "da"...)
 * e abreviações ("Joao P. Silva" ~ "João Pedro da Silva").
 */

export const MATCH_THRESHOLD = 0.85;
export const POSSIBLE_THRESHOLD = 0.6;

const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'del']);

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(name: string): string[] {
  return normalize(name)
    .split(' ')
    .filter((t) => t && !PARTICLES.has(t));
}

function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true;
  // Inicial: "p" casa com "pedro".
  if (a.length === 1) return b.startsWith(a);
  if (b.length === 1) return a.startsWith(b);
  return false;
}

/**
 * Pontua o quanto `candidate` (nome no site) corresponde a `query` (nome cadastrado).
 * Primeiro e último nome pesam mais; nomes do meio podem faltar ou estar abreviados.
 */
export function nameScore(query: string, candidate: string): number {
  const q = tokens(query);
  const c = tokens(candidate);
  if (!q.length || !c.length) return 0;
  if (q.join(' ') === c.join(' ')) return 1;

  const firstOk = tokenMatches(q[0]!, c[0]!);
  const lastOk = tokenMatches(q[q.length - 1]!, c[c.length - 1]!);

  // Quantos tokens do nome menor aparecem (em ordem) no maior.
  const [short, long] = q.length <= c.length ? [q, c] : [c, q];
  let i = 0;
  let hits = 0;
  for (const t of short) {
    while (i < long.length && !tokenMatches(t, long[i]!)) i++;
    if (i < long.length) {
      hits++;
      i++;
    }
  }
  const coverage = hits / short.length;

  if (firstOk && lastOk) {
    // "João P. Silva" x "João Henrique Santos Silva": os dois lados têm nome
    // do meio e nenhum combina → outra pessoa com o mesmo nome e sobrenome.
    return middleConflict(q, c) ? 0.5 : 0.75 + 0.2 * coverage;
  }
  // Só o primeiro nome bate: é possível apenas se um dos nomes estiver
  // incompleto ("João Pedro" no site). Sobrenomes diferentes = outra pessoa.
  if (firstOk) return coverage === 1 ? 0.7 : 0.4 * coverage;
  if (lastOk) return 0.3 + 0.4 * coverage;
  return 0.4 * coverage;
}

function middleConflict(q: string[], c: string[]): boolean {
  const qMid = q.slice(1, -1);
  const cMid = c.slice(1, -1);
  const qExtra = qMid.filter((t) => !cMid.some((u) => tokenMatches(t, u)));
  const cExtra = cMid.filter((t) => !qMid.some((u) => tokenMatches(u, t)));
  return qExtra.length > 0 && cExtra.length > 0;
}

export function teamMatches(expected: string | undefined, actual: string | undefined): boolean {
  if (!expected || !actual) return false;
  const e = normalize(expected);
  const a = normalize(actual);
  return a.includes(e) || e.includes(a);
}

/** Melhor pontuação considerando nome, apelidos e equipe (bônus de desempate). */
export function athleteScore(
  athlete: { name: string; aliases: string[]; team?: string },
  competitor: { name: string; team?: string },
): number {
  const base = Math.max(
    nameScore(athlete.name, competitor.name),
    ...athlete.aliases.map((a) => nameScore(a, competitor.name)),
  );
  const bonus = teamMatches(athlete.team, competitor.team) ? 0.1 : 0;
  return Math.min(1, base + bonus);
}
