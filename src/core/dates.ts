const PT_MONTHS = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** "22 de Novembro de 2026" → "2026-11-22" */
export function parsePtDate(text: string): string | undefined {
  const m = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .match(/(\d{1,2})\s+de\s+([a-zA-Z]+)\s+de\s+(\d{4})/i);
  if (!m) return undefined;
  const month = PT_MONTHS.indexOf(m[2]!.toLowerCase());
  if (month < 0) return undefined;
  return `${m[3]}-${pad(month + 1)}-${pad(Number(m[1]))}`;
}

const EN_MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Primeira data em inglês do texto: "November 21st - 22nd, 2026" → "2026-11-21". */
export function parseEnDate(text: string): string | undefined {
  const m = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–]\s*(?:[A-Za-z]+\s+)?\d{1,2}(?:st|nd|rd|th)?)?,?\s+(\d{4})\b/i,
  );
  if (!m) return undefined;
  const month = EN_MONTHS.indexOf(m[1]!.toLowerCase()) + 1;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
}

/** Epoch em ms → "YYYY-MM-DD" no fuso informado. */
export function epochToDate(ms: number, timeZone = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(ms));
}

/** Epoch em ms → "YYYY-MM-DDTHH:mm" (hora local do evento, sem fuso). */
export function epochToLocal(ms: number, timeZone = 'America/Sao_Paulo'): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * "Fri 11/06 at 16:58" ou "Fri 11/06 at 04:58 PM" → "2026-11-06T16:58".
 * A plataforma não informa o ano: usa o ano de `reference` (data do evento ou hoje).
 */
export function parseIbjjfWhen(text: string, reference: Date = new Date()): string | undefined {
  const m = text.match(/(\d{1,2})\/(\d{1,2})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return undefined;
  let hour = Number(m[3]);
  const ampm = m[5]?.toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${reference.getFullYear()}-${pad(Number(m[1]))}-${pad(Number(m[2]))}T${pad(hour)}:${m[4]}`;
}

/** Dias inteiros entre hoje e a data do evento (negativo = já passou). */
export function daysUntil(date: string, now: Date = new Date()): number {
  const [y, mo, d] = date.split('-').map(Number);
  const event = Date.UTC(y!, mo! - 1, d!);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((event - today) / 86_400_000);
}
