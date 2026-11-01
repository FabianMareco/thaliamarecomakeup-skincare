import { FieldValue } from "firebase-admin/firestore";
import { isBookable } from "@/lib/domain/availability";
import { fmtDateTimeLong } from "@/lib/domain/time";
import { transition } from "@/lib/domain/transitions";
import type { Booking, Receipt } from "@/lib/domain/types";
import { refundDestinationSchema } from "@/lib/schemas";
import { UserError } from "../errors";
import { db } from "../firebase";
import { notify } from "../notify/notify";
import { paymentMethodFor } from "../payments";
import { clientRef, getBooking, slotRef, txGetBooking, txGetSlot, txSetBooking } from "../repo/bookings";
import { loadTenant } from "../repo/tenant";
import { releaseSlot, requireBooking } from "./common";
import { deleteReceiptFile, storeReceiptFile } from "./receipts";

// Acciones del panel sobre una reserva (secciones 8, 10.2, 10.3 y 12).
// Cada una corre en una transacción y valida el estado actual, así que
// repetirla no produce efectos duplicados.

function markLastReceipt(b: Booking, patch: Partial<Receipt>): Booking {
  const receipts = [...b.deposit.receipts];
  const i = receipts.length - 1;
  if (i >= 0) receipts[i] = { ...receipts[i], ...patch };
  return { ...b, deposit: { ...b.deposit, receipts } };
}

async function uploadDeadlineFor(b: Booking, now: Date): Promise<Date> {
  const t = await loadTenant();
  const ms = b.line === "makeup" ? t.makeup.receiptUploadHours * 3600_000 : t.skincare.receiptUploadMinutes * 60_000;
  return new Date(now.getTime() + ms);
}

/** Aprobar el comprobante: la reserva queda confirmada y el horario reservado. */
export async function approveReceipt(bookingId: string, now = new Date()): Promise<Booking> {
  const b = await db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    const slot = cur.slotId ? await txGetSlot(tx, cur.slotId) : null;
    if (cur.status === "confirmed") return null; // ya aprobada
    let next = markLastReceipt(cur, { reviewedAt: now, result: "approved" });
    next = transition(next, "approve_receipt", { at: now, by: "admin" });
    next = { ...next, deposit: { ...next.deposit, verifiedAt: now } };
    if (slot && slot.bookingId === cur.id) tx.update(slotRef(slot.id), { status: "booked", heldUntil: null });
    txSetBooking(tx, next);
    return next;
  });
  if (b) await notify("confirmed", b);
  return b ?? requireBooking(await getBooking(bookingId));
}

/** Pedir reenviar el comprobante, con motivo y nuevo plazo. */
export async function requestResubmit(bookingId: string, reason: string, now = new Date()): Promise<Booking> {
  const why = reason.trim();
  if (why.length < 3) throw new UserError("Indicá el motivo para la clienta.");
  const pre = requireBooking(await getBooking(bookingId));
  const deadline = await uploadDeadlineFor(pre, now);
  const b = await db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    const slot = cur.slotId ? await txGetSlot(tx, cur.slotId) : null;
    let next = markLastReceipt(cur, { reviewedAt: now, result: "rejected", rejectionReason: why });
    next = transition(next, "request_resubmit", { at: now, by: "admin", note: why });
    next = { ...next, deposit: { ...next.deposit, receiptUploadDeadline: deadline, resubmitReason: why } };
    if (slot && slot.bookingId === cur.id) tx.update(slotRef(slot.id), { status: "held", heldUntil: deadline });
    txSetBooking(tx, next);
    return next;
  });
  await notify("resubmit_requested", b, { reason: why });
  return b;
}

/** Rechazar (comprobante, solicitud del mismo día o de maquillaje). Libera el horario. */
export async function rejectBooking(bookingId: string, reason: string, now = new Date()): Promise<Booking> {
  const why = reason.trim();
  const b = await db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    const slot = cur.slotId ? await txGetSlot(tx, cur.slotId) : null;
    let next = cur.status === "awaiting_verification" ? markLastReceipt(cur, { reviewedAt: now, result: "rejected", rejectionReason: why || undefined }) : cur;
    next = transition(next, "reject", { at: now, by: "admin", note: why || undefined });
    next = { ...next, rejectionReason: why || undefined, ...(next.makeup ? { makeup: { ...next.makeup, rejectionMessage: why || undefined } } : {}) };
    releaseSlot(tx, slot, cur.id);
    txSetBooking(tx, next);
    return next;
  });
  await notify("rejected", b, { reason: why || undefined });
  return b;
}

/** Aprobar una solicitud del mismo día: recién ahora la clienta ve los datos de transferencia. */
export async function approveSameDay(bookingId: string, now = new Date()): Promise<Booking> {
  const pre = requireBooking(await getBooking(bookingId));
  const deadline = await uploadDeadlineFor(pre, now);
  const b = await db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    const slot = cur.slotId ? await txGetSlot(tx, cur.slotId) : null;
    if (!slot || slot.bookingId !== cur.id) throw new UserError("El horario ya no está retenido para esta reserva.");
    let next = transition(cur, "approve_same_day", { at: now, by: "admin" });
    next = { ...next, deposit: { ...next.deposit, receiptUploadDeadline: deadline } };
    tx.update(slotRef(slot.id), { status: "held", heldUntil: deadline });
    txSetBooking(tx, next);
    return next;
  });
  await notify("payment_link_approved", b);
  return b;
}

/**
 * Confirmar una seña recibida por fuera del sistema (por ejemplo, por
 * WhatsApp), con comprobante opcional.
 */
export async function confirmDepositManually(
  bookingId: string,
  opts: { payerName?: string; file?: Uint8Array },
  now = new Date(),
): Promise<Booking> {
  const stored = opts.file && opts.file.length > 0 ? await storeReceiptFile(bookingId, opts.file, now) : null;
  try {
    const b = await db().runTransaction(async (tx) => {
      const cur = requireBooking(await txGetBooking(tx, bookingId));
      const slot = cur.slotId ? await txGetSlot(tx, cur.slotId) : null;
      if (cur.line === "skincare" && (!slot || slot.bookingId !== cur.id)) {
        throw new UserError("El horario ya no está retenido para esta reserva. Reprogramala primero.");
      }
      let next = cur;
      if (cur.status === "awaiting_payment") {
        const receipt: Receipt = {
          path: stored?.path ?? "",
          contentType: stored?.contentType,
          uploadedAt: now,
          payerName: opts.payerName?.trim() || "(cargado por Thalia)",
          source: "admin",
        };
        next = paymentMethodFor(cur).confirm(cur, { kind: "receipt", receipt, by: "admin" }, now);
      } else if (cur.status === "awaiting_verification" && stored) {
        next = { ...cur, deposit: { ...cur.deposit, receipts: [...cur.deposit.receipts, { path: stored.path, contentType: stored.contentType, uploadedAt: now, payerName: opts.payerName?.trim() || "(cargado por Thalia)", source: "admin" }] } };
      }
      next = markLastReceipt(next, { reviewedAt: now, result: "approved" });
      next = transition(next, "approve_receipt", { at: now, by: "admin", note: "Seña confirmada por fuera del sistema" });
      next = { ...next, deposit: { ...next.deposit, verifiedAt: now } };
      if (slot && slot.bookingId === cur.id) tx.update(slotRef(slot.id), { status: "booked", heldUntil: null });
      txSetBooking(tx, next);
      return next;
    });
    await notify("confirmed", b);
    return b;
  } catch (e) {
    if (stored) await deleteReceiptFile(stored.path);
    throw e;
  }
}

/** Reprogramar desde el panel: sin límite y sin regla de 48 hs. */
export async function adminReschedule(bookingId: string, newSlotId: string, now = new Date()): Promise<Booking> {
  const result = await moveToSlot(bookingId, newSlotId, now, "admin");
  await notify("rescheduled", result.booking, { previousWhen: result.previousWhen });
  return result.booking;
}

/** Mueve una reserva de skincare a otro horario (usado por Thalia y por la clienta). */
export async function moveToSlot(
  bookingId: string,
  newSlotId: string,
  now: Date,
  by: "admin" | "client",
  guard?: (b: Booking) => void,
): Promise<{ booking: Booking; previousWhen: string }> {
  const tenant = await loadTenant();
  return db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    if (cur.line !== "skincare" || !cur.slotId) throw new UserError("Solo se pueden reprogramar turnos de skincare.");
    if (!["awaiting_payment", "awaiting_verification", "confirmed"].includes(cur.status)) {
      throw new UserError("Esta reserva no se puede reprogramar en su estado actual.");
    }
    if (newSlotId === cur.slotId) throw new UserError("Elegí un horario distinto al actual.");
    guard?.(cur);
    const oldSlot = await txGetSlot(tx, cur.slotId);
    const newSlot = await txGetSlot(tx, newSlotId);
    const service = { durationMin: cur.service.durationMin, modality: cur.modality ?? "in_person" };
    // Thalia puede ignorar el horizonte de reserva; la clienta no.
    const horizon = by === "admin" ? 3650 : tenant.skincare.bookingHorizonDays;
    if (!newSlot || !isBookable(newSlot, service, now, horizon)) {
      throw new UserError("Ese horario ya no está disponible. Elegí otro, por favor.");
    }
    const previousWhen = cur.startAt ? fmtDateTimeLong(cur.startAt) : "";
    const status = oldSlot && oldSlot.bookingId === cur.id ? oldSlot.status : cur.status === "confirmed" ? "booked" : "held";
    const heldUntil = cur.status === "awaiting_payment" ? (cur.deposit.receiptUploadDeadline ?? null) : null;
    releaseSlot(tx, oldSlot, cur.id);
    tx.update(slotRef(newSlot.id), { status, bookingId: cur.id, heldUntil });
    const next: Booking = {
      ...cur,
      slotId: newSlot.id,
      startAt: newSlot.startAt,
      date: newSlot.date,
      time: newSlot.time,
      modality: newSlot.modality,
      rescheduleCount: by === "client" ? cur.rescheduleCount + 1 : cur.rescheduleCount,
      remindersSent: {},
      history: [
        ...cur.history,
        { at: now, from: cur.status, to: cur.status, by, note: `Reprogramado: ${cur.date} ${cur.time} → ${newSlot.date} ${newSlot.time}` },
      ],
      updatedAt: now,
    };
    txSetBooking(tx, next);
    return { booking: next, previousWhen };
  });
}

/** Cancelar desde el panel, eligiendo con o sin reintegro (puede ignorar la regla de 48 hs). */
export async function adminCancel(
  bookingId: string,
  opts: { refund: boolean; destination?: string; note?: string },
  now = new Date(),
): Promise<Booking> {
  const b = await db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    const slot = cur.slotId ? await txGetSlot(tx, cur.slotId) : null;
    let next = transition(cur, opts.refund ? "cancel_with_refund" : "cancel_forfeit", { at: now, by: "admin", note: opts.note });
    if (opts.refund && opts.destination?.trim()) {
      next = { ...next, deposit: { ...next.deposit, refundDestination: opts.destination.trim() } };
    }
    releaseSlot(tx, slot, cur.id);
    txSetBooking(tx, next);
    return next;
  });
  await notify("cancelled", b);
  return b;
}

/** Reintegro excepcional de una seña retenida (por ejemplo, en maquillaje). */
export async function markRefundPending(bookingId: string, destination: string, now = new Date()): Promise<Booking> {
  const dest = refundDestinationSchema.safeParse(destination);
  if (!dest.success) throw new UserError(dest.error.issues[0].message);
  return db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    if (cur.deposit.status !== "forfeited") throw new UserError("Solo se puede reintegrar una seña retenida.");
    const next: Booking = {
      ...cur,
      deposit: { ...cur.deposit, status: "refund_pending", refundDestination: dest.data },
      history: [...cur.history, { at: now, from: cur.status, to: cur.status, by: "admin", note: "Reintegro excepcional de la seña" }],
      updatedAt: now,
    };
    txSetBooking(tx, next);
    return next;
  });
}

export async function markRefunded(bookingId: string, now = new Date()): Promise<Booking> {
  const b = await db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    if (cur.deposit.status === "refunded") return null;
    if (cur.deposit.status !== "refund_pending") throw new UserError("Esta reserva no tiene un reintegro pendiente.");
    const next: Booking = {
      ...cur,
      deposit: { ...cur.deposit, status: "refunded", refundedAt: now },
      history: [...cur.history, { at: now, from: cur.status, to: cur.status, by: "admin", note: "Seña reintegrada" }],
      updatedAt: now,
    };
    txSetBooking(tx, next);
    return next;
  });
  if (b) await notify("refunded", b);
  return b ?? requireBooking(await getBooking(bookingId));
}

export async function markAttendance(bookingId: string, attended: boolean, now = new Date()): Promise<Booking> {
  return db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    let next = transition(cur, attended ? "complete" : "mark_no_show", { at: now, by: "admin" });
    next = { ...next, attendance: attended ? "attended" : "no_show" };
    if (!attended) tx.update(clientRef(cur.clientId), { noShowCount: FieldValue.increment(1) });
    txSetBooking(tx, next);
    return next;
  });
}

export async function registerBalance(bookingId: string, method: string, now = new Date()): Promise<Booking> {
  const m = method.trim().slice(0, 40) || "efectivo";
  return db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    const next: Booking = {
      ...cur,
      balance: { ...cur.balance, paidAt: now, method: m },
      history: [...cur.history, { at: now, from: cur.status, to: cur.status, by: "admin", note: `Saldo cobrado (${m})` }],
      updatedAt: now,
    };
    txSetBooking(tx, next);
    return next;
  });
}

export async function saveInternalNotes(bookingId: string, notes: string, now = new Date()): Promise<void> {
  await db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, bookingId));
    txSetBooking(tx, { ...cur, internalNotes: notes.slice(0, 5000), updatedAt: now });
  });
}
