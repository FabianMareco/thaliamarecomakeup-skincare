import { makeupDeposit } from "@/lib/domain/money";
import { eventInterval, findOverlapping, trialInterval, type Interval } from "@/lib/domain/makeup";
import { normalizePhone } from "@/lib/domain/phone";
import { arDateStr, arLocalToInstant, arTimeStr } from "@/lib/domain/time";
import { ACTIVE_STATUSES, transition } from "@/lib/domain/transitions";
import type { Booking } from "@/lib/domain/types";
import { acceptMakeupSchema, firstError, makeupRequestSchema, type AcceptMakeupInput, type MakeupRequestInput } from "@/lib/schemas";
import { UserError } from "../errors";
import { db } from "../firebase";
import { manageTokenFor, manageTokenHashFor } from "../links";
import { notify } from "../notify/notify";
import { getBooking, listBookingsByTrialDate, listMakeupByEventDate, listSlotsBetween, txGetBooking, txSetBooking } from "../repo/bookings";
import { getService } from "../repo/services";
import { loadTenant } from "../repo/tenant";
import { newBookingId, requireBooking, txReadClient, uniqueBookingCode } from "./common";

// Flujo 8.4: solicitud de maquillaje, aceptación y aviso de superposición.

export async function createMakeupRequest(
  raw: MakeupRequestInput,
  opts: { now?: Date; ipHash?: string } = {},
): Promise<{ bookingId: string; token: string }> {
  const now = opts.now ?? new Date();
  const parsed = makeupRequestSchema.safeParse(raw);
  if (!parsed.success) throw new UserError(firstError(parsed.error));
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) throw new UserError("Revisá el número de WhatsApp (con código de área, ej. 11 5847-0009).");
  if (input.eventDate < arDateStr(now)) throw new UserError("La fecha del evento ya pasó.");
  const service = await getService(input.serviceId);
  if (!service || !service.active || service.line !== "makeup") throw new UserError("El servicio no está disponible.");

  const tenant = await loadTenant();
  const code = await uniqueBookingCode();
  const bookingId = newBookingId();
  const booking = await db().runTransaction(async (tx) => {
    const client = await txReadClient(tx, phone);
    const b: Booking = {
      id: bookingId,
      code,
      line: "makeup",
      status: "requested",
      service: { id: service.id, name: service.name, price: service.price },
      clientId: phone,
      client: { name: input.name, phone, email: input.email, firstVisit: false },
      deposit: { amount: 0, method: "bank_transfer", status: "pending", receipts: [] },
      balance: { amount: 0 },
      makeup: {
        eventDate: input.eventDate,
        readyByTime: input.readyByTime,
        location: input.location,
        homeAddress: input.location === "home" ? input.homeAddress : undefined,
        peopleCount: input.peopleCount,
        comments: input.comments || undefined,
        preferredTrialDate: service.includesTrial && input.preferredTrialDate ? input.preferredTrialDate : undefined,
      },
      manageTokenHash: manageTokenHashFor(bookingId),
      rescheduleCount: 0,
      attendance: null,
      remindersSent: {},
      history: [{ at: now, from: "", to: "requested", by: "client" }],
      clientIpHash: opts.ipHash,
      createdAt: now,
      updatedAt: now,
    };
    txSetBooking(tx, b);
    client.upsert(b);
    return b;
  });

  await Promise.all([
    notify("makeup_request_received", booking, { tenant }),
    notify("admin_makeup_request", booking, { tenant }),
  ]);
  return { bookingId, token: manageTokenFor(bookingId) };
}

export type OverlapWarning = { kind: "event" | "trial"; label: string };

/** Horarios de skincare y otros eventos que se superponen con el evento o la prueba. */
export async function makeupOverlaps(
  booking: Booking,
  plan: { startTime: string; trialDate?: string; trialTime?: string },
): Promise<OverlapWarning[]> {
  const m = booking.makeup;
  if (!m) return [];
  const windows: { kind: "event" | "trial"; date: string; w: Interval }[] = [
    { kind: "event", date: m.eventDate, w: eventInterval(m.eventDate, plan.startTime, m.readyByTime) },
  ];
  if (plan.trialDate && plan.trialTime) windows.push({ kind: "trial", date: plan.trialDate, w: trialInterval(plan.trialDate, plan.trialTime) });

  const out: OverlapWarning[] = [];
  for (const { kind, date, w } of windows) {
    const slots = await listSlotsBetween(date, date);
    for (const s of findOverlapping(w, slots)) {
      const what = s.status === "open" ? "horario publicado" : s.status === "booked" ? "turno reservado" : "turno retenido";
      out.push({ kind, label: `Skincare: ${what} ${s.time} (${s.durationMin} min)` });
    }
    const others = [...(await listMakeupByEventDate(date)), ...(await listBookingsByTrialDate(date))];
    const seen = new Set<string>();
    for (const o of others) {
      if (o.id === booking.id || seen.has(o.id) || !ACTIVE_STATUSES.includes(o.status) || o.status === "requested") continue;
      seen.add(o.id);
      const items: Interval[] = [];
      if (o.makeup?.eventDate === date && o.makeup.startTime) items.push(eventInterval(date, o.makeup.startTime, o.makeup.readyByTime));
      if (o.makeup?.trialDate === date && o.makeup.trialTime) items.push(trialInterval(date, o.makeup.trialTime));
      if (findOverlapping(w, items).length > 0) out.push({ kind, label: `Maquillaje: ${o.code} · ${o.client.name}` });
    }
  }
  return out;
}

export type AcceptResult = { accepted: true; booking: Booking } | { accepted: false; warnings: OverlapWarning[] };

/**
 * Thalia acepta la solicitud fijando precio final, viático, hora de inicio y
 * prueba. Si hay superposiciones, devuelve los avisos y solo acepta con `force`.
 */
export async function acceptMakeup(bookingId: string, raw: AcceptMakeupInput, now = new Date()): Promise<AcceptResult> {
  const parsed = acceptMakeupSchema.safeParse(raw);
  if (!parsed.success) throw new UserError(firstError(parsed.error));
  const input = parsed.data;
  const pre = requireBooking(await getBooking(bookingId));
  if (pre.line !== "makeup" || !pre.makeup) throw new UserError("No es una solicitud de maquillaje.");
  if (input.trialDate && !input.trialTime) throw new UserError("Indicá la hora de la prueba.");
  if (input.trialTime && !input.trialDate) throw new UserError("Indicá la fecha de la prueba.");

  if (!input.force) {
    const warnings = await makeupOverlaps(pre, {
      startTime: input.startTime,
      trialDate: input.trialDate || undefined,
      trialTime: input.trialTime || undefined,
    });
    if (warnings.length > 0) return { accepted: false, warnings };
  }

  const tenant = await loadTenant();
  const deadline = new Date(now.getTime() + tenant.makeup.receiptUploadHours * 3600_000);
  const booking = await db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    const m = cur.makeup!;
    const { deposit, balance } = makeupDeposit(input.finalPrice, tenant.makeup.depositPercent, input.travelFee);
    const startAt = arLocalToInstant(m.eventDate, input.startTime);
    let next = transition(cur, "accept_request", { at: now, by: "admin" });
    next = {
      ...next,
      startAt,
      date: arDateStr(startAt),
      time: arTimeStr(startAt),
      makeup: {
        ...m,
        finalPrice: input.finalPrice,
        travelFee: input.travelFee,
        startTime: input.startTime,
        trialDate: input.trialDate || undefined,
        trialTime: input.trialTime || undefined,
      },
      deposit: { ...next.deposit, amount: deposit, receiptUploadDeadline: deadline },
      balance: { amount: balance },
    };
    txSetBooking(tx, next);
    return next;
  });
  await notify("payment_link_approved", booking, { tenant });
  return { accepted: true, booking };
}
