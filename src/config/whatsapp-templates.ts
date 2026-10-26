import { refundDeadline } from "@/lib/domain/availability";
import { formatARS } from "@/lib/domain/money";
import { fmtDateTimeLong } from "@/lib/domain/time";
import type { ClientEvent, MessageCtx } from "@/server/notify/messages";
import { whenText } from "@/server/notify/messages";

// Plantillas de WhatsApp (Cloud API). Tienen que estar aprobadas por Meta con
// estos nombres, categoría Utility e idioma es_AR. El orden de `params`
// corresponde a las variables {{1}}, {{2}}, ... del cuerpo de cada plantilla.

export const WHATSAPP_LANGUAGE = "es_AR";

type TemplateDef = {
  name: string;
  /** Texto de referencia para dar de alta la plantilla en Meta. */
  body: string;
  params: (ctx: MessageCtx) => string[];
};

const first = (ctx: MessageCtx) => ctx.booking.client.name.split(" ")[0] || ctx.booking.client.name;

export const WHATSAPP_TEMPLATES: Partial<Record<ClientEvent, TemplateDef>> = {
  payment_link_created: {
    name: "turno_link_pago",
    body: "Hola {{1}}! Reservaste {{2}} para el {{3}}. Para confirmar, transferí la seña de {{4}} y subí el comprobante acá: {{5}}",
    params: (c) => [first(c), c.booking.service.name, whenText(c.booking), formatARS(c.booking.deposit.amount), c.links.payment],
  },
  same_day_received: {
    name: "turno_mismo_dia_recibido",
    body: "Hola {{1}}! Recibimos tu solicitud de {{2}} para hoy, {{3}}. Está pendiente de confirmación: no transfieras nada todavía. Te avisamos por acá.",
    params: (c) => [first(c), c.booking.service.name, whenText(c.booking)],
  },
  payment_link_approved: {
    name: "turno_aprobado_link_pago",
    body: "Hola {{1}}! Thalia confirmó {{2}} para el {{3}}. Para reservar, transferí la seña de {{4}} y subí el comprobante acá: {{5}}",
    params: (c) => [first(c), c.booking.service.name, whenText(c.booking), formatARS(c.booking.deposit.amount), c.links.payment],
  },
  resubmit_requested: {
    name: "turno_reenviar_comprobante",
    body: "Hola {{1}}! Necesitamos que vuelvas a enviar el comprobante de la seña. Motivo: {{2}}. Subilo acá: {{3}}",
    params: (c) => [first(c), c.reason || "-", c.links.payment],
  },
  confirmed: {
    name: "turno_confirmado",
    body: "Listo {{1}}! Tu reserva de {{2}} para el {{3}} está confirmada. {{4}} Saldo: {{5}}. Ver o gestionar tu reserva: {{6}}",
    params: (c) => [
      first(c),
      c.booking.service.name,
      whenText(c.booking),
      c.booking.line === "skincare" && c.booking.modality === "virtual"
        ? "Modalidad virtual."
        : `Dirección: ${c.tenant.privateAddress || c.tenant.publicZone}.`,
      formatARS(c.booking.balance.amount),
      c.links.manage,
    ],
  },
  rejected: {
    name: "turno_rechazado",
    body: "Hola {{1}}. Lamentablemente tu reserva de {{2}} para el {{3}} no pudo confirmarse. {{4}}",
    params: (c) => [first(c), c.booking.service.name, whenText(c.booking), c.reason ? `Motivo: ${c.reason}` : "Escribinos si querés buscar otra opción."],
  },
  expired: {
    name: "turno_vencido",
    body: "Hola {{1}}. Tu reserva de {{2}} para el {{3}} venció y el lugar se liberó. Podés volver a reservar cuando quieras.",
    params: (c) => [first(c), c.booking.service.name, whenText(c.booking)],
  },
  reminder: {
    name: "turno_recordatorio",
    body: "Hola {{1}}! Te recordamos {{2}}: {{3}}. {{4}} Ver tu reserva: {{5}}",
    params: (c) => {
      const b = c.booking;
      const window = c.tenant.skincare.cancellationWindowHours;
      const detail =
        b.line === "skincare" && b.startAt && (c.offsetHours ?? 0) > window
          ? `Tenés hasta el ${fmtDateTimeLong(refundDeadline(b.startAt, window))} para reprogramar o cancelar con reintegro.`
          : `${b.modality === "virtual" ? "Modalidad virtual." : `Dirección: ${b.makeup?.location === "home" ? b.makeup.homeAddress : c.tenant.privateAddress || c.tenant.publicZone}.`} Saldo: ${formatARS(b.balance.amount)}.${b.line === "skincare" ? " Los turnos empiezan puntuales." : ""}`;
      return [first(c), b.service.name, whenText(b), detail, c.links.manage];
    },
  },
  rescheduled: {
    name: "turno_reprogramado",
    body: "Listo {{1}}! Tu turno de {{2}} quedó para el {{3}}. Ver tu reserva: {{4}}",
    params: (c) => [first(c), c.booking.service.name, whenText(c.booking), c.links.manage],
  },
  cancelled: {
    name: "turno_cancelado",
    body: "Hola {{1}}. Tu reserva de {{2}} para el {{3}} quedó cancelada. {{4}}",
    params: (c) => [
      first(c),
      c.booking.service.name,
      whenText(c.booking),
      c.booking.status === "cancelled_refunded" ? "Te avisamos cuando hagamos el reintegro de la seña." : "La seña no se reintegra.",
    ],
  },
  refunded: {
    name: "turno_reintegro_realizado",
    body: "Hola {{1}}! Te transferimos el reintegro de la seña de {{2}}. ¡Gracias!",
    params: (c) => [first(c), formatARS(c.booking.deposit.amount)],
  },
};
