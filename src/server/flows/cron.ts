import { FieldValue } from "firebase-admin/firestore";
import { dueReminderOffsets, offsetsToMarkSent } from "@/lib/domain/reminders";
import { transition } from "@/lib/domain/transitions";
import type { Booking } from "@/lib/domain/types";
import { db } from "../firebase";
import { notify } from "../notify/notify";
import { bookingRef, listBookingsByStatus, txGetBooking, txGetSlot, txSetBooking } from "../repo/bookings";
import { loadTenant } from "../repo/tenant";
import { releaseSlot } from "./common";

// Sección 14: tarea programada. Cada paso relee la reserva en una
// transacción y "reclama" el trabajo antes de notificar, así ejecuciones
// solapadas o repetidas no duplican efectos ni envíos.

export type TickReport = {
  expiredPayments: string[];
  expiredApprovals: string[];
  staleReceiptAlerts: string[];
  reminders: { bookingId: string; offset: number; delivered: boolean }[];
};

export async function runTick(now = new Date()): Promise<TickReport> {
  const tenant = await loadTenant();
  const report: TickReport = { expiredPayments: [], expiredApprovals: [], staleReceiptAlerts: [], reminders: [] };

  // 1 y 2. Vencimientos.
  const pending = await listBookingsByStatus(["awaiting_payment", "awaiting_approval"]);
  for (const b of pending) {
    const deadline = b.status === "awaiting_payment" ? b.deposit.receiptUploadDeadline : b.approvalDeadline;
    if (!deadline || deadline.getTime() > now.getTime()) continue;
    const expired = await db().runTransaction(async (tx) => {
      const cur = await txGetBooking(tx, b.id);
      const slot = cur?.slotId ? await txGetSlot(tx, cur.slotId) : null;
      if (!cur || cur.status !== b.status) return null;
      const d = cur.status === "awaiting_payment" ? cur.deposit.receiptUploadDeadline : cur.approvalDeadline;
      if (!d || d.getTime() > now.getTime()) return null;
      const next = transition(cur, "expire", { at: now, by: "system" });
      releaseSlot(tx, slot, cur.id);
      txSetBooking(tx, next);
      return next;
    });
    if (!expired) continue;
    if (b.status === "awaiting_payment") report.expiredPayments.push(b.id);
    else report.expiredApprovals.push(b.id);
    await notify("expired", expired, { tenant });
    if (expired.line === "makeup") await notify("admin_makeup_expired", expired, { tenant });
  }

  // 3. Comprobantes sin verificar: un solo aviso extra por comprobante.
  const verifying = await listBookingsByStatus(["awaiting_verification"]);
  const staleMs = tenant.verificationReminderMinutes * 60_000;
  for (const b of verifying) {
    const last = b.deposit.receipts.at(-1);
    if (!last || last.adminRemindedAt || now.getTime() - last.uploadedAt.getTime() < staleMs) continue;
    const claimed = await db().runTransaction(async (tx) => {
      const cur = await txGetBooking(tx, b.id);
      const r = cur?.deposit.receipts.at(-1);
      if (!cur || cur.status !== "awaiting_verification" || !r || r.adminRemindedAt || r.path !== last.path) return null;
      const receipts = [...cur.deposit.receipts];
      receipts[receipts.length - 1] = { ...r, adminRemindedAt: now };
      const next: Booking = { ...cur, deposit: { ...cur.deposit, receipts } };
      txSetBooking(tx, next);
      return next;
    });
    if (!claimed) continue;
    report.staleReceiptAlerts.push(b.id);
    await notify("admin_receipt_stale", claimed, { tenant });
  }

  // 4. Recordatorios.
  const confirmed = await listBookingsByStatus(["confirmed"]);
  for (const b of confirmed) {
    const offsets = b.line === "makeup" ? tenant.makeup.reminderOffsetsHours : tenant.skincare.reminderOffsetsHours;
    const [offset] = dueReminderOffsets(b, offsets, now);
    if (offset === undefined) continue;
    const keys = offsetsToMarkSent(offset, offsets).map(String);
    const claimed = await db().runTransaction(async (tx) => {
      const cur = await txGetBooking(tx, b.id);
      if (!cur || !dueReminderOffsets(cur, offsets, now).includes(offset)) return null;
      const sent = { ...cur.remindersSent };
      for (const k of keys) if (!sent[k]) sent[k] = now;
      const next: Booking = { ...cur, remindersSent: sent };
      txSetBooking(tx, next);
      return { booking: next, newlyMarked: keys.filter((k) => !cur.remindersSent[k]) };
    });
    if (!claimed) continue;
    const res = await notify("reminder", claimed.booking, { tenant, offsetHours: offset });
    if (!res.delivered) {
      // Fallaron todos los canales: se libera el reclamo para reintentar en el próximo tick.
      await bookingRef(b.id).update(Object.fromEntries(claimed.newlyMarked.map((k) => [`remindersSent.${k}`, FieldValue.delete()])));
    }
    report.reminders.push({ bookingId: b.id, offset, delivered: res.delivered });
  }

  return report;
}
