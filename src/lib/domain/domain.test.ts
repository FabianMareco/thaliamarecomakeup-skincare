import { describe, expect, it } from "vitest";
import {
  approvalDeadline,
  clientOptions,
  isBookable,
  isCompatible,
  isOutsideCancellationWindow,
  isSameDay,
  isSlotFree,
  refundDeadline,
} from "./availability";
import { makeupDeposit, skincareDeposit } from "./money";
import { normalizePhone } from "./phone";
import { validateReceipt, MAX_RECEIPT_BYTES } from "./receipts";
import { dueReminderOffsets, offsetsToMarkSent } from "./reminders";
import { copyWeek, generateFromTemplate, newOpenSlot, overlaps, validateTemplate } from "./slots";
import { addDaysStr, arDateStr, arLocalToInstant, arTimeStr, mondayOf, weekdayOf } from "./time";
import { canTransition, InvalidTransitionError, transition, type BookingEvent } from "./transitions";
import type { Booking, BookingStatus, TemplateSlot, Weekday } from "./types";
import { eventInterval } from "./makeup";

const H = 3600_000;
const M = 60_000;

describe("time (hora argentina explícita)", () => {
  it("convierte fecha y hora local AR a instante UTC-3", () => {
    expect(arLocalToInstant("2026-11-02", "09:00").toISOString()).toBe("2026-11-02T12:00:00.000Z");
  });
  it("formatea en hora AR independientemente de la zona del servidor", () => {
    const at = new Date("2026-11-03T02:30:00Z"); // 23:30 del 2/11 en AR
    expect(arDateStr(at)).toBe("2026-11-02");
    expect(arTimeStr(at)).toBe("23:30");
  });
  it("día de semana, lunes y suma de días", () => {
    expect(weekdayOf("2026-11-02")).toBe("mon");
    expect(weekdayOf("2026-11-08")).toBe("sun");
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    expect(addDaysStr("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("seña", () => {
  it("skincare: seña fija, nunca mayor al precio", () => {
    expect(skincareDeposit(50000, 20000)).toEqual({ deposit: 20000, balance: 30000 });
    expect(skincareDeposit(20000, 20000)).toEqual({ deposit: 20000, balance: 0 });
    expect(skincareDeposit(15000, 20000)).toEqual({ deposit: 15000, balance: 0 });
  });
  it("makeup: 50 % del precio, el viático va al saldo y no a la seña", () => {
    expect(makeupDeposit(240000, 50)).toEqual({ deposit: 120000, balance: 120000 });
    expect(makeupDeposit(240000, 50, 15000)).toEqual({ deposit: 120000, balance: 135000 });
    expect(makeupDeposit(150001, 50).deposit).toBe(75001);
  });
});

describe("transiciones de estado", () => {
  const base = {
    status: "awaiting_payment" as BookingStatus,
    deposit: { amount: 20000, method: "bank_transfer" as const, status: "pending" as const, receipts: [] },
    history: [],
    updatedAt: new Date(0),
  };
  const at = new Date("2026-11-01T12:00:00Z");

  it("aplica una transición válida, actualiza la seña y registra historial", () => {
    const b = transition(base, "submit_receipt", { at, by: "client" });
    expect(b.status).toBe("awaiting_verification");
    expect(b.deposit.status).toBe("submitted");
    expect(b.history).toEqual([{ at, from: "awaiting_payment", to: "awaiting_verification", by: "client" }]);
    expect(base.status).toBe("awaiting_payment"); // no muta
  });

  it("acepta exactamente las transiciones de la tabla y rechaza el resto", () => {
    const allowed: Record<string, BookingStatus[]> = {
      awaiting_approval: ["awaiting_payment", "rejected", "expired"],
      requested: ["awaiting_payment", "rejected"],
      awaiting_payment: ["awaiting_verification", "expired"],
      awaiting_verification: ["confirmed", "awaiting_payment", "rejected"],
      confirmed: ["completed", "no_show", "cancelled_refunded", "cancelled_forfeited"],
      completed: [],
      no_show: [],
      cancelled_refunded: [],
      cancelled_forfeited: [],
      rejected: [],
      expired: [],
    };
    const events: BookingEvent[] = [
      "approve_same_day", "accept_request", "reject", "expire", "submit_receipt", "approve_receipt",
      "request_resubmit", "complete", "mark_no_show", "cancel_with_refund", "cancel_forfeit",
    ];
    for (const [from, tos] of Object.entries(allowed)) {
      const reached = new Set<BookingStatus>();
      for (const e of events) {
        const b = { ...base, status: from as BookingStatus };
        if (canTransition(b.status, e)) reached.add(transition(b, e, { at, by: "admin" }).status);
        else expect(() => transition(b, e, { at, by: "admin" })).toThrow(InvalidTransitionError);
      }
      expect([...reached].sort()).toEqual([...tos].sort());
    }
  });

  it("no_show retiene la seña; cancelar con reintegro la deja pendiente de reintegro", () => {
    const c = { ...base, status: "confirmed" as BookingStatus };
    expect(transition(c, "mark_no_show", { at, by: "admin" }).deposit.status).toBe("forfeited");
    expect(transition(c, "cancel_with_refund", { at, by: "client" }).deposit.status).toBe("refund_pending");
    expect(transition(c, "cancel_forfeit", { at, by: "client" }).deposit.status).toBe("forfeited");
  });
});

describe("disponibilidad", () => {
  const now = new Date("2026-11-02T12:00:00Z"); // lunes 09:00 AR
  const slot = newOpenSlot({ date: "2026-11-05", time: "11:00", durationMin: 120, modality: "in_person" });
  const svc = { durationMin: 120, modality: "in_person" as const };

  it("libre: open o held vencido; no libre: held vigente, held en verificación (null) o booked", () => {
    expect(isSlotFree({ status: "open", heldUntil: null }, now)).toBe(true);
    expect(isSlotFree({ status: "held", heldUntil: new Date(now.getTime() - 1) }, now)).toBe(true);
    expect(isSlotFree({ status: "held", heldUntil: new Date(now.getTime() + M) }, now)).toBe(false);
    expect(isSlotFree({ status: "held", heldUntil: null }, now)).toBe(false);
    expect(isSlotFree({ status: "booked", heldUntil: null }, now)).toBe(false);
  });

  it("compatibilidad por duración y modalidad", () => {
    expect(isCompatible(slot, svc)).toBe(true);
    expect(isCompatible(slot, { durationMin: 60, modality: "in_person" })).toBe(true);
    expect(isCompatible({ ...slot, durationMin: 60 }, svc)).toBe(false);
    expect(isCompatible(slot, { durationMin: 40, modality: "virtual" })).toBe(false);
  });

  it("no se muestran horarios pasados ni más allá del horizonte", () => {
    expect(isBookable(slot, svc, now, 90)).toBe(true);
    const past = newOpenSlot({ date: "2026-11-02", time: "08:00", durationMin: 120, modality: "in_person" });
    expect(isBookable(past, svc, now, 90)).toBe(false);
    const far = newOpenSlot({ date: addDaysStr("2026-11-02", 91), time: "09:00", durationMin: 120, modality: "in_person" });
    expect(isBookable(far, svc, now, 90)).toBe(false);
    const edge = newOpenSlot({ date: addDaysStr("2026-11-02", 90), time: "09:00", durationMin: 120, modality: "in_person" });
    expect(isBookable(edge, svc, now, 90)).toBe(true);
  });

  it("mismo día según la fecha en hora argentina", () => {
    const lateNight = new Date("2026-11-03T02:00:00Z"); // 23:00 del 2/11 en AR
    expect(isSameDay("2026-11-02", lateNight)).toBe(true);
    expect(isSameDay("2026-11-03", lateNight)).toBe(false);
  });

  it("plazo de aprobación: el menor entre now + timeout y 30 min antes del turno", () => {
    const start = new Date(now.getTime() + 5 * H);
    expect(approvalDeadline(now, start, 120).getTime()).toBe(now.getTime() + 120 * M);
    const soon = new Date(now.getTime() + 90 * M);
    expect(approvalDeadline(now, soon, 120).getTime()).toBe(now.getTime() + 60 * M);
  });
});

describe("regla de 48 hs (bordes, hora argentina)", () => {
  const startAt = arLocalToInstant("2026-11-10", "09:00");
  const cfg = { cancellationWindowHours: 48, maxSelfReschedules: 1 };
  const booking = { status: "confirmed" as BookingStatus, line: "skincare" as const, startAt, rescheduleCount: 0 };

  it("48:00 antes → reintegro o reprogramación", () => {
    const now = arLocalToInstant("2026-11-08", "09:00");
    expect(isOutsideCancellationWindow(startAt, now, 48)).toBe(true);
    expect(clientOptions(booking, now, cfg)).toEqual({
      canReschedule: true, canCancelWithRefund: true, canCancelForfeit: false, reschedulesLeft: 1,
    });
  });

  it("47:59 antes → solo cancelar sin reintegro", () => {
    const now = arLocalToInstant("2026-11-08", "09:01");
    expect(isOutsideCancellationWindow(startAt, now, 48)).toBe(false);
    expect(clientOptions(booking, now, cfg)).toMatchObject({
      canReschedule: false, canCancelWithRefund: false, canCancelForfeit: true,
    });
  });

  it("límite de reprogramaciones", () => {
    const now = arLocalToInstant("2026-11-01", "09:00");
    expect(clientOptions({ ...booking, rescheduleCount: 1 }, now, cfg)).toMatchObject({
      canReschedule: false, canCancelWithRefund: true, reschedulesLeft: 0,
    });
  });

  it("fecha límite para reintegro", () => {
    expect(refundDeadline(startAt, 48).toISOString()).toBe(arLocalToInstant("2026-11-08", "09:00").toISOString());
  });

  it("makeup o reservas no confirmadas no tienen autogestión", () => {
    const now = arLocalToInstant("2026-11-01", "09:00");
    expect(clientOptions({ ...booking, line: "makeup" }, now, cfg).canCancelWithRefund).toBe(false);
    expect(clientOptions({ ...booking, status: "awaiting_payment" }, now, cfg).canCancelWithRefund).toBe(false);
  });
});

describe("agenda", () => {
  const tpl = (slots: TemplateSlot[]): Record<Weekday, TemplateSlot[]> => ({
    mon: slots, tue: slots, wed: [], thu: [], fri: [], sat: [], sun: [],
  });
  const t9: TemplateSlot = { time: "09:00", durationMin: 120, modality: "in_person" };
  const t11: TemplateSlot = { time: "11:00", durationMin: 120, modality: "in_person" };

  it("detecta superposición (borde exacto no se superpone)", () => {
    const a = newOpenSlot({ date: "2026-11-02", time: "09:00", durationMin: 120, modality: "in_person" });
    const b = newOpenSlot({ date: "2026-11-02", time: "11:00", durationMin: 60, modality: "in_person" });
    const c = newOpenSlot({ date: "2026-11-02", time: "10:30", durationMin: 60, modality: "in_person" });
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(a, c)).toBe(true);
  });

  it("genera por rango según el día de semana y saltea superposiciones", () => {
    const existing = [newOpenSlot({ date: "2026-11-03", time: "10:00", durationMin: 60, modality: "in_person" })];
    const r = generateFromTemplate(tpl([t9, t11]), "2026-11-02", "2026-11-08", existing);
    expect(r.toCreate.map((s) => s.id)).toEqual(["2026-11-02_0900", "2026-11-02_1100", "2026-11-03_1100"]);
    expect(r.skipped.map((s) => s.slot.id)).toEqual(["2026-11-03_0900"]);
  });

  it("copia la semana anterior como horarios libres", () => {
    const prev = [{ ...newOpenSlot({ date: "2026-10-26", time: "09:00", durationMin: 120, modality: "in_person" }), status: "booked" as const, bookingId: "x" }];
    const r = copyWeek(prev, []);
    expect(r.toCreate).toHaveLength(1);
    expect(r.toCreate[0]).toMatchObject({ id: "2026-11-02_0900", status: "open", bookingId: null });
  });

  it("valida plantillas sin superposiciones", () => {
    expect(validateTemplate(tpl([t9, t11]))).toBeNull();
    expect(validateTemplate(tpl([t9, { ...t11, time: "10:00" }]))).toMatch(/superpone/);
  });
});

describe("recordatorios", () => {
  const startAt = arLocalToInstant("2026-11-10", "09:00");
  const b = (createdAt: Date, sent: Record<string, Date> = {}) => ({
    status: "confirmed" as BookingStatus, startAt, createdAt, remindersSent: sent,
  });

  it("envía 72 hs y 24 hs cuando corresponde", () => {
    const created = new Date(startAt.getTime() - 10 * 24 * H);
    expect(dueReminderOffsets(b(created), [72, 24], new Date(startAt.getTime() - 80 * H))).toEqual([]);
    expect(dueReminderOffsets(b(created), [72, 24], new Date(startAt.getTime() - 72 * H))).toEqual([72]);
    expect(dueReminderOffsets(b(created, { "72": new Date() }), [72, 24], new Date(startAt.getTime() - 70 * H))).toEqual([]);
    expect(dueReminderOffsets(b(created, { "72": new Date() }), [72, 24], new Date(startAt.getTime() - 23 * H))).toEqual([24]);
  });

  it("una reserva hecha 30 hs antes no recibe el de 72 hs", () => {
    const created = new Date(startAt.getTime() - 30 * H);
    expect(dueReminderOffsets(b(created), [72, 24], new Date(startAt.getTime() - 29 * H))).toEqual([]);
    expect(dueReminderOffsets(b(created), [72, 24], new Date(startAt.getTime() - 24 * H))).toEqual([24]);
  });

  it("si se saltearon ejecuciones, manda solo el más cercano y marca los mayores", () => {
    const created = new Date(startAt.getTime() - 10 * 24 * H);
    expect(dueReminderOffsets(b(created), [72, 24], new Date(startAt.getTime() - 20 * H))).toEqual([24]);
    expect(offsetsToMarkSent(24, [72, 24])).toEqual([72, 24]);
  });

  it("no envía si no está confirmada o ya empezó", () => {
    const created = new Date(startAt.getTime() - 10 * 24 * H);
    expect(dueReminderOffsets({ ...b(created), status: "cancelled_refunded" }, [24], new Date(startAt.getTime() - 20 * H))).toEqual([]);
    expect(dueReminderOffsets(b(created), [24], new Date(startAt.getTime() + M))).toEqual([]);
  });
});

describe("comprobantes", () => {
  const pad = (head: number[]) => new Uint8Array([...head, ...new Array(20).fill(0)]);
  it("acepta JPG, PNG, WEBP y PDF por su contenido", () => {
    expect(validateReceipt(pad([0xff, 0xd8, 0xff, 0xe0]))).toMatchObject({ ok: true, kind: { ext: "jpg" } });
    expect(validateReceipt(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toMatchObject({ ok: true, kind: { ext: "png" } });
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(validateReceipt(webp)).toMatchObject({ ok: true, kind: { ext: "webp" } });
    expect(validateReceipt(new TextEncoder().encode("%PDF-1.7\n..."))).toMatchObject({ ok: true, kind: { ext: "pdf" } });
  });
  it("rechaza otros tipos aunque tengan extensión válida, y archivos de más de 5 MB", () => {
    expect(validateReceipt(new TextEncoder().encode("<html>no soy un jpg</html>")).ok).toBe(false);
    expect(validateReceipt(new Uint8Array(0)).ok).toBe(false);
    const big = new Uint8Array(MAX_RECEIPT_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(validateReceipt(big)).toEqual({ ok: false, error: "El archivo supera los 5 MB." });
  });
});

describe("teléfonos", () => {
  it.each([
    ["11 5847-0009", "+5491158470009"],
    ["1158470009", "+5491158470009"],
    ["011 15 5847-0009", "+5491158470009"],
    ["+54 9 11 5847 0009", "+5491158470009"],
    ["+54 11 5847 0009", "+5491158470009"],
    ["5491158470009", "+5491158470009"],
    ["0221 15 412-3456", "+5492214123456"],
    ["+598 99 123 456", "+59899123456"],
  ])("%s → %s", (input, out) => {
    expect(normalizePhone(input)).toBe(out);
  });
  it("rechaza números inválidos", () => {
    expect(normalizePhone("1234")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("makeup", () => {
  it("ventana del evento desde el inicio hasta la hora de estar lista", () => {
    const w = eventInterval("2026-12-05", "16:00", "18:30");
    expect((w.endAt.getTime() - w.startAt.getTime()) / M).toBe(150);
  });
});

// Asegura que el tipo Booking siga siendo compatible con transition().
export const _typecheck = (b: Booking) => transition(b, "complete", { at: new Date(), by: "admin" });
