// Tipos del dominio. Las fechas son `Date` (instantes absolutos); la capa de
// datos convierte de/a Timestamp de Firestore. Montos en ARS enteros.

export type Line = "skincare" | "makeup";
export type Modality = "in_person" | "virtual";
export type Actor = "client" | "admin" | "system";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export type TemplateSlot = { time: string; durationMin: number; modality: Modality };

export type BankTransfer = {
  holderName: string;
  alias: string;
  cvu: string;
  provider: string;
};

export type Tenant = {
  name: string;
  whatsappNumber: string;
  publicZone: string;
  privateAddress: string;
  notificationEmail: string;
  timezone: string;
  bankTransfer: BankTransfer;
  skincare: {
    depositAmount: number;
    cancellationWindowHours: number;
    receiptUploadMinutes: number;
    bookingHorizonDays: number;
    sameDayRequiresApproval: boolean;
    sameDayApprovalTimeoutMinutes: number;
    maxSelfReschedules: number;
    reminderOffsetsHours: number[];
  };
  makeup: {
    depositPercent: number;
    receiptUploadHours: number;
    reminderOffsetsHours: number[];
  };
  verificationReminderMinutes: number;
  weeklyTemplate: Record<Weekday, TemplateSlot[]>;
  policies: { skincare: string; makeup: string };
};

export type Service = {
  id: string;
  line: Line;
  category: string;
  name: string;
  description?: string;
  badge?: string;
  price: number;
  durationMin?: number;
  modality: Modality;
  includesTrial?: boolean;
  active: boolean;
  order: number;
};

export type SlotStatus = "open" | "held" | "booked";

export type Slot = {
  id: string;
  date: string; // YYYY-MM-DD (hora AR)
  time: string; // HH:mm
  startAt: Date;
  endAt: Date;
  durationMin: number;
  modality: Modality;
  status: SlotStatus;
  bookingId: string | null;
  heldUntil: Date | null;
};

export type BookingStatus =
  | "awaiting_approval"
  | "requested"
  | "awaiting_payment"
  | "awaiting_verification"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled_refunded"
  | "cancelled_forfeited"
  | "rejected"
  | "expired";

export type DepositStatus =
  | "pending"
  | "submitted"
  | "verified"
  | "refund_pending"
  | "refunded"
  | "forfeited";

export type Receipt = {
  path: string;
  uploadedAt: Date;
  payerName: string;
  contentType?: string;
  reviewedAt?: Date;
  result?: "approved" | "rejected";
  rejectionReason?: string;
  adminRemindedAt?: Date;
  source?: "client" | "admin";
};

export type HistoryEntry = {
  at: Date;
  from: string;
  to: string;
  by: Actor;
  note?: string;
};

export type MakeupDetails = {
  eventDate: string;
  readyByTime: string;
  location: "studio" | "home";
  homeAddress?: string;
  peopleCount: number;
  comments?: string;
  preferredTrialDate?: string;
  finalPrice?: number;
  travelFee?: number;
  startTime?: string;
  trialDate?: string;
  trialTime?: string;
  rejectionMessage?: string;
};

export type Booking = {
  id: string;
  code: string;
  line: Line;
  status: BookingStatus;
  service: { id: string; name: string; price: number; durationMin?: number };
  slotId?: string;
  startAt?: Date;
  date?: string;
  time?: string;
  modality?: Modality;
  clientId: string;
  client: { name: string; phone: string; email: string; firstVisit: boolean };
  deposit: {
    amount: number;
    method: "bank_transfer";
    status: DepositStatus;
    receiptUploadDeadline?: Date;
    resubmitReason?: string;
    receipts: Receipt[];
    verifiedAt?: Date;
    refundDestination?: string;
    refundedAt?: Date;
  };
  balance: { amount: number; paidAt?: Date; method?: string };
  makeup?: MakeupDetails;
  manageTokenHash: string;
  rescheduleCount: number;
  attendance: "attended" | "no_show" | null;
  approvalDeadline?: Date;
  remindersSent: Record<string, Date>;
  history: HistoryEntry[];
  internalNotes?: string;
  rejectionReason?: string;
  clientIpHash?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  firstSeenAt: Date;
  lastBookingAt: Date;
  bookingsCount: number;
  noShowCount: number;
};
