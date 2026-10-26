import { clientOptions, refundDeadline, type ClientOptions } from "@/lib/domain/availability";
import type { Booking, BookingStatus, Line, Modality, Tenant } from "@/lib/domain/types";
import { paymentMethodFor, type PaymentStartResult } from "./payments";
import { findBookingByToken } from "./repo/bookings";
import { loadTenant } from "./repo/tenant";

// Datos que ven las clientas en las páginas de pago y de gestión. Nunca se
// expone la reserva completa: solo lo necesario para cada pantalla.

export type PublicBooking = {
  code: string;
  line: Line;
  status: BookingStatus;
  serviceName: string;
  servicePrice: number;
  startAt?: Date;
  modality?: Modality;
  makeup?: {
    eventDate: string;
    readyByTime: string;
    startTime?: string;
    location: "studio" | "home";
    trialDate?: string;
    trialTime?: string;
    finalPrice?: number;
    travelFee?: number;
    peopleCount: number;
  };
  depositAmount: number;
  depositStatus: Booking["deposit"]["status"];
  balanceAmount: number;
  approvalDeadline?: Date;
  rejectionReason?: string;
  refundDestination?: string;
};

function toPublic(b: Booking): PublicBooking {
  return {
    code: b.code,
    line: b.line,
    status: b.status,
    serviceName: b.service.name,
    servicePrice: b.service.price,
    startAt: b.startAt,
    modality: b.modality,
    makeup: b.makeup && {
      eventDate: b.makeup.eventDate,
      readyByTime: b.makeup.readyByTime,
      startTime: b.makeup.startTime,
      location: b.makeup.location,
      trialDate: b.makeup.trialDate,
      trialTime: b.makeup.trialTime,
      finalPrice: b.makeup.finalPrice,
      travelFee: b.makeup.travelFee,
      peopleCount: b.makeup.peopleCount,
    },
    depositAmount: b.deposit.amount,
    depositStatus: b.deposit.status,
    balanceAmount: b.balance.amount,
    approvalDeadline: b.approvalDeadline,
    rejectionReason: b.rejectionReason,
    refundDestination: b.deposit.refundDestination,
  };
}

export type PaymentView = {
  booking: PublicBooking;
  /** Datos para transferir: solo cuando la reserva espera el pago y el plazo sigue vigente. */
  payment: PaymentStartResult | null;
  expiredByDeadline: boolean;
  policy: string;
  whatsappNumber: string;
  publicZone: string;
};

export async function getPaymentView(token: string, now = new Date()): Promise<PaymentView | null> {
  const b = await findBookingByToken(token);
  if (!b) return null;
  return buildPaymentView(b, await loadTenant(), now);
}

function buildPaymentView(b: Booking, tenant: Tenant, now: Date): PaymentView {
  const deadline = b.deposit.receiptUploadDeadline;
  const expiredByDeadline = b.status === "awaiting_payment" && !!deadline && deadline.getTime() <= now.getTime();
  const payment =
    b.status === "awaiting_payment" && !expiredByDeadline
      ? paymentMethodFor(b).start(b, { bankTransfer: tenant.bankTransfer })
      : null;
  return {
    booking: toPublic(b),
    payment,
    expiredByDeadline,
    policy: b.line === "makeup" ? tenant.policies.makeup : tenant.policies.skincare,
    whatsappNumber: tenant.whatsappNumber,
    publicZone: tenant.publicZone,
  };
}

export type ManageView = PaymentView & {
  options: ClientOptions;
  refundDeadline?: Date;
  cancellationWindowHours: number;
  /** Dirección exacta: solo para reservas confirmadas de skincare presencial o maquillaje en estudio. */
  address?: string;
};

export async function getManageView(token: string, now = new Date()): Promise<ManageView | null> {
  const b = await findBookingByToken(token);
  if (!b) return null;
  const tenant = await loadTenant();
  const base = buildPaymentView(b, tenant, now);
  const showAddress =
    b.status === "confirmed" &&
    ((b.line === "skincare" && b.modality !== "virtual") || (b.line === "makeup" && b.makeup?.location === "studio"));
  return {
    ...base,
    options: clientOptions(b, now, tenant.skincare),
    refundDeadline: b.startAt && b.line === "skincare" ? refundDeadline(b.startAt, tenant.skincare.cancellationWindowHours) : undefined,
    cancellationWindowHours: tenant.skincare.cancellationWindowHours,
    address: showAddress ? tenant.privateAddress || undefined : undefined,
  };
}
