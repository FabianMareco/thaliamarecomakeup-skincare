import { WHATSAPP_LANGUAGE, WHATSAPP_TEMPLATES } from "@/config/whatsapp-templates";
import type { Booking, Tenant } from "@/lib/domain/types";
import { cols } from "../db";
import { calendarLinks } from "../calendar";
import { manageUrl, panelBookingUrl, paymentUrl } from "../links";
import { loadTenant } from "../repo/tenant";
import {
  adminEmail,
  clientEmail,
  isAdminEvent,
  WHATSAPP_EVENTS,
  type ClientEvent,
  type MessageCtx,
  type NotifyEvent,
} from "./messages";
import { emailProvider, whatsappProvider, type EmailProvider, type SendResult, type WhatsAppProvider } from "./providers";

// Despacha cada evento a email y WhatsApp y registra el resultado en
// `notifications`. Un canal que falla no impide el otro.

/** Avisos a la paciente que llevan el turno como archivo de calendario. */
const CALENDAR_EVENTS: ClientEvent[] = ["confirmed", "rescheduled", "reminder"];

let overrides: { email?: EmailProvider; whatsapp?: WhatsAppProvider } = {};

/** Solo para tests. */
export function setNotifyProviders(p: { email?: EmailProvider; whatsapp?: WhatsAppProvider }) {
  overrides = p;
}

export type NotifyOptions = {
  offsetHours?: number;
  reason?: string;
  previousWhen?: string;
  tenant?: Tenant;
};

export type NotifyResult = { email?: SendResult; whatsapp?: SendResult; delivered: boolean };

export async function notify(event: NotifyEvent, booking: Booking, opts: NotifyOptions = {}): Promise<NotifyResult> {
  try {
    return await dispatch(event, booking, opts);
  } catch (e) {
    // Una notificación nunca debe romper el flujo que la disparó.
    console.error(`[notify] ${event} ${booking.id}`, e);
    return { delivered: false };
  }
}

export function buildMessageCtx(booking: Booking, tenant: Tenant, opts: Omit<NotifyOptions, "tenant"> = {}): MessageCtx {
  return {
    tenant,
    booking,
    links: {
      payment: paymentUrl(booking.id),
      manage: manageUrl(booking.id),
      panel: panelBookingUrl(booking.id),
      calendar: booking.status === "confirmed" ? calendarLinks(booking, tenant)?.google : undefined,
    },
    offsetHours: opts.offsetHours,
    reason: opts.reason,
    previousWhen: opts.previousWhen,
  };
}

async function dispatch(event: NotifyEvent, booking: Booking, opts: NotifyOptions): Promise<NotifyResult> {
  const tenant = opts.tenant ?? (await loadTenant());
  const ctx = buildMessageCtx(booking, tenant, opts);
  const email = overrides.email ?? emailProvider();
  const whatsapp = overrides.whatsapp ?? whatsappProvider();

  const tasks: Promise<[channel: "email" | "whatsapp", to: string, result: SendResult]>[] = [];

  if (isAdminEvent(event)) {
    const to = tenant.notificationEmail;
    if (to) {
      const content = adminEmail(event, ctx);
      tasks.push(email.send({ to, ...content }).then((r) => ["email", to, r]));
    }
  } else {
    // Las reservas cargadas por Thalia pueden no tener email: en ese caso solo va por WhatsApp.
    if (booking.client.email) {
      const content = clientEmail(event, ctx);
      const ics = CALENDAR_EVENTS.includes(event as ClientEvent) && booking.status === "confirmed" ? calendarLinks(booking, tenant)?.icsContent : undefined;
      const attachments = ics ? [{ filename: `turno-${booking.code}.ics`, content: ics, contentType: "text/calendar; charset=utf-8; method=PUBLISH" }] : undefined;
      tasks.push(email.send({ to: booking.client.email, ...content, attachments }).then((r) => ["email", booking.client.email, r]));
    }
    const tpl = WHATSAPP_TEMPLATES[event as ClientEvent];
    if (tpl && WHATSAPP_EVENTS.includes(event as ClientEvent)) {
      tasks.push(
        whatsapp
          .sendTemplate({ to: booking.client.phone, template: tpl.name, language: WHATSAPP_LANGUAGE, params: tpl.params(ctx) })
          .then((r) => ["whatsapp", booking.client.phone, r]),
      );
    }
  }

  const settled = await Promise.allSettled(tasks);
  const result: NotifyResult = { delivered: false };
  const log = cols.notifications();
  const at = new Date();
  for (const s of settled) {
    const [channel, to, r]: [string, string, SendResult] =
      s.status === "fulfilled" ? s.value : ["unknown", "", { status: "failed", error: String(s.reason) }];
    if (channel === "email" || channel === "whatsapp") result[channel] = r;
    if (r.status !== "failed") result.delivered = true;
    await log.add({
      event,
      bookingId: booking.id,
      bookingCode: booking.code,
      channel,
      to,
      status: r.status,
      ...(r.id ? { providerId: r.id } : {}),
      ...(r.error ? { error: r.error } : {}),
      ...(opts.offsetHours !== undefined ? { offsetHours: opts.offsetHours } : {}),
      at,
    });
  }
  if (tasks.length === 0) result.delivered = true;
  return result;
}
