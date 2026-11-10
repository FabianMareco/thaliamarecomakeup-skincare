import { addDaysStr, arDateStr } from "./time";
import type { Booking, Service, Slot } from "./types";

// Reglas de disponibilidad y de cancelación de skincare (secciones 3, 5 y 7).

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

/** Libre: `open`, o `held` con `heldUntil` no nulo y vencido (expiración perezosa). */
export function isSlotFree(slot: Pick<Slot, "status" | "heldUntil">, now: Date): boolean {
  if (slot.status === "open") return true;
  if (slot.status === "held") return slot.heldUntil !== null && slot.heldUntil.getTime() <= now.getTime();
  return false;
}

export function isCompatible(
  slot: Pick<Slot, "durationMin" | "modality">,
  service: Pick<Service, "durationMin" | "modality">,
): boolean {
  return slot.durationMin >= (service.durationMin ?? 0) && slot.modality === service.modality;
}

export function isWithinHorizon(date: string, now: Date, horizonDays: number): boolean {
  const today = arDateStr(now);
  return date >= today && date <= addDaysStr(today, horizonDays);
}

/** Un servicio se puede reservar en un horario si está libre, es compatible, no empezó y está dentro del horizonte. */
export function isBookable(
  slot: Slot,
  service: Pick<Service, "durationMin" | "modality">,
  now: Date,
  horizonDays: number,
): boolean {
  return (
    isSlotFree(slot, now) &&
    isCompatible(slot, service) &&
    slot.startAt.getTime() > now.getTime() &&
    isWithinHorizon(slot.date, now, horizonDays)
  );
}

/** "Mismo día" = la fecha del turno es hoy en hora argentina. */
export function isSameDay(slotDate: string, now: Date): boolean {
  return slotDate === arDateStr(now);
}

export function approvalDeadline(now: Date, startAt: Date, timeoutMinutes: number): Date {
  return new Date(Math.min(now.getTime() + timeoutMinutes * MIN, startAt.getTime() - 30 * MIN));
}

/** Faltan al menos `windowHours` para el inicio (medido en instantes absolutos). */
export function isOutsideCancellationWindow(startAt: Date, now: Date, windowHours: number): boolean {
  return startAt.getTime() - now.getTime() >= windowHours * HOUR;
}

/** Último instante en el que la clienta puede reprogramar o cancelar con reintegro. */
export function refundDeadline(startAt: Date, windowHours: number): Date {
  return new Date(startAt.getTime() - windowHours * HOUR);
}

export type ClientOptions = {
  canReschedule: boolean;
  canCancelWithRefund: boolean;
  canCancelForfeit: boolean;
  reschedulesLeft: number;
};

/** Qué puede hacer la clienta desde el link de gestión (sección 8.3). */
export function clientOptions(
  booking: Pick<Booking, "status" | "line" | "startAt" | "rescheduleCount">,
  now: Date,
  cfg: { cancellationWindowHours: number; maxSelfReschedules: number },
): ClientOptions {
  const none = { canReschedule: false, canCancelWithRefund: false, canCancelForfeit: false, reschedulesLeft: 0 };
  if (booking.status !== "confirmed" || booking.line !== "skincare" || !booking.startAt) return none;
  if (booking.startAt.getTime() <= now.getTime()) return none;
  const reschedulesLeft = Math.max(0, cfg.maxSelfReschedules - booking.rescheduleCount);
  if (isOutsideCancellationWindow(booking.startAt, now, cfg.cancellationWindowHours)) {
    return { canReschedule: reschedulesLeft > 0, canCancelWithRefund: true, canCancelForfeit: false, reschedulesLeft };
  }
  return { canReschedule: false, canCancelWithRefund: false, canCancelForfeit: true, reschedulesLeft };
}
