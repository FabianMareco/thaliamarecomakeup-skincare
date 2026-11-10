import { refundDeadline } from "@/lib/domain/availability";
import { bookingTotal, formatARS, serviceLabel } from "@/lib/domain/money";
import { waLink } from "@/lib/domain/phone";
import { fmtDateStrLong, fmtDateTimeLong } from "@/lib/domain/time";
import type { Booking, Tenant } from "@/lib/domain/types";
import { calendarLinks } from "../calendar";
import { manageUrl, paymentUrl } from "../links";
import type { ClientEvent } from "./messages";
import { whenText } from "./messages";

// Mensajes de WhatsApp que Thalia envía a mano desde su celular: el panel arma
// el texto completo, con todos los datos del turno, y abre WhatsApp con el
// mensaje listo para enviar. No requiere Meta ni tiene costo, y como no son
// plantillas de Meta pueden tener varias líneas y formato (*negrita*).
// Sin emojis: algunos se rompen al pasar por el link wa.me (se ven como "�").

export type ManualMessage = { event: ClientEvent; label: string; url: string; text: string };

const HOUR = 3600_000;
const PUNCTUALITY = "El estudio no tiene sala de espera y los turnos empiezan puntuales: te pido llegar a horario.";

const first = (b: Booking) => b.client.name.split(" ")[0] || b.client.name;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function place(b: Booking, tenant: Tenant, withAddress: boolean): string | null {
  if (b.line === "skincare") {
    if (b.modality === "virtual") return "Online (te paso el link por acá)";
    return withAddress && tenant.privateAddress ? tenant.privateAddress : tenant.publicZone;
  }
  if (b.makeup?.location === "home") return `A domicilio (${b.makeup.homeAddress ?? ""})`;
  return withAddress && tenant.privateAddress ? tenant.privateAddress : `Estudio, ${tenant.publicZone}`;
}

/** Bloque con todos los datos del turno. La dirección exacta solo va en reservas confirmadas. */
export function bookingDetails(b: Booking, tenant: Tenant): string {
  const confirmed = b.status === "confirmed";
  const lines: string[] = [`*Tratamiento:* ${serviceLabel(b)}`];
  if (b.line === "skincare") {
    if (b.startAt) lines.push(`*Día y hora:* ${capitalize(fmtDateTimeLong(b.startAt))}`);
    if (b.service.durationMin) lines.push(`*Duración aprox.:* ${b.service.durationMin} min`);
  } else if (b.makeup) {
    lines.push(`*Evento:* ${capitalize(fmtDateStrLong(b.makeup.eventDate))}`);
    if (b.makeup.startTime) lines.push(`*Inicio:* ${b.makeup.startTime} hs`);
    lines.push(`*Lista a las:* ${b.makeup.readyByTime} hs`);
    if (b.makeup.trialDate && b.makeup.trialTime) lines.push(`*Prueba:* ${capitalize(fmtDateStrLong(b.makeup.trialDate))}, ${b.makeup.trialTime} hs`);
    if (b.makeup.peopleCount > 1) lines.push(`*Personas:* ${b.makeup.peopleCount}`);
  }
  const where = place(b, tenant, confirmed);
  if (where) lines.push(`*Lugar:* ${where}`);

  const total = b.line === "skincare" ? bookingTotal(b) : (b.makeup?.finalPrice ?? 0);
  if (total > 0) lines.push(`*Precio${b.extras?.length || b.totalPrice !== undefined ? " (combo)" : ""}:* ${formatARS(total)}`);
  if (b.makeup?.travelFee) lines.push(`*Viático:* ${formatARS(b.makeup.travelFee)}`);
  if (b.deposit.amount > 0) {
    const status = b.deposit.status === "verified" ? "recibida" : b.status === "awaiting_verification" ? "en verificación" : "pendiente";
    lines.push(`*Seña:* ${formatARS(b.deposit.amount)} (${status})`);
    lines.push(`*Saldo ${b.line === "makeup" ? "el día del evento" : "en el turno"}:* ${b.balance.amount > 0 ? formatARS(b.balance.amount) : "nada, ya está todo pago"}`);
  }
  lines.push(`*Reserva:* ${b.code}`);
  return lines.join("\n");
}

function transferBlock(b: Booking, tenant: Tenant): string {
  const t = tenant.bankTransfer;
  return [
    `Para confirmarla, transferí la seña de *${formatARS(b.deposit.amount)}*:`,
    `Alias: *${t.alias}*`,
    `CVU: ${t.cvu}`,
    `Titular: ${t.holderName} (${t.provider})`,
  ].join("\n");
}

/** Texto completo del mensaje para cada aviso. */
export function manualText(
  event: ClientEvent,
  b: Booking,
  tenant: Tenant,
  opts: { offsetHours?: number; reason?: string } = {},
): string | null {
  const hi = `¡Hola ${first(b)}!`;
  const details = bookingDetails(b, tenant);
  const manage = `Ver o gestionar tu reserva: ${manageUrl(b.id)}`;
  const deadline = b.deposit.receiptUploadDeadline ? `\nTenés tiempo hasta el ${fmtDateTimeLong(b.deposit.receiptUploadDeadline)}.` : "";
  const join = (...parts: (string | false | undefined | null)[]) => parts.filter(Boolean).join("\n\n");

  switch (event) {
    case "same_day_received":
      return join(`${hi} Recibí tu solicitud para hoy:`, details, "Te confirmo en un rato por acá. Todavía no transfieras nada.");
    case "payment_link_created":
    case "payment_link_approved":
      return join(
        `${hi} ${event === "payment_link_approved" ? "Tengo lugar para tu turno." : "Te paso los datos de tu reserva:"}`,
        details,
        transferBlock(b, tenant),
        `Después subí el comprobante acá: ${paymentUrl(b.id)}${deadline}`,
      );
    case "resubmit_requested":
      return join(
        `${hi} Necesito que me vuelvas a mandar el comprobante de la seña.`,
        opts.reason ? `Motivo: ${opts.reason}` : null,
        details,
        `Subilo acá: ${paymentUrl(b.id)}${deadline}`,
      );
    case "confirmed": {
      const cal = calendarLinks(b, tenant);
      return join(
        `${hi} Tu reserva está *confirmada*.`,
        details,
        b.line === "skincare" ? PUNCTUALITY : "Recordá que la seña no se reintegra.",
        cal ? `Agendalo en Google Calendar: ${cal.googleShort}` : null,
        manage,
      );
    }
    case "reminder": {
      const window = tenant.skincare.cancellationWindowHours;
      const early = b.line === "skincare" && b.startAt && (opts.offsetHours ?? 0) > window;
      const cal = calendarLinks(b, tenant);
      return join(
        `${hi} Te recuerdo tu ${b.line === "makeup" ? "evento" : "turno"}:`,
        details,
        early && b.startAt
          ? `Tenés hasta el ${fmtDateTimeLong(refundDeadline(b.startAt, window))} para reprogramar o cancelar con reintegro.`
          : b.line === "skincare"
            ? PUNCTUALITY
            : null,
        cal ? `Agendalo en Google Calendar: ${cal.googleShort}` : null,
        manage,
      );
    }
    case "rejected":
      return join(
        `Hola ${first(b)}. Lamentablemente no puedo tomar tu reserva de ${serviceLabel(b)} para el ${whenText(b)}.`,
        opts.reason ? `Motivo: ${opts.reason}` : null,
        "Si querés, buscamos otro día por acá.",
      );
    case "expired":
      return join(
        `Hola ${first(b)}. Tu reserva de ${serviceLabel(b)} para el ${whenText(b)} venció porque no llegó el comprobante de la seña a tiempo, y el lugar se liberó.`,
        "Si querés, buscamos otro horario por acá.",
      );
    case "rescheduled":
      return join(`${hi} Tu turno quedó reprogramado:`, details, b.line === "skincare" ? PUNCTUALITY : null, manage);
    case "cancelled":
      return join(
        `Hola ${first(b)}. Tu reserva de ${serviceLabel(b)} para el ${whenText(b)} quedó cancelada.`,
        b.status === "cancelled_refunded"
          ? `Te reintegro la seña de ${formatARS(b.deposit.amount)}${b.deposit.refundDestination ? ` a ${b.deposit.refundDestination}` : ""} y te aviso cuando esté hecho.`
          : "La seña no se reintegra, según la política de cancelación.",
      );
    case "refunded":
      return join(`${hi} Ya te transferí el reintegro de la seña de ${formatARS(b.deposit.amount)}${b.deposit.refundDestination ? ` a ${b.deposit.refundDestination}` : ""}.`, "¡Gracias y espero verte pronto!");
    case "receipt_received":
    case "makeup_request_received":
      return null;
  }
}

/** Mensajes que tiene sentido mandar según el estado actual de la reserva. */
export function manualMessages(booking: Booking, tenant: Tenant, now = new Date()): ManualMessage[] {
  const out: ManualMessage[] = [];
  const add = (event: ClientEvent, label: string, opts: { offsetHours?: number; reason?: string } = {}) => {
    const text = manualText(event, booking, tenant, opts);
    if (text) out.push({ event, label, text, url: waLink(booking.client.phone, text) });
  };
  const b = booking;
  switch (b.status) {
    case "awaiting_approval":
      add("same_day_received", "Solicitud recibida");
      break;
    case "awaiting_payment": {
      const approved = b.line === "makeup" || b.history.some((h) => h.from === "awaiting_approval");
      if (b.deposit.resubmitReason) add("resubmit_requested", "Pedir reenviar comprobante", { reason: b.deposit.resubmitReason });
      add(approved ? "payment_link_approved" : "payment_link_created", "Link para pagar la seña");
      break;
    }
    case "confirmed": {
      add("confirmed", "Confirmación");
      if (b.startAt && b.startAt.getTime() > now.getTime()) {
        // Lejos del turno, el recordatorio menciona el plazo para cancelar con reintegro; cerca, la puntualidad.
        const hoursLeft = (b.startAt.getTime() - now.getTime()) / HOUR;
        const early = b.line === "skincare" && hoursLeft > tenant.skincare.cancellationWindowHours;
        add("reminder", "Recordatorio", { offsetHours: early ? tenant.skincare.cancellationWindowHours + 1 : 24 });
      }
      break;
    }
    case "rejected":
      add("rejected", "Aviso de rechazo", { reason: b.rejectionReason });
      break;
    case "expired":
      add("expired", "Aviso de vencimiento");
      break;
    case "cancelled_refunded":
    case "cancelled_forfeited":
      add("cancelled", "Aviso de cancelación");
      break;
  }
  if (b.deposit.status === "refunded") add("refunded", "Aviso de reintegro hecho");
  return out;
}
