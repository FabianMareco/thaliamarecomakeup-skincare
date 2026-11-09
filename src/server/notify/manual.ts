import { WHATSAPP_TEMPLATES } from "@/config/whatsapp-templates";
import { waLink } from "@/lib/domain/phone";
import type { Booking, Tenant } from "@/lib/domain/types";
import type { ClientEvent } from "./messages";
import { buildMessageCtx } from "./notify";

// Mensajes de WhatsApp que Thalia envía a mano desde su celular: el panel
// arma el texto (el mismo de las plantillas automáticas) y abre WhatsApp con
// el mensaje listo para enviar. No requiere Meta ni tiene costo.

export type ManualMessage = { event: ClientEvent; label: string; url: string };

const HOUR = 3600_000;

/** Texto final de una plantilla, con sus variables completas. */
export function templateText(event: ClientEvent, booking: Booking, tenant: Tenant, opts: { offsetHours?: number; reason?: string } = {}): string | null {
  const tpl = WHATSAPP_TEMPLATES[event];
  if (!tpl) return null;
  const params = tpl.params(buildMessageCtx(booking, tenant, opts));
  return tpl.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => params[Number(n) - 1] ?? "");
}

/** Mensajes que tiene sentido mandar según el estado actual de la reserva. */
export function manualMessages(booking: Booking, tenant: Tenant, now = new Date()): ManualMessage[] {
  const out: ManualMessage[] = [];
  const add = (event: ClientEvent, label: string, opts: { offsetHours?: number; reason?: string } = {}) => {
    const text = templateText(event, booking, tenant, opts);
    if (text) out.push({ event, label, url: waLink(booking.client.phone, text) });
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
        // Lejos del turno, el recordatorio menciona el plazo para cancelar con reintegro; cerca, la dirección y el saldo.
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
