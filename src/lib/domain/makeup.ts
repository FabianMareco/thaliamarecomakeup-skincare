import { arLocalToInstant, minutesOf } from "./time";
import { overlaps } from "./slots";

// Ventanas de tiempo de un evento de maquillaje, para avisar superposiciones
// con la agenda de skincare (sección 4). Es solo un aviso: no bloquea.

/** Duración máxima orientativa de un servicio de maquillaje ("1 h 30 a 3 hs"). */
export const MAKEUP_MAX_MINUTES = 180;

export type Interval = { startAt: Date; endAt: Date };

/** Evento: desde la hora de inicio hasta la hora a la que tiene que estar lista. */
export function eventInterval(date: string, startTime: string, readyByTime: string): Interval {
  const startAt = arLocalToInstant(date, startTime);
  const minutes = minutesOf(readyByTime) > minutesOf(startTime) ? minutesOf(readyByTime) - minutesOf(startTime) : MAKEUP_MAX_MINUTES;
  return { startAt, endAt: new Date(startAt.getTime() + minutes * 60_000) };
}

export function trialInterval(date: string, time: string): Interval {
  const startAt = arLocalToInstant(date, time);
  return { startAt, endAt: new Date(startAt.getTime() + MAKEUP_MAX_MINUTES * 60_000) };
}

export function findOverlapping<T extends Interval>(window: Interval, items: T[]): T[] {
  return items.filter((i) => overlaps(window, i));
}
