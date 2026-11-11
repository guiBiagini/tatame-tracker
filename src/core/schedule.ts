import { daysUntil } from './dates';
import type { EventSnapshot, TrackedEvent } from './model';

/**
 * Frequência de atualização conforme a proximidade do evento. Chave e
 * cronograma costumam sair poucos dias antes, então consultamos pouco quando
 * o evento está longe e muito no dia das lutas.
 *
 * Retorna minutos entre consultas, ou null para parar (evento encerrado).
 */
export function refreshIntervalMinutes(
  date: string | undefined,
  hasLiveSchedule: boolean,
  now: Date = new Date(),
): number | null {
  if (!date) return 6 * 60;
  const days = daysUntil(date, now);
  if (days < -1) return null;
  if (days < 0) return 6 * 60; // dia seguinte: pega resultados finais
  if (days === 0) return hasLiveSchedule ? 5 : 60;
  if (days === 1) return 60;
  if (days <= 7) return 3 * 60;
  return 24 * 60;
}

/** Um evento está "vencido" quando passou o intervalo desde a última consulta. */
export function isDue(
  event: TrackedEvent,
  snapshot: EventSnapshot | undefined,
  hasLiveSchedule: boolean,
  now: Date = new Date(),
): boolean {
  if (!snapshot) return true;
  const interval = refreshIntervalMinutes(snapshot.date ?? event.date, hasLiveSchedule, now);
  if (interval === null) return false;
  const elapsed = (now.getTime() - new Date(snapshot.fetchedAt).getTime()) / 60_000;
  return elapsed >= interval;
}
