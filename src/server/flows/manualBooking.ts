import { isSlotFree } from "@/lib/domain/availability";
import { skincareDeposit } from "@/lib/domain/money";
import { normalizePhone } from "@/lib/domain/phone";
import { findOverlap, newOpenSlot, validateSlotInput } from "@/lib/domain/slots";
import { transition } from "@/lib/domain/transitions";
import type { Booking, Slot } from "@/lib/domain/types";
import { adminBookingSchema, firstError, type AdminBookingInput } from "@/lib/schemas";
import { cols, fromSnap, toData } from "../db";
import { UserError } from "../errors";
import { db } from "../firebase";
import { manageTokenHashFor } from "../links";
import { notify } from "../notify/notify";
import { paymentMethodFor } from "../payments";
import { slotRef, txGetSlot, txSetBooking } from "../repo/bookings";
import { getService } from "../repo/services";
import { loadTenant } from "../repo/tenant";
import { newBookingId, txReadClient, uniqueBookingCode } from "./common";

// Reserva de skincare cargada a mano por Thalia, en un horario libre o en uno
// nuevo creado en el momento. Con la seña ya recibida queda confirmada; si
// no, queda esperando la seña sin vencimiento (no la libera el cron) hasta que
// Thalia la confirme desde el detalle de la reserva.

export async function createAdminBooking(raw: AdminBookingInput, now = new Date()): Promise<Booking> {
  const parsed = adminBookingSchema.safeParse(raw);
  if (!parsed.success) throw new UserError(firstError(parsed.error));
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) throw new UserError("Revisá el WhatsApp de la clienta (con código de área, ej. 11 5847-0009).");
  if (input.newSlot) {
    const err = validateSlotInput(input.newSlot);
    if (err) throw new UserError(err);
  }

  const [tenant, service] = await Promise.all([loadTenant(), getService(input.serviceId)]);
  if (!service || service.line !== "skincare") throw new UserError("Elegí un tratamiento de skincare.");
  const code = await uniqueBookingCode();
  const bookingId = newBookingId();
  const { deposit, balance } = skincareDeposit(service.price, tenant.skincare.depositAmount);

  const booking = await db().runTransaction(async (tx) => {
    // Lecturas primero (Firestore lo exige), escrituras después.
    let slot: Slot;
    if (input.newSlot) {
      slot = newOpenSlot(input.newSlot);
      const day = (await tx.get(cols.slots().where("date", "==", slot.date))).docs.map((d) => fromSnap<Slot>(d)!);
      if (day.some((s) => s.id === slot.id)) throw new UserError(`Ya existe un horario a las ${slot.time}. Reservalo desde la lista.`);
      const clash = findOverlap(slot, day);
      if (clash) throw new UserError(`Se superpone con el horario de las ${clash.time} (${clash.durationMin} min).`);
    } else {
      const existing = await txGetSlot(tx, input.slotId!);
      if (!existing) throw new UserError("El horario no existe.");
      if (!isSlotFree(existing, now)) throw new UserError("Ese horario ya tiene una reserva.");
      slot = existing;
    }
    const client = await txReadClient(tx, phone);

    let b: Booking = {
      id: bookingId,
      code,
      line: "skincare",
      status: "awaiting_payment",
      service: { id: service.id, name: service.name, price: service.price, durationMin: service.durationMin },
      slotId: slot.id,
      startAt: slot.startAt,
      date: slot.date,
      time: slot.time,
      modality: slot.modality,
      clientId: phone,
      client: { name: input.name, phone, email: input.email, firstVisit: input.firstVisit },
      // Sin plazo para el comprobante: el horario queda retenido hasta que Thalia decida.
      deposit: { amount: deposit, method: "bank_transfer", status: "pending", receipts: [] },
      balance: { amount: balance },
      manageTokenHash: manageTokenHashFor(bookingId),
      rescheduleCount: 0,
      attendance: null,
      remindersSent: {},
      history: [{ at: now, from: "", to: "awaiting_payment", by: "admin", note: "Cargada por Thalia" }],
      createdAt: now,
      updatedAt: now,
    };
    if (input.depositPaid) {
      b = paymentMethodFor(b).confirm(
        b,
        { kind: "receipt", by: "admin", receipt: { path: "", uploadedAt: now, payerName: "(cargado por Thalia)", source: "admin", reviewedAt: now, result: "approved" } },
        now,
      );
      b = transition(b, "approve_receipt", { at: now, by: "admin", note: "Seña recibida por fuera del sistema" });
      b = { ...b, deposit: { ...b.deposit, verifiedAt: now } };
    }

    const slotState: Partial<Slot> = { status: input.depositPaid ? "booked" : "held", bookingId, heldUntil: null };
    if (input.newSlot) tx.create(slotRef(slot.id), toData({ ...slot, ...slotState }));
    else tx.update(slotRef(slot.id), slotState);
    txSetBooking(tx, b);
    client.upsert(b);
    return b;
  });

  if (input.notifyClient) {
    await notify(booking.status === "confirmed" ? "confirmed" : "payment_link_created", booking, { tenant });
  }
  return booking;
}
