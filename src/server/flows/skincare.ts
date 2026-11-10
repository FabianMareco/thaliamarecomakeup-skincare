import { approvalDeadline, isBookable, isSameDay } from "@/lib/domain/availability";
import { skincareDeposit } from "@/lib/domain/money";
import { normalizePhone } from "@/lib/domain/phone";
import { addDaysStr, arDateStr } from "@/lib/domain/time";
import type { Booking, Service, Slot } from "@/lib/domain/types";
import { firstError, skincareBookingSchema, type SkincareBookingInput } from "@/lib/schemas";
import { UserError } from "../errors";
import { db } from "../firebase";
import { manageTokenFor, manageTokenHashFor } from "../links";
import { notify } from "../notify/notify";
import { listSlotsBetween, slotRef, txGetSlot, txSetBooking } from "../repo/bookings";
import { getService } from "../repo/services";
import { loadTenant } from "../repo/tenant";
import { assertNoPendingPayment, newBookingId, txReadClient, uniqueBookingCode } from "./common";

// Flujos 8.1 y 8.2: disponibilidad y reserva de skincare.

export type AvailabilityDay = { date: string; slots: { id: string; time: string }[] };

/** Días y horarios reservables para un servicio (próximos `bookingHorizonDays` días). */
export async function getAvailability(serviceId: string, now = new Date()): Promise<AvailabilityDay[]> {
  const [tenant, service] = await Promise.all([loadTenant(), getService(serviceId)]);
  if (!service || !service.active || service.line !== "skincare") return [];
  return availabilityFor(service, now, tenant.skincare.bookingHorizonDays);
}

export async function availabilityFor(
  service: Pick<Service, "durationMin" | "modality">,
  now: Date,
  horizonDays: number,
  excludeSlotId?: string,
): Promise<AvailabilityDay[]> {
  const today = arDateStr(now);
  const slots = await listSlotsBetween(today, addDaysStr(today, horizonDays));
  const byDate = new Map<string, AvailabilityDay>();
  for (const s of slots) {
    if (s.id === excludeSlotId || !isBookable(s, service, now, horizonDays)) continue;
    const day = byDate.get(s.date) ?? { date: s.date, slots: [] };
    day.slots.push({ id: s.id, time: s.time });
    byDate.set(s.date, day);
  }
  return [...byDate.values()];
}

export type CreateBookingResult = { bookingId: string; token: string; status: Booking["status"] };

export async function createSkincareBooking(
  raw: SkincareBookingInput,
  opts: { now?: Date; ipHash?: string } = {},
): Promise<CreateBookingResult> {
  const now = opts.now ?? new Date();
  const parsed = skincareBookingSchema.safeParse(raw);
  if (!parsed.success) throw new UserError(firstError(parsed.error));
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) throw new UserError("Revisá el número de WhatsApp (con código de área, ej. 11 5847-0009).");

  const [tenant, service] = await Promise.all([loadTenant(), getService(input.serviceId)]);
  if (!service || !service.active || service.line !== "skincare") throw new UserError("El servicio no está disponible.");
  const cfg = tenant.skincare;

  await assertNoPendingPayment({ phone, email: input.email, ipHash: opts.ipHash }, now);
  const code = await uniqueBookingCode();
  const bookingId = newBookingId();
  const { deposit, balance } = skincareDeposit(service.price, cfg.depositAmount);

  const booking = await db().runTransaction(async (tx) => {
    const slot = await txGetSlot(tx, input.slotId);
    const client = await txReadClient(tx, phone);
    if (!slot || !isBookable(slot, service, now, cfg.bookingHorizonDays)) {
      throw new UserError("Ese horario ya no está disponible. Elegí otro, por favor.");
    }
    const sameDay = cfg.sameDayRequiresApproval && isSameDay(slot.date, now);
    const approvalUntil = sameDay ? approvalDeadline(now, slot.startAt, cfg.sameDayApprovalTimeoutMinutes) : undefined;
    if (approvalUntil && approvalUntil.getTime() <= now.getTime()) {
      throw new UserError("Ese turno empieza muy pronto para reservarlo online. Escribinos por WhatsApp.");
    }
    const uploadDeadline = sameDay ? undefined : new Date(now.getTime() + cfg.receiptUploadMinutes * 60_000);
    const status = sameDay ? "awaiting_approval" : "awaiting_payment";

    const b: Booking = {
      id: bookingId,
      code,
      line: "skincare",
      status,
      service: { id: service.id, name: service.name, price: service.price, durationMin: service.durationMin },
      slotId: slot.id,
      startAt: slot.startAt,
      date: slot.date,
      time: slot.time,
      modality: slot.modality,
      clientId: phone,
      client: { name: input.name, phone, email: input.email, firstVisit: input.firstVisit },
      deposit: {
        amount: deposit,
        method: "bank_transfer",
        status: "pending",
        receiptUploadDeadline: uploadDeadline,
        receipts: [],
      },
      balance: { amount: balance },
      manageTokenHash: manageTokenHashFor(bookingId),
      rescheduleCount: 0,
      attendance: null,
      approvalDeadline: approvalUntil,
      remindersSent: {},
      history: [{ at: now, from: "", to: status, by: "client" }],
      clientIpHash: opts.ipHash,
      createdAt: now,
      updatedAt: now,
    };
    const held: Partial<Slot> = { status: "held", bookingId, heldUntil: approvalUntil ?? uploadDeadline ?? null };
    tx.update(slotRef(slot.id), held);
    txSetBooking(tx, b);
    client.upsert(b);
    return b;
  });

  if (booking.status === "awaiting_approval") {
    await Promise.all([
      notify("same_day_received", booking, { tenant }),
      notify("admin_same_day_request", booking, { tenant }),
    ]);
  } else {
    await notify("payment_link_created", booking, { tenant });
  }
  return { bookingId, token: manageTokenFor(bookingId), status: booking.status };
}
