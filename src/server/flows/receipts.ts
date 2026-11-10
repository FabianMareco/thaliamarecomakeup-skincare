import { validateReceipt } from "@/lib/domain/receipts";
import type { Booking, Receipt } from "@/lib/domain/types";
import { payerNameSchema } from "@/lib/schemas";
import { UserError } from "../errors";
import { db } from "../firebase";
import { notify } from "../notify/notify";
import { paymentMethodFor } from "../payments";
import { findBookingByToken, slotRef, txGetBooking, txGetSlot, txSetBooking } from "../repo/bookings";
import { loadTenant } from "../repo/tenant";
import { deleteReceipt, saveReceipt } from "../receiptStore";
import { requireBooking } from "./common";

// Sección 10.1: carga del comprobante por la clienta.

export async function storeReceiptFile(bookingId: string, bytes: Uint8Array, now: Date) {
  const check = validateReceipt(bytes);
  if (!check.ok) throw new UserError(check.error);
  const path = await saveReceipt({ bookingId, bytes, contentType: check.kind.contentType, ext: check.kind.ext, now });
  return { path, contentType: check.kind.contentType };
}

export async function deleteReceiptFile(path: string): Promise<void> {
  await deleteReceipt(path).catch(() => undefined);
}

function assertUploadOpen(b: Booking, now: Date): void {
  if (b.status !== "awaiting_payment") {
    throw new UserError(
      b.status === "awaiting_verification"
        ? "Ya recibimos tu comprobante. Thalia lo está verificando."
        : "Esta reserva no está esperando un comprobante.",
    );
  }
  const deadline = b.deposit.receiptUploadDeadline;
  if (deadline && deadline.getTime() <= now.getTime()) {
    throw new UserError("Se venció el plazo para subir el comprobante y el lugar se liberó. Escribinos por WhatsApp.");
  }
}

export async function uploadReceipt(
  token: string,
  file: Uint8Array,
  payerNameRaw: string,
  now = new Date(),
): Promise<Booking> {
  const payer = payerNameSchema.safeParse(payerNameRaw);
  if (!payer.success) throw new UserError(payer.error.issues[0].message);
  const found = requireBooking(await findBookingByToken(token));
  assertUploadOpen(found, now);

  const stored = await storeReceiptFile(found.id, file, now);
  let updated: Booking;
  try {
    updated = await db().runTransaction(async (tx) => {
      const b = requireBooking(await txGetBooking(tx, found.id));
      const slot = b.slotId ? await txGetSlot(tx, b.slotId) : null;
      assertUploadOpen(b, now);
      if (b.line === "skincare" && (!slot || slot.bookingId !== b.id)) {
        throw new UserError("El horario de esta reserva ya no está disponible. Escribinos por WhatsApp.");
      }
      const receipt: Receipt = { path: stored.path, uploadedAt: now, payerName: payer.data, contentType: stored.contentType, source: "client" };
      const next = paymentMethodFor(b).confirm(b, { kind: "receipt", receipt, by: "client" }, now);
      // Mientras espera verificación el horario queda retenido sin vencimiento.
      if (slot) tx.update(slotRef(slot.id), { status: "held", heldUntil: null });
      txSetBooking(tx, next);
      return next;
    });
  } catch (e) {
    await deleteReceiptFile(stored.path);
    throw e;
  }

  const tenant = await loadTenant();
  await Promise.all([
    notify("receipt_received", updated, { tenant }),
    notify("admin_receipt_submitted", updated, { tenant }),
  ]);
  return updated;
}
