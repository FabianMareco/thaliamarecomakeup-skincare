"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { validateTemplate } from "@/lib/domain/slots";
import { isValidTimeStr } from "@/lib/domain/time";
import { WEEKDAYS, type Service, type Tenant } from "@/lib/domain/types";
import type { AcceptMakeupInput } from "@/lib/schemas";
import { assertAdmin, createSession, destroySession } from "@/server/auth";
import { toResult, UserError, type ActionResult } from "@/server/errors";
import {
  adminCancel,
  adminReschedule,
  approveReceipt,
  approveSameDay,
  confirmDepositManually,
  markAttendance,
  markRefunded,
  markRefundPending,
  registerBalance,
  rejectBooking,
  requestResubmit,
  saveInternalNotes,
} from "@/server/flows/admin";
import { acceptMakeup, type OverlapWarning } from "@/server/flows/makeup";
import { closeDay, copyPreviousWeek, createSlot, deleteSlot, generateRange, saveWeeklyTemplate, updateSlot } from "@/server/flows/schedule";
import { availabilityFor, type AvailabilityDay } from "@/server/flows/skincare";
import { arDateStr } from "@/lib/domain/time";
import { getBooking } from "@/server/repo/bookings";
import { getService, newServiceId, saveService } from "@/server/repo/services";
import { loadTenant, updateTenant } from "@/server/repo/tenant";

// Acciones del panel. Todas verifican la sesión de administradora.

async function admin<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  const r = await toResult(async () => {
    await assertAdmin();
    return fn();
  });
  if (r.ok) refresh();
  return r;
}

const id = (v: unknown) => {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(v)) throw new UserError("Identificador inválido");
  return v;
};

// ---- Sesión ----

export async function loginAction(idToken: string): Promise<ActionResult> {
  return toResult(async () => {
    await createSession(String(idToken));
    return undefined;
  });
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/panel/login");
}

// ---- Reservas ----

export const approveReceiptAction = async (bookingId: string) => admin(async () => void (await approveReceipt(id(bookingId))));
export const resubmitAction = async (bookingId: string, reason: string) =>
  admin(async () => void (await requestResubmit(id(bookingId), String(reason))));
export const rejectAction = async (bookingId: string, reason: string) =>
  admin(async () => void (await rejectBooking(id(bookingId), String(reason ?? ""))));
export const approveSameDayAction = async (bookingId: string) => admin(async () => void (await approveSameDay(id(bookingId))));

export async function acceptMakeupAction(
  bookingId: string,
  input: AcceptMakeupInput,
): Promise<ActionResult<{ accepted: boolean; warnings: OverlapWarning[] }>> {
  return admin(async () => {
    const r = await acceptMakeup(id(bookingId), input);
    return r.accepted ? { accepted: true, warnings: [] } : { accepted: false, warnings: r.warnings };
  });
}

export async function confirmManualAction(bookingId: string, form: FormData): Promise<ActionResult> {
  return admin(async () => {
    const file = form.get("file");
    const bytes = file instanceof Blob && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : undefined;
    await confirmDepositManually(id(bookingId), { payerName: String(form.get("payerName") ?? ""), file: bytes });
    return undefined;
  });
}

export async function rescheduleOptionsAction(bookingId: string): Promise<ActionResult<{ days: AvailabilityDay[]; today: string }>> {
  return toResult(async () => {
    await assertAdmin();
    const b = await getBooking(id(bookingId));
    if (!b || b.line !== "skincare") throw new UserError("Solo se pueden reprogramar turnos de skincare.");
    const now = new Date();
    const days = await availabilityFor({ durationMin: b.service.durationMin, modality: b.modality ?? "in_person" }, now, 365, b.slotId);
    return { days, today: arDateStr(now) };
  });
}

export const rescheduleAction = async (bookingId: string, slotId: string) =>
  admin(async () => void (await adminReschedule(id(bookingId), id(slotId))));
export const cancelAction = async (bookingId: string, refund: boolean, destination?: string) =>
  admin(async () => void (await adminCancel(id(bookingId), { refund: !!refund, destination: destination ? String(destination) : undefined })));
export const refundPendingAction = async (bookingId: string, destination: string) =>
  admin(async () => void (await markRefundPending(id(bookingId), String(destination))));
export const markRefundedAction = async (bookingId: string) => admin(async () => void (await markRefunded(id(bookingId))));
export const attendanceAction = async (bookingId: string, attended: boolean) =>
  admin(async () => void (await markAttendance(id(bookingId), !!attended)));
export const balanceAction = async (bookingId: string, method: string) =>
  admin(async () => void (await registerBalance(id(bookingId), String(method ?? ""))));
export const notesAction = async (bookingId: string, notes: string) =>
  admin(async () => void (await saveInternalNotes(id(bookingId), String(notes ?? ""))));

// ---- Horarios ----

const slotInput = z.object({
  date: z.string(),
  time: z.string(),
  durationMin: z.coerce.number().int(),
  modality: z.enum(["in_person", "virtual"]),
});

export const createSlotAction = async (input: z.input<typeof slotInput>) =>
  admin(async () => void (await createSlot(slotInput.parse(input))));
export const updateSlotAction = async (slotId: string, input: Omit<z.input<typeof slotInput>, "date">) =>
  admin(async () => void (await updateSlot(id(slotId), slotInput.omit({ date: true }).parse(input))));
export const deleteSlotAction = async (slotId: string) => admin(async () => void (await deleteSlot(id(slotId))));
export const closeDayAction = async (date: string) => admin(async () => closeDay(String(date)));

export async function generateRangeAction(from: string, to: string) {
  return admin(async () => {
    const r = await generateRange(String(from), String(to));
    return { created: r.toCreate.length, skipped: r.skipped.length };
  });
}

export async function copyWeekAction(date: string) {
  return admin(async () => {
    const r = await copyPreviousWeek(String(date));
    return { created: r.toCreate.length, skipped: r.skipped.length };
  });
}

const templateDay = z.array(
  z.object({
    time: z.string().refine(isValidTimeStr, "Hora inválida"),
    durationMin: z.coerce.number().int().min(10).max(600),
    modality: z.enum(["in_person", "virtual"]),
  }),
);
const templateSchema = z.object({
  mon: templateDay,
  tue: templateDay,
  wed: templateDay,
  thu: templateDay,
  fri: templateDay,
  sat: templateDay,
  sun: templateDay,
});

export async function saveTemplateAction(template: Tenant["weeklyTemplate"]) {
  return admin(async () => {
    const parsed = templateSchema.safeParse(template);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const t: Tenant["weeklyTemplate"] = parsed.data;
    for (const d of WEEKDAYS) t[d].sort((a, b) => a.time.localeCompare(b.time));
    const err = validateTemplate(t);
    if (err) throw new UserError(err);
    await saveWeeklyTemplate(t);
  });
}

// ---- Servicios ----

const serviceSchema = z.object({
  id: z.string().optional(),
  line: z.enum(["skincare", "makeup"]),
  category: z.string().trim().min(1, "Indicá la categoría").max(60),
  name: z.string().trim().min(2, "Indicá el nombre").max(120),
  description: z.string().trim().max(500).optional(),
  badge: z.string().trim().max(40).optional(),
  price: z.coerce.number().int().min(0),
  durationMin: z.coerce.number().int().min(10).max(600).optional(),
  modality: z.enum(["in_person", "virtual"]),
  includesTrial: z.boolean().optional(),
  active: z.boolean(),
  order: z.coerce.number().int(),
});

export async function saveServiceAction(input: z.input<typeof serviceSchema>) {
  return admin(async () => {
    const p = serviceSchema.safeParse(input);
    if (!p.success) throw new UserError(p.error.issues[0].message);
    const s = p.data;
    if (s.line === "skincare" && !s.durationMin) throw new UserError("Los servicios de skincare necesitan duración.");
    const existing = s.id ? await getService(id(s.id)) : null;
    const service: Service = {
      ...s,
      id: existing?.id ?? newServiceId(),
      description: s.description || undefined,
      badge: s.badge || undefined,
      durationMin: s.line === "skincare" ? s.durationMin : undefined,
      modality: s.line === "makeup" ? "in_person" : s.modality,
      includesTrial: s.line === "makeup" ? !!s.includesTrial : undefined,
    };
    await saveService(service);
  });
}

// ---- Configuración ----

const intMin = (min: number) => z.coerce.number().int().min(min);
const configSchema = z.object({
  name: z.string().trim().min(1),
  whatsappNumber: z.string().trim().regex(/^\+\d{8,15}$/, "El WhatsApp tiene que estar en formato +5491100000000"),
  publicZone: z.string().trim().min(1),
  privateAddress: z.string().trim().max(200),
  notificationEmail: z.union([z.literal(""), z.email("Email de avisos inválido")]),
  bankTransfer: z.object({
    holderName: z.string().trim().min(1),
    alias: z.string().trim().min(1),
    cvu: z.string().trim().regex(/^\d{22}$/, "El CVU/CBU tiene 22 dígitos"),
    provider: z.string().trim().min(1),
  }),
  skincare: z.object({
    depositAmount: intMin(0),
    cancellationWindowHours: intMin(1),
    receiptUploadMinutes: intMin(5),
    bookingHorizonDays: intMin(1).max(365),
    sameDayRequiresApproval: z.boolean(),
    sameDayApprovalTimeoutMinutes: intMin(10),
    maxSelfReschedules: intMin(0),
    reminderOffsetsHours: z.array(intMin(1)).max(5),
  }),
  makeup: z.object({
    depositPercent: intMin(0).max(100),
    receiptUploadHours: intMin(1),
    reminderOffsetsHours: z.array(intMin(1)).max(5),
  }),
  verificationReminderMinutes: intMin(5),
  policies: z.object({ skincare: z.string().trim().min(1).max(3000), makeup: z.string().trim().min(1).max(3000) }),
});

export type ConfigInput = z.input<typeof configSchema>;

export async function saveConfigAction(input: ConfigInput) {
  return admin(async () => {
    const p = configSchema.safeParse(input);
    if (!p.success) throw new UserError(p.error.issues[0].message);
    const current = await loadTenant();
    const next: Partial<Tenant> = {
      ...p.data,
      skincare: { ...p.data.skincare, reminderOffsetsHours: [...new Set(p.data.skincare.reminderOffsetsHours)].sort((a, b) => b - a) },
      makeup: { ...p.data.makeup, reminderOffsetsHours: [...new Set(p.data.makeup.reminderOffsetsHours)].sort((a, b) => b - a) },
      timezone: current.timezone,
    };
    await updateTenant(next);
  });
}
