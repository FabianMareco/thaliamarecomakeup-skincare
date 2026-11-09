import { googleCalendarUrl, icsContent, type CalendarEvent } from "@/lib/domain/calendar";
import { eventInterval } from "@/lib/domain/makeup";
import { formatARS, serviceLabel } from "@/lib/domain/money";
import type { Booking, Tenant } from "@/lib/domain/types";
import { manageTokenFor, manageUrl } from "./links";
import { env } from "./env";

// Evento de calendario para una reserva confirmada (skincare o maquillaje).

export function calendarEventFor(b: Booking, tenant: Tenant): CalendarEvent | null {
  if (!b.startAt) return null;
  let end: Date;
  if (b.line === "makeup" && b.makeup?.startTime) {
    end = eventInterval(b.makeup.eventDate, b.makeup.startTime, b.makeup.readyByTime).endAt;
  } else {
    end = new Date(b.startAt.getTime() + (b.service.durationMin ?? 60) * 60_000);
  }
  const location =
    b.line === "skincare"
      ? b.modality === "virtual"
        ? "Online"
        : tenant.privateAddress || tenant.publicZone
      : b.makeup?.location === "home"
        ? b.makeup.homeAddress
        : tenant.privateAddress || tenant.publicZone;
  const details = [
    `${serviceLabel(b)} con ${tenant.name}.`,
    `Reserva ${b.code}.`,
    b.balance.amount > 0 ? `Saldo a abonar: ${formatARS(b.balance.amount)}.` : "",
    b.line === "skincare" ? "El estudio no tiene sala de espera y los turnos empiezan puntuales." : "",
    `Ver o gestionar tu reserva: ${manageUrl(b.id)}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    uid: `${b.id}@turnos.thaliamareco`,
    title: `${serviceLabel(b)} · ${tenant.name}`,
    start: b.startAt,
    end,
    details,
    location: location || undefined,
  };
}

export function calendarLinks(b: Booking, tenant: Tenant) {
  const ev = calendarEventFor(b, tenant);
  if (!ev) return null;
  return {
    google: googleCalendarUrl(ev),
    /** Link corto que redirige a Google Calendar (para WhatsApp). */
    googleShort: `${env.baseUrl}/turnos/gestionar/${manageTokenFor(b.id)}/google-calendar`,
    ics: `${env.baseUrl}/turnos/gestionar/${manageTokenFor(b.id)}/calendario.ics`,
    icsContent: icsContent(ev),
  };
}
