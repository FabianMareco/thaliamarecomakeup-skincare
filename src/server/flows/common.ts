import { FieldValue, type Transaction } from "firebase-admin/firestore";
import type { Booking, Slot } from "@/lib/domain/types";
import { cols } from "../db";
import { UserError } from "../errors";
import { clientRef, findBookingByCode } from "../repo/bookings";
import { newBookingCode } from "../tokens";

/** Código corto único (reintenta ante colisiones y agranda si hace falta). */
export async function uniqueBookingCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = newBookingCode(i < 5 ? 4 : 6);
    if (!(await findBookingByCode(code))) return code;
  }
  throw new Error("No se pudo generar un código de reserva");
}

export function newBookingId(): string {
  return cols.bookings().doc().id;
}

/** Libera el horario si sigue tomado por esta reserva. */
export function releaseSlot(tx: Transaction, slot: Slot | null, bookingId: string): void {
  if (!slot || slot.bookingId !== bookingId) return;
  tx.update(cols.slots().doc(slot.id), { status: "open", bookingId: null, heldUntil: null });
}

/**
 * Lee (dentro de la transacción) la ficha de la clienta para actualizarla
 * después. Firestore exige leer todo antes de escribir.
 */
export async function txReadClient(tx: Transaction, clientId: string) {
  const snap = await tx.get(clientRef(clientId));
  return {
    upsert(booking: Pick<Booking, "client" | "createdAt">) {
      const { name, phone, email } = booking.client;
      if (snap.exists) {
        tx.update(clientRef(clientId), {
          name,
          email,
          lastBookingAt: booking.createdAt,
          bookingsCount: FieldValue.increment(1),
        });
      } else {
        tx.set(clientRef(clientId), {
          name,
          phone,
          email,
          firstSeenAt: booking.createdAt,
          lastBookingAt: booking.createdAt,
          bookingsCount: 1,
          noShowCount: 0,
        });
      }
    },
  };
}

/** Máximo 1 reserva esperando pago por teléfono, email o IP (sección 13). */
export async function assertNoPendingPayment(
  key: { phone: string; email: string; ipHash?: string },
  now: Date,
): Promise<void> {
  const checks: [string, string][] = [
    ["client.phone", key.phone],
    ["client.email", key.email],
    ...(key.ipHash ? ([["clientIpHash", key.ipHash]] as [string, string][]) : []),
  ];
  for (const [field, value] of checks) {
    const snap = await cols.bookings().where("status", "==", "awaiting_payment").where(field, "==", value).get();
    const active = snap.docs.some((d) => {
      const deadline = d.get("deposit.receiptUploadDeadline");
      return !deadline || deadline.toDate().getTime() > now.getTime();
    });
    if (active) {
      throw new UserError(
        "Ya tenés una reserva esperando el pago de la seña. Completala (o esperá a que venza) antes de hacer otra, o escribinos por WhatsApp.",
      );
    }
  }
}

export function requireBooking(b: Booking | null): Booking {
  if (!b) throw new UserError("No encontramos la reserva.");
  return b;
}
