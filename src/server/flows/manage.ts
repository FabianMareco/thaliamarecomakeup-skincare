import { clientOptions } from "@/lib/domain/availability";
import { transition } from "@/lib/domain/transitions";
import type { Booking } from "@/lib/domain/types";
import { refundDestinationSchema } from "@/lib/schemas";
import { UserError } from "../errors";
import { db } from "../firebase";
import { notify } from "../notify/notify";
import { findBookingByToken, txGetBooking, txGetSlot, txSetBooking } from "../repo/bookings";
import { loadTenant } from "../repo/tenant";
import { releaseSlot, requireBooking } from "./common";
import { moveToSlot } from "./admin";

// Sección 8.3: gestión por la clienta desde el link.

export async function rescheduleByClient(token: string, newSlotId: string, now = new Date()): Promise<Booking> {
  const found = requireBooking(await findBookingByToken(token));
  const tenant = await loadTenant();
  const { booking, previousWhen } = await moveToSlot(found.id, newSlotId, now, "client", (cur) => {
    if (!clientOptions(cur, now, tenant.skincare).canReschedule) {
      throw new UserError("Ya no se puede reprogramar esta reserva online. Escribinos por WhatsApp.");
    }
  });
  await Promise.all([
    notify("rescheduled", booking, { tenant, previousWhen }),
    notify("admin_rescheduled", booking, { tenant, previousWhen }),
  ]);
  return booking;
}

export async function cancelByClient(
  token: string,
  opts: { refund: true; destination: string } | { refund: false },
  now = new Date(),
): Promise<Booking> {
  const found = requireBooking(await findBookingByToken(token));
  const tenant = await loadTenant();
  let destination: string | undefined;
  if (opts.refund) {
    const d = refundDestinationSchema.safeParse(opts.destination);
    if (!d.success) throw new UserError(d.error.issues[0].message);
    destination = d.data;
  }
  const b = await db().runTransaction(async (tx) => {
    const cur = requireBooking(await txGetBooking(tx, found.id));
    const slot = cur.slotId ? await txGetSlot(tx, cur.slotId) : null;
    const options = clientOptions(cur, now, tenant.skincare);
    if (opts.refund && !options.canCancelWithRefund) {
      throw new UserError(`Faltan menos de ${tenant.skincare.cancellationWindowHours} hs para el turno: ya no se puede cancelar con reintegro.`);
    }
    if (!opts.refund && !options.canCancelForfeit) {
      throw new UserError("Esta reserva no se puede cancelar online. Escribinos por WhatsApp.");
    }
    let next = transition(cur, opts.refund ? "cancel_with_refund" : "cancel_forfeit", { at: now, by: "client" });
    if (destination) next = { ...next, deposit: { ...next.deposit, refundDestination: destination } };
    releaseSlot(tx, slot, cur.id);
    txSetBooking(tx, next);
    return next;
  });
  await Promise.all([
    notify("cancelled", b, { tenant }),
    notify("admin_cancelled", b, { tenant }),
    ...(b.deposit.status === "refund_pending" ? [notify("admin_refund_pending", b, { tenant })] : []),
  ]);
  return b;
}
