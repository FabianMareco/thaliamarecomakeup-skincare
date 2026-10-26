import { validateReceipt } from "@/lib/domain/receipts";
import type { Booking, Receipt } from "@/lib/domain/types";
import { payerNameSchema } from "@/lib/schemas";
import { env } from "../env";
import { UserError } from "../errors";
import { bucket, db } from "../firebase";
import { notify } from "../notify/notify";
import { paymentMethodFor } from "../payments";
import { findBookingByToken, slotRef, txGetBooking, txGetSlot, txSetBooking } from "../repo/bookings";
import { loadTenant } from "../repo/tenant";
import { requireBooking } from "./common";

// Sección 10.1: carga del comprobante por la clienta.

export async function storeReceiptFile(bookingId: string, bytes: Uint8Array, now: Date) {
  const check = validateReceipt(bytes);
  if (!check.ok) throw new UserError(check.error);
  const path = `receipts/${env.tenantId}/${bookingId}/${now.getTime()}.${check.kind.ext}`;
  await bucket().file(path).save(Buffer.from(bytes), {
    contentType: check.kind.contentType,
    resumable: false,
    metadata: { cacheControl: "private, no-store" },
  });
  return { path, contentType: check.kind.contentType };
}

export async function deleteReceiptFile(path: string): Promise<void> {
  await bucket().file(path).delete({ ignoreNotFound: true }).catch(() => undefined);
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

/** URL firmada de corta duración para que Thalia vea un comprobante. */
export async function receiptViewUrl(path: string): Promise<string | null> {
  if (env.usingEmulators) return null; // el emulador no firma URLs: se usa el proxy autenticado
  try {
    const [url] = await bucket().file(path).getSignedUrl({ action: "read", expires: Date.now() + 5 * 60_000, version: "v4" });
    return url;
  } catch (e) {
    console.error("[receipts] no se pudo firmar la URL", e);
    return null;
  }
}
