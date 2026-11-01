import type { Booking } from "./types";

const HOUR = 60 * 60 * 1000;

/**
 * Offsets (en horas) de recordatorios que corresponde enviar ahora.
 * Solo si la reserva sigue confirmada, no se envió ese offset, al crearse
 * faltaba más que el offset, ya entramos en la ventana y el turno no empezó.
 */
export function dueReminderOffsets(
  booking: Pick<Booking, "status" | "startAt" | "createdAt" | "remindersSent">,
  offsetsHours: number[],
  now: Date,
): number[] {
  if (booking.status !== "confirmed" || !booking.startAt) return [];
  const start = booking.startAt.getTime();
  if (now.getTime() >= start) return [];
  const due = offsetsHours.filter((h) => {
    if (booking.remindersSent[String(h)]) return false;
    const sendAt = start - h * HOUR;
    return booking.createdAt.getTime() < sendAt && now.getTime() >= sendAt;
  });
  // Si se saltearon ejecuciones y hay varios vencidos, alcanza con el más cercano al turno.
  if (due.length <= 1) return due;
  const closest = Math.min(...due);
  return [closest];
}

/** Offsets que quedan "consumidos" al enviar `sent` (el enviado y los mayores, que ya no tienen sentido). */
export function offsetsToMarkSent(sent: number, offsetsHours: number[]): number[] {
  return offsetsHours.filter((h) => h >= sent);
}
