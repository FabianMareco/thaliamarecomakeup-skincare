import { transition } from "@/lib/domain/transitions";
import type { Actor, BankTransfer, Booking, Receipt } from "@/lib/domain/types";

// Medio de cobro de la seña (sección 10.4). Los flujos solo conocen esta
// interfaz; hoy existe una única implementación: transferencia con
// verificación manual. A futuro se puede sumar "mercadopago_checkout".

export type PaymentStartResult = {
  kind: "bank_transfer";
  amount: number;
  deadline?: Date;
  holderName: string;
  alias: string;
  cvu: string;
  provider: string;
  resubmitReason?: string;
};

export type PaymentEvidence = {
  kind: "receipt";
  receipt: Receipt;
  by: Actor;
};

export type RefundResult = { kind: "manual"; amount: number; destination?: string };

export interface PaymentMethod {
  id: "bank_transfer";
  /** Qué ve la clienta para pagar. */
  start(booking: Booking, ctx: { bankTransfer: BankTransfer }): PaymentStartResult;
  /** Registra la evidencia del pago y pasa la reserva a verificación. */
  confirm(booking: Booking, evidence: PaymentEvidence, at: Date): Booking;
  /** Cómo se reintegra. */
  refund(booking: Booking): RefundResult;
}

export const bankTransfer: PaymentMethod = {
  id: "bank_transfer",
  start(booking, { bankTransfer }) {
    return {
      kind: "bank_transfer",
      amount: booking.deposit.amount,
      deadline: booking.deposit.receiptUploadDeadline,
      resubmitReason: booking.deposit.resubmitReason,
      ...bankTransfer,
    };
  },
  confirm(booking, evidence, at) {
    const withReceipt: Booking = {
      ...booking,
      deposit: { ...booking.deposit, receipts: [...booking.deposit.receipts, evidence.receipt], resubmitReason: undefined },
    };
    return transition(withReceipt, "submit_receipt", { at, by: evidence.by });
  },
  refund(booking) {
    // Reintegro siempre manual: Thalia transfiere y lo marca en el panel.
    return { kind: "manual", amount: booking.deposit.amount, destination: booking.deposit.refundDestination };
  },
};

export function paymentMethodFor(booking: Pick<Booking, "deposit">): PaymentMethod {
  switch (booking.deposit.method) {
    case "bank_transfer":
      return bankTransfer;
  }
}
