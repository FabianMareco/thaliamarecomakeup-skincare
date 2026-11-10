import type { Actor, Booking, BookingStatus, DepositStatus } from "./types";

// Máquina de estados de la reserva (sección 9 de la spec). Toda transición
// pasa por `transition`, que rechaza cualquier combinación no listada.

export type BookingEvent =
  | "approve_same_day" //       awaiting_approval → awaiting_payment
  | "accept_request" //         requested → awaiting_payment
  | "reject" //                 awaiting_approval | requested | awaiting_verification → rejected
  | "expire" //                 awaiting_approval | awaiting_payment → expired
  | "submit_receipt" //         awaiting_payment → awaiting_verification
  | "approve_receipt" //        awaiting_verification → confirmed
  | "request_resubmit" //       awaiting_verification → awaiting_payment
  | "complete" //               confirmed → completed
  | "mark_no_show" //           confirmed → no_show
  | "cancel_with_refund" //     confirmed → cancelled_refunded
  | "cancel_forfeit"; //        confirmed → cancelled_forfeited

const TABLE: Record<BookingEvent, { from: BookingStatus[]; to: BookingStatus; deposit?: DepositStatus }> = {
  approve_same_day: { from: ["awaiting_approval"], to: "awaiting_payment" },
  accept_request: { from: ["requested"], to: "awaiting_payment" },
  reject: { from: ["awaiting_approval", "requested", "awaiting_verification"], to: "rejected" },
  expire: { from: ["awaiting_approval", "awaiting_payment"], to: "expired" },
  submit_receipt: { from: ["awaiting_payment"], to: "awaiting_verification", deposit: "submitted" },
  approve_receipt: { from: ["awaiting_verification"], to: "confirmed", deposit: "verified" },
  request_resubmit: { from: ["awaiting_verification"], to: "awaiting_payment", deposit: "pending" },
  complete: { from: ["confirmed"], to: "completed" },
  mark_no_show: { from: ["confirmed"], to: "no_show", deposit: "forfeited" },
  cancel_with_refund: { from: ["confirmed"], to: "cancelled_refunded", deposit: "refund_pending" },
  cancel_forfeit: { from: ["confirmed"], to: "cancelled_forfeited", deposit: "forfeited" },
};

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: BookingStatus,
    public readonly event: BookingEvent,
  ) {
    super(`Transición inválida: ${event} desde ${from}`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(status: BookingStatus, event: BookingEvent): boolean {
  return TABLE[event].from.includes(status);
}

export function nextStatus(status: BookingStatus, event: BookingEvent): BookingStatus {
  if (!canTransition(status, event)) throw new InvalidTransitionError(status, event);
  return TABLE[event].to;
}

type TransitionCtx = { at: Date; by: Actor; note?: string };

/**
 * Aplica un evento a la reserva y devuelve una copia nueva con el estado,
 * el estado de la seña (si corresponde) y la entrada de historial.
 */
export function transition<B extends Pick<Booking, "status" | "deposit" | "history" | "updatedAt">>(
  booking: B,
  event: BookingEvent,
  ctx: TransitionCtx,
): B {
  const to = nextStatus(booking.status, event);
  const rule = TABLE[event];
  return {
    ...booking,
    status: to,
    deposit: rule.deposit ? { ...booking.deposit, status: rule.deposit } : booking.deposit,
    history: [
      ...booking.history,
      { at: ctx.at, from: booking.status, to, by: ctx.by, ...(ctx.note ? { note: ctx.note } : {}) },
    ],
    updatedAt: ctx.at,
  };
}

/** Estados en los que la reserva ocupa (o puede ocupar) su horario. */
export const ACTIVE_STATUSES: BookingStatus[] = [
  "awaiting_approval",
  "requested",
  "awaiting_payment",
  "awaiting_verification",
  "confirmed",
];

export const STATUS_LABEL: Record<BookingStatus, string> = {
  awaiting_approval: "Pendiente de aprobación",
  requested: "Solicitud recibida",
  awaiting_payment: "Esperando seña",
  awaiting_verification: "Comprobante en verificación",
  confirmed: "Confirmada",
  completed: "Realizada",
  no_show: "No asistió",
  cancelled_refunded: "Cancelada con reintegro",
  cancelled_forfeited: "Cancelada sin reintegro",
  rejected: "Rechazada",
  expired: "Vencida",
};

export const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  pending: "Pendiente",
  submitted: "Comprobante enviado",
  verified: "Verificada",
  refund_pending: "Reintegro pendiente",
  refunded: "Reintegrada",
  forfeited: "Retenida",
};
