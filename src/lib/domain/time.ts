import { TZDate, tz } from "@date-fns/tz";
import { addDays, format, getISODay } from "date-fns";
import { es } from "date-fns/locale";
import type { Weekday } from "./types";

// Zona horaria del negocio. Nunca se usa la del servidor.
export const AR_TZ = "America/Argentina/Buenos_Aires";
const inAR = { in: tz(AR_TZ) };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateStr(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTimeStr(s: string): boolean {
  return TIME_RE.test(s);
}

/** Instante correspondiente a una fecha y hora locales de Argentina. */
export function arLocalToInstant(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(+new TZDate(y, m - 1, d, hh, mm, AR_TZ));
}

/** "YYYY-MM-DD" del instante en hora argentina. */
export function arDateStr(at: Date): string {
  return format(at, "yyyy-MM-dd", inAR);
}

/** "HH:mm" del instante en hora argentina. */
export function arTimeStr(at: Date): string {
  return format(at, "HH:mm", inAR);
}

/** Suma días a una fecha "YYYY-MM-DD" (calendario, sin depender de la zona). */
export function addDaysStr(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = addDays(new Date(Date.UTC(y, m - 1, d, 12)), days);
  return dt.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split("-").map(Number);
  const iso = getISODay(new Date(Date.UTC(y, m - 1, d, 12)));
  return (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const)[iso - 1];
}

/** Lunes de la semana de la fecha dada. */
export function mondayOf(date: string): string {
  const idx = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(weekdayOf(date));
  return addDaysStr(date, -idx);
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysStr(d, 1)) out.push(d);
  return out;
}

export function minutesOf(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  return hh * 60 + mm;
}

// ---- Formatos para mostrar ----

export function fmtDateLong(at: Date): string {
  return format(at, "EEEE d 'de' MMMM", { ...inAR, locale: es });
}

export function fmtDateTimeLong(at: Date): string {
  return format(at, "EEEE d 'de' MMMM, HH:mm 'hs'", { ...inAR, locale: es });
}

export function fmtDateShort(at: Date): string {
  return format(at, "dd/MM/yyyy", inAR);
}

export function fmtDateTimeShort(at: Date): string {
  return format(at, "dd/MM HH:mm", inAR);
}

/** Formatea una fecha "YYYY-MM-DD" (sin hora) en castellano. */
export function fmtDateStrLong(date: string): string {
  return fmtDateLong(arLocalToInstant(date, "12:00"));
}
