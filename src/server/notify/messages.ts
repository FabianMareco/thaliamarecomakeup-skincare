import { refundDeadline } from "@/lib/domain/availability";
import { formatARS } from "@/lib/domain/money";
import { waLink } from "@/lib/domain/phone";
import { fmtDateStrLong, fmtDateTimeLong } from "@/lib/domain/time";
import type { Booking, Tenant } from "@/lib/domain/types";

// Contenido de cada notificación (sección 11). Funciones puras: reciben la
// reserva y la configuración y devuelven el email y/o los parámetros de la
// plantilla de WhatsApp.

export type ClientEvent =
  | "payment_link_created"
  | "same_day_received"
  | "payment_link_approved"
  | "receipt_received"
  | "resubmit_requested"
  | "confirmed"
  | "rejected"
  | "expired"
  | "reminder"
  | "rescheduled"
  | "cancelled"
  | "refunded"
  | "makeup_request_received";

export type AdminEvent =
  | "admin_receipt_submitted"
  | "admin_receipt_stale"
  | "admin_same_day_request"
  | "admin_makeup_request"
  | "admin_cancelled"
  | "admin_rescheduled"
  | "admin_refund_pending"
  | "admin_makeup_expired";

export type NotifyEvent = ClientEvent | AdminEvent;

export function isAdminEvent(e: NotifyEvent): e is AdminEvent {
  return e.startsWith("admin_");
}

/** Eventos que también van por WhatsApp a la clienta (tabla 11.1). */
export const WHATSAPP_EVENTS: ClientEvent[] = [
  "payment_link_created",
  "same_day_received",
  "payment_link_approved",
  "resubmit_requested",
  "confirmed",
  "rejected",
  "expired",
  "reminder",
  "rescheduled",
  "cancelled",
  "refunded",
];

export type MessageCtx = {
  tenant: Tenant;
  booking: Booking;
  links: { payment: string; manage: string; panel: string };
  offsetHours?: number;
  reason?: string;
  previousWhen?: string;
};

export type EmailContent = { subject: string; html: string; text: string };

const PUNCTUALITY =
  "El estudio no tiene sala de espera y los turnos empiezan puntuales. Te pedimos llegar a horario.";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Fecha y hora del turno o evento en texto. */
export function whenText(b: Booking): string {
  if (b.startAt) return fmtDateTimeLong(b.startAt);
  if (b.makeup) return `${fmtDateStrLong(b.makeup.eventDate)} (lista a las ${b.makeup.readyByTime} hs)`;
  return "";
}

function locationText(ctx: MessageCtx): string {
  const { booking: b, tenant } = ctx;
  if (b.line === "skincare") {
    if (b.modality === "virtual") return "Modalidad: virtual (online).";
    return `Dirección: ${tenant.privateAddress || tenant.publicZone}`;
  }
  if (b.makeup?.location === "home") return `Lugar: a domicilio (${b.makeup.homeAddress ?? ""}).`;
  return `Dirección del estudio: ${tenant.privateAddress || tenant.publicZone}`;
}

function balanceText(b: Booking): string {
  const travel = b.makeup?.travelFee ? ` (incluye viático de ${formatARS(b.makeup.travelFee)})` : "";
  if (b.balance.amount <= 0) return "No queda saldo por abonar.";
  const where = b.line === "makeup" ? "el día del evento" : "en el turno";
  return `Saldo a abonar ${where}: ${formatARS(b.balance.amount)}${travel}.`;
}

function layout(ctx: MessageCtx, title: string, paragraphs: string[], cta?: { label: string; url: string }): string {
  const wa = waLink(ctx.tenant.whatsappNumber);
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f7f2ef;font-family:Helvetica,Arial,sans-serif;color:#3b2f2f">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#9a7b6f;margin:0 0 16px">${esc(ctx.tenant.name)}</p>
<div style="background:#fff;border-radius:16px;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${p}</p>`).join("\n")}
${cta ? `<p style="margin:20px 0 8px"><a href="${esc(cta.url)}" style="display:inline-block;background:#8a5a4a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:15px">${esc(cta.label)}</a></p>` : ""}
</div>
<p style="font-size:13px;color:#7a6a64;margin:16px 0 0">¿Dudas? Escribinos por <a href="${esc(wa)}" style="color:#8a5a4a">WhatsApp</a>. Código de reserva: <strong>${esc(ctx.booking.code)}</strong>.</p>
</div></body></html>`;
}

function toText(title: string, paragraphs: string[], cta?: { label: string; url: string }): string {
  const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return [title, "", ...paragraphs.map(strip), ...(cta ? ["", `${cta.label}: ${cta.url}`] : [])].join("\n");
}

function email(ctx: MessageCtx, subject: string, title: string, paragraphs: string[], cta?: { label: string; url: string }): EmailContent {
  return { subject, html: layout(ctx, title, paragraphs, cta), text: toText(title, paragraphs, cta) };
}

export function clientEmail(event: ClientEvent, ctx: MessageCtx): EmailContent {
  const { booking: b, tenant, links } = ctx;
  const name = esc(b.client.name.split(" ")[0] || b.client.name);
  const svc = esc(b.service.name);
  const when = esc(whenText(b));
  const amount = formatARS(b.deposit.amount);
  const deadline = b.deposit.receiptUploadDeadline ? fmtDateTimeLong(b.deposit.receiptUploadDeadline) : "";
  const reason = ctx.reason ? esc(ctx.reason) : "";

  switch (event) {
    case "payment_link_created":
    case "payment_link_approved":
      return email(ctx, `Reservá tu lugar: transferí la seña (${b.code})`, `¡Hola ${name}! Falta un paso`, [
        event === "payment_link_approved"
          ? b.line === "makeup"
            ? `Thalia confirmó que puede tomar tu fecha para <strong>${svc}</strong> el ${when}.`
            : `Thalia aprobó tu solicitud de <strong>${svc}</strong> para el ${when}.`
          : `Reservaste <strong>${svc}</strong> para el ${when}.`,
        `Para confirmar, transferí la seña de <strong>${amount}</strong> y subí el comprobante desde el link.`,
        deadline ? `Tenés tiempo hasta el <strong>${esc(deadline)}</strong>. Si no recibimos el comprobante a tiempo, ${b.line === "makeup" ? "la fecha se libera" : "el horario se libera"}.` : "",
      ].filter(Boolean), { label: "Ver datos y subir comprobante", url: links.payment });

    case "same_day_received":
      return email(ctx, `Tu solicitud está pendiente de confirmación (${b.code})`, `¡Hola ${name}!`, [
        `Recibimos tu solicitud de <strong>${svc}</strong> para hoy, ${when}.`,
        "Tu solicitud está pendiente de confirmación. Como es para hoy, Thalia tiene que aprobarla. Cuando la apruebe te llega por acá y por WhatsApp el link para transferir la seña. No transfieras nada todavía.",
      ], { label: "Ver estado", url: links.payment });

    case "receipt_received":
      return email(ctx, `Recibimos tu comprobante (${b.code})`, `¡Gracias, ${name}!`, [
        `Recibimos tu comprobante de la seña para <strong>${svc}</strong> (${when}).`,
        "Thalia lo va a verificar y te llega la confirmación por email y WhatsApp.",
      ]);

    case "resubmit_requested":
      return email(ctx, `Necesitamos que vuelvas a enviar el comprobante (${b.code})`, `Hola ${name}`, [
        `Thalia revisó tu comprobante para <strong>${svc}</strong> y necesita que lo vuelvas a enviar.`,
        reason ? `Motivo: <em>${reason}</em>` : "",
        deadline ? `Podés subirlo hasta el <strong>${esc(deadline)}</strong>.` : "",
      ].filter(Boolean), { label: "Subir comprobante", url: links.payment });

    case "confirmed":
      return email(ctx, `¡Reserva confirmada! ${b.code}`, `¡Listo, ${name}! Tu reserva está confirmada`, [
        `<strong>${svc}</strong><br>${when}${b.makeup?.startTime ? `<br>Inicio: ${esc(b.makeup.startTime)} hs` : ""}`,
        ...(b.makeup?.trialDate && b.makeup.trialTime ? [`Prueba: ${esc(fmtDateStrLong(b.makeup.trialDate))}, ${esc(b.makeup.trialTime)} hs`] : []),
        esc(locationText(ctx)),
        `Seña recibida: ${amount}. ${esc(balanceText(b))}`,
        ...(b.line === "skincare" ? [PUNCTUALITY] : []),
        b.line === "skincare"
          ? `Desde el link podés ver tu reserva, reprogramar o cancelar con ${tenant.skincare.cancellationWindowHours} hs o más de anticipación.`
          : "Desde el link podés ver tu reserva. Recordá que la seña no se reintegra.",
      ], { label: "Ver mi reserva", url: links.manage });

    case "rejected":
      return email(ctx, `Tu ${b.line === "makeup" ? "solicitud" : "reserva"} no pudo confirmarse (${b.code})`, `Hola ${name}`, [
        b.line === "makeup"
          ? `Lamentablemente Thalia no puede tomar tu solicitud de <strong>${svc}</strong> para el ${when}.`
          : `Lamentablemente tu reserva de <strong>${svc}</strong> para el ${when} no pudo confirmarse.`,
        reason ? `Motivo: <em>${reason}</em>` : "",
        "Si querés, escribinos por WhatsApp y buscamos otra opción.",
      ].filter(Boolean));

    case "expired":
      return email(ctx, `Tu reserva venció (${b.code})`, `Hola ${name}`, [
        b.status === "expired" && b.history.at(-1)?.from === "awaiting_approval"
          ? `Tu solicitud de <strong>${svc}</strong> para hoy no pudo confirmarse a tiempo y quedó sin efecto.`
          : `No recibimos el comprobante de la seña a tiempo, así que ${b.line === "makeup" ? "la fecha" : "el horario"} de <strong>${svc}</strong> (${when}) se liberó.`,
        "Si querés, podés volver a reservar o escribirnos por WhatsApp.",
      ]);

    case "reminder": {
      const offset = ctx.offsetHours ?? 24;
      const window = tenant.skincare.cancellationWindowHours;
      if (b.line === "skincare" && b.startAt && offset > window) {
        const until = fmtDateTimeLong(refundDeadline(b.startAt, window));
        return email(ctx, `Recordatorio: tu turno del ${whenText(b)}`, `¡Hola ${name}!`, [
          `Te recordamos tu turno de <strong>${svc}</strong> el ${when}.`,
          `Tenés hasta el <strong>${esc(until)}</strong> para reprogramar o cancelar con reintegro.`,
        ], { label: "Ver mi reserva", url: links.manage });
      }
      return email(ctx, `Recordatorio: ${b.line === "makeup" ? "tu evento" : "tu turno"} es pronto`, `¡Hola ${name}!`, [
        `Te recordamos <strong>${svc}</strong>: ${when}${b.makeup?.startTime ? `, inicio ${esc(b.makeup.startTime)} hs` : ""}.`,
        esc(locationText(ctx)),
        esc(balanceText(b)),
        ...(b.line === "skincare" ? [PUNCTUALITY] : []),
      ], { label: "Ver mi reserva", url: links.manage });
    }

    case "rescheduled":
      return email(ctx, `Reprogramaste tu turno (${b.code})`, `¡Listo, ${name}!`, [
        `Tu turno de <strong>${svc}</strong> quedó para el <strong>${when}</strong>.`,
        ctx.previousWhen ? `Antes era el ${esc(ctx.previousWhen)}.` : "",
        esc(locationText(ctx)),
        PUNCTUALITY,
      ].filter(Boolean), { label: "Ver mi reserva", url: links.manage });

    case "cancelled":
      return email(ctx, `Cancelaste tu reserva (${b.code})`, `Hola ${name}`, [
        `Tu reserva de <strong>${svc}</strong> (${when}) quedó cancelada.`,
        b.status === "cancelled_refunded"
          ? `Vamos a reintegrarte la seña de ${amount}${b.deposit.refundDestination ? ` a <strong>${esc(b.deposit.refundDestination)}</strong>` : ""}. Te avisamos cuando esté hecho.`
          : "La seña no se reintegra, según la política de cancelación.",
      ]);

    case "refunded":
      return email(ctx, `Te reintegramos la seña (${b.code})`, `Hola ${name}`, [
        `Te transferimos el reintegro de la seña de <strong>${amount}</strong>${b.deposit.refundDestination ? ` a ${esc(b.deposit.refundDestination)}` : ""}.`,
        "¡Gracias y esperamos verte pronto!",
      ]);

    case "makeup_request_received":
      return email(ctx, `Recibimos tu solicitud (${b.code})`, `¡Hola ${name}! Recibimos tu solicitud`, [
        `<strong>${svc}</strong> para el ${when}.`,
        "Thalia la va a revisar y, si tiene la fecha disponible, te manda por email y WhatsApp el precio final y el link para abonar la seña.",
      ]);
  }
}

export function adminEmail(event: AdminEvent, ctx: MessageCtx): EmailContent {
  const { booking: b, links } = ctx;
  const who = `${esc(b.client.name)} (${esc(b.client.phone)})`;
  const svc = esc(b.service.name);
  const when = esc(whenText(b));
  const cta = { label: "Abrir en el panel", url: links.panel };
  const urgent = "🔴 URGENTE · ";
  switch (event) {
    case "admin_receipt_submitted":
      return email(ctx, `${urgent}Comprobante para verificar ${b.code}`, "Nuevo comprobante para verificar", [
        `${who} subió el comprobante de la seña de <strong>${formatARS(b.deposit.amount)}</strong>.`,
        `${svc} · ${when}`,
        "Antes de aprobar, verificá en tu app de Mercado Pago que el dinero haya ingresado. Un comprobante puede ser falso.",
      ], cta);
    case "admin_receipt_stale":
      return email(ctx, `Comprobante sin verificar ${b.code}`, "Hay un comprobante esperando verificación", [
        `El comprobante de ${who} lleva más de ${ctx.tenant.verificationReminderMinutes} minutos sin revisar.`,
        `${svc} · ${when}`,
      ], cta);
    case "admin_same_day_request":
      return email(ctx, `${urgent}Solicitud para hoy ${b.code}`, "Solicitud de turno para hoy", [
        `${who} quiere <strong>${svc}</strong> hoy, ${when}.`,
        b.approvalDeadline ? `Si no respondés antes de las ${esc(fmtDateTimeLong(b.approvalDeadline))}, vence sola.` : "",
      ].filter(Boolean), cta);
    case "admin_makeup_request":
      return email(ctx, `Nueva solicitud de maquillaje ${b.code}`, "Nueva solicitud de maquillaje", [
        `${who} pide <strong>${svc}</strong> para el ${when}.`,
        b.makeup ? `Lugar: ${b.makeup.location === "home" ? `a domicilio (${esc(b.makeup.homeAddress ?? "")})` : "estudio"} · Personas: ${b.makeup.peopleCount}` : "",
        b.makeup?.comments ? `Comentarios: <em>${esc(b.makeup.comments)}</em>` : "",
      ].filter(Boolean), cta);
    case "admin_cancelled":
      return email(ctx, `Cancelación ${b.code}`, "Una clienta canceló", [
        `${who} canceló <strong>${svc}</strong> (${when}).`,
        b.status === "cancelled_refunded" ? "Pidió reintegro de la seña." : "La seña queda retenida.",
      ], cta);
    case "admin_rescheduled":
      return email(ctx, `Reprogramación ${b.code}`, "Una clienta reprogramó", [
        `${who} reprogramó <strong>${svc}</strong>${ctx.previousWhen ? ` del ${esc(ctx.previousWhen)}` : ""} al <strong>${when}</strong>.`,
      ], cta);
    case "admin_refund_pending":
      return email(ctx, `Reintegro pendiente ${b.code}`, "Reintegro pendiente", [
        `Tenés que transferir <strong>${formatARS(b.deposit.amount)}</strong> a ${who}.`,
        b.deposit.refundDestination ? `Alias/CBU: <strong>${esc(b.deposit.refundDestination)}</strong>` : "",
        "Cuando lo transfieras, marcalo como reintegrado en el panel.",
      ].filter(Boolean), cta);
    case "admin_makeup_expired":
      return email(ctx, `Solicitud de maquillaje vencida ${b.code}`, "Venció una solicitud de maquillaje", [
        `${who} no subió el comprobante de la seña a tiempo para <strong>${svc}</strong> (${when}).`,
      ], cta);
  }
}
