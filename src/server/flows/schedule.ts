import { addDaysStr, datesBetween, isValidDateStr, mondayOf } from "@/lib/domain/time";
import {
  copyWeek,
  findOverlap,
  generateFromTemplate,
  newOpenSlot,
  validateSlotInput,
  validateTemplate,
  type GenerationResult,
  type SlotInput,
} from "@/lib/domain/slots";
import type { Slot, Tenant } from "@/lib/domain/types";
import { cols, fromSnap, toData } from "../db";
import { UserError } from "../errors";
import { db } from "../firebase";
import { listSlotsBetween, slotRef } from "../repo/bookings";
import { loadTenant, setWeeklyTemplate } from "../repo/tenant";

// Sección 7: edición de la agenda de skincare desde el panel.

const MAX_RANGE_DAYS = 120;

function daySlotsQuery(date: string) {
  return cols.slots().where("date", "==", date);
}

export async function createSlot(input: SlotInput): Promise<Slot> {
  const err = validateSlotInput(input);
  if (err) throw new UserError(err);
  const slot = newOpenSlot(input);
  await db().runTransaction(async (tx) => {
    const day = (await tx.get(daySlotsQuery(input.date))).docs.map((d) => fromSnap<Slot>(d)!);
    if (day.some((s) => s.id === slot.id)) throw new UserError(`Ya existe un horario a las ${slot.time}.`);
    const clash = findOverlap(slot, day);
    if (clash) throw new UserError(`Se superpone con el horario de las ${clash.time} (${clash.durationMin} min).`);
    tx.create(slotRef(slot.id), toData(slot));
  });
  return slot;
}

function assertEditable(slot: Slot | null): Slot {
  if (!slot) throw new UserError("El horario no existe.");
  if (slot.status !== "open") {
    throw new UserError("Este horario tiene una reserva. Para liberarlo hay que cancelar, rechazar o reprogramar la reserva.");
  }
  return slot;
}

/** Edita hora, duración o modalidad de un horario libre (cambiar la hora cambia su id). */
export async function updateSlot(id: string, patch: Omit<SlotInput, "date">): Promise<Slot> {
  return db().runTransaction(async (tx) => {
    const cur = assertEditable(fromSnap<Slot>(await tx.get(slotRef(id))));
    const input = { date: cur.date, ...patch };
    const err = validateSlotInput(input);
    if (err) throw new UserError(err);
    const day = (await tx.get(daySlotsQuery(cur.date))).docs.map((d) => fromSnap<Slot>(d)!);
    const next = newOpenSlot(input);
    if (next.id !== cur.id && day.some((s) => s.id === next.id)) throw new UserError(`Ya existe un horario a las ${next.time}.`);
    const clash = findOverlap(next, day.filter((s) => s.id !== cur.id));
    if (clash) throw new UserError(`Se superpone con el horario de las ${clash.time} (${clash.durationMin} min).`);
    if (next.id !== cur.id) tx.delete(slotRef(cur.id));
    tx.set(slotRef(next.id), toData(next));
    return next;
  });
}

export async function deleteSlot(id: string): Promise<void> {
  await db().runTransaction(async (tx) => {
    assertEditable(fromSnap<Slot>(await tx.get(slotRef(id))));
    tx.delete(slotRef(id));
  });
}

/** Cerrar día: borra todos los horarios libres de esa fecha. */
export async function closeDay(date: string): Promise<{ deleted: number; kept: number }> {
  if (!isValidDateStr(date)) throw new UserError("Fecha inválida");
  return db().runTransaction(async (tx) => {
    const day = (await tx.get(daySlotsQuery(date))).docs.map((d) => fromSnap<Slot>(d)!);
    const open = day.filter((s) => s.status === "open");
    for (const s of open) tx.delete(slotRef(s.id));
    return { deleted: open.length, kept: day.length - open.length };
  });
}

/** Aplica el resultado de una generación semana por semana (límite de escrituras por transacción). */
async function applyGeneration(from: string, to: string, plan: (existing: Slot[], from: string, to: string) => GenerationResult) {
  const total: GenerationResult = { toCreate: [], skipped: [] };
  for (let weekStart = from; weekStart <= to; weekStart = addDaysStr(weekStart, 7)) {
    const weekEnd = addDaysStr(weekStart, 6) < to ? addDaysStr(weekStart, 6) : to;
    const r = await db().runTransaction(async (tx) => {
      const snap = await tx.get(cols.slots().where("date", ">=", weekStart).where("date", "<=", weekEnd));
      const existing = snap.docs.map((d) => fromSnap<Slot>(d)!);
      const result = plan(existing, weekStart, weekEnd);
      for (const s of result.toCreate) tx.create(slotRef(s.id), toData(s));
      return result;
    });
    total.toCreate.push(...r.toCreate);
    total.skipped.push(...r.skipped);
  }
  return total;
}

/** Genera los horarios de la plantilla semanal en un rango de fechas. */
export async function generateRange(from: string, to: string): Promise<GenerationResult> {
  if (!isValidDateStr(from) || !isValidDateStr(to) || from > to) throw new UserError("Rango de fechas inválido");
  if (datesBetween(from, to).length > MAX_RANGE_DAYS) throw new UserError(`El rango puede tener como máximo ${MAX_RANGE_DAYS} días.`);
  const tenant = await loadTenant();
  return applyGeneration(from, to, (existing, f, t) => generateFromTemplate(tenant.weeklyTemplate, f, t, existing));
}

/** Copia los horarios de la semana anterior a la semana que empieza el lunes de `date`. */
export async function copyPreviousWeek(date: string): Promise<GenerationResult> {
  if (!isValidDateStr(date)) throw new UserError("Fecha inválida");
  const monday = mondayOf(date);
  const previous = await listSlotsBetween(addDaysStr(monday, -7), addDaysStr(monday, -1));
  return applyGeneration(monday, addDaysStr(monday, 6), (existing) => copyWeek(previous, existing));
}

export async function saveWeeklyTemplate(template: Tenant["weeklyTemplate"]): Promise<void> {
  const err = validateTemplate(template);
  if (err) throw new UserError(err);
  await setWeeklyTemplate(template);
}
