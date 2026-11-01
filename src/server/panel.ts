import { arLocalToInstant, addDaysStr } from "@/lib/domain/time";
import type { Booking, Slot } from "@/lib/domain/types";
import { listBookingsBetween, listBookingsByDepositStatus, listBookingsByStatus, listSlotsBetween } from "./repo/bookings";

// Consultas para las pantallas del panel.

export type PendingLists = {
  receipts: Booking[];
  sameDay: Booking[];
  makeupRequests: Booking[];
  refunds: Booking[];
  expiredMakeup: Booking[];
};

export async function pendingLists(now = new Date()): Promise<PendingLists> {
  const [active, refunds, expired] = await Promise.all([
    listBookingsByStatus(["awaiting_verification", "awaiting_approval", "requested"]),
    listBookingsByDepositStatus("refund_pending"),
    listBookingsByStatus(["expired"]),
  ]);
  const lastUpload = (b: Booking) => b.deposit.receipts.at(-1)?.uploadedAt.getTime() ?? 0;
  const weekAgo = now.getTime() - 7 * 24 * 3600_000;
  return {
    receipts: active.filter((b) => b.status === "awaiting_verification").sort((a, b) => lastUpload(a) - lastUpload(b)),
    sameDay: active
      .filter((b) => b.status === "awaiting_approval")
      .sort((a, b) => (a.approvalDeadline?.getTime() ?? 0) - (b.approvalDeadline?.getTime() ?? 0)),
    makeupRequests: active.filter((b) => b.status === "requested").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    refunds: refunds.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime()),
    expiredMakeup: expired
      .filter((b) => b.line === "makeup" && b.updatedAt.getTime() >= weekAgo)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
  };
}

export async function pendingCounts() {
  const l = await pendingLists();
  const counts = {
    receipts: l.receipts.length,
    sameDay: l.sameDay.length,
    makeupRequests: l.makeupRequests.length,
    refunds: l.refunds.length,
  };
  return { ...counts, total: counts.receipts + counts.sameDay + counts.makeupRequests + counts.refunds };
}

export type AgendaItem =
  | { kind: "slot"; slot: Slot; booking?: Booking }
  | { kind: "makeup_event"; booking: Booking; startAt: Date }
  | { kind: "makeup_trial"; booking: Booking; startAt: Date };

/** Horarios de skincare y eventos/pruebas de maquillaje entre dos fechas (inclusive). */
export async function agenda(from: string, to: string): Promise<Map<string, AgendaItem[]>> {
  const start = arLocalToInstant(from, "00:00");
  const end = arLocalToInstant(addDaysStr(to, 1), "00:00");
  const [slots, bookings, makeupActive] = await Promise.all([
    listSlotsBetween(from, to),
    listBookingsBetween(start, end),
    listBookingsByStatus(["awaiting_payment", "awaiting_verification", "confirmed", "completed"]),
  ]);
  const byId = new Map<string, Booking>();
  for (const b of [...bookings, ...makeupActive]) byId.set(b.id, b);

  const days = new Map<string, AgendaItem[]>();
  const push = (date: string, item: AgendaItem) => {
    if (date < from || date > to) return;
    days.set(date, [...(days.get(date) ?? []), item]);
  };
  for (const s of slots) push(s.date, { kind: "slot", slot: s, booking: s.bookingId ? byId.get(s.bookingId) : undefined });
  for (const b of byId.values()) {
    if (b.line !== "makeup" || !b.makeup) continue;
    if (!["awaiting_payment", "awaiting_verification", "confirmed", "completed"].includes(b.status)) continue;
    if (b.startAt) push(b.makeup.eventDate, { kind: "makeup_event", booking: b, startAt: b.startAt });
    if (b.makeup.trialDate && b.makeup.trialTime)
      push(b.makeup.trialDate, { kind: "makeup_trial", booking: b, startAt: arLocalToInstant(b.makeup.trialDate, b.makeup.trialTime) });
  }
  const time = (i: AgendaItem) => (i.kind === "slot" ? i.slot.startAt : i.startAt).getTime();
  for (const list of days.values()) list.sort((a, b) => time(a) - time(b));
  return days;
}
