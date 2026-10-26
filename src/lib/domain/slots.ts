import { addDaysStr, arLocalToInstant, datesBetween, isValidDateStr, isValidTimeStr, weekdayOf } from "./time";
import type { Modality, Slot, TemplateSlot, Weekday } from "./types";

// Agenda de skincare (sección 7): ids, superposición y generación por plantilla.

export function slotIdFor(date: string, time: string): string {
  return `${date}_${time.replace(":", "")}`;
}

export type SlotInput = { date: string; time: string; durationMin: number; modality: Modality };

export function validateSlotInput(input: SlotInput): string | null {
  if (!isValidDateStr(input.date)) return "Fecha inválida";
  if (!isValidTimeStr(input.time)) return "Hora inválida";
  if (!Number.isInteger(input.durationMin) || input.durationMin < 10 || input.durationMin > 600)
    return "La duración debe ser un número entero de minutos entre 10 y 600";
  if (input.modality !== "in_person" && input.modality !== "virtual") return "Modalidad inválida";
  return null;
}

/** Arma un horario libre nuevo a partir de fecha y hora locales. */
export function newOpenSlot(input: SlotInput): Slot {
  const startAt = arLocalToInstant(input.date, input.time);
  return {
    id: slotIdFor(input.date, input.time),
    date: input.date,
    time: input.time,
    startAt,
    endAt: new Date(startAt.getTime() + input.durationMin * 60_000),
    durationMin: input.durationMin,
    modality: input.modality,
    status: "open",
    bookingId: null,
    heldUntil: null,
  };
}

type Interval = { startAt: Date; endAt: Date };

export function overlaps(a: Interval, b: Interval): boolean {
  return a.startAt.getTime() < b.endAt.getTime() && b.startAt.getTime() < a.endAt.getTime();
}

/** Devuelve el primer horario existente que se superpone con `candidate` (ignorando `ignoreId`). */
export function findOverlap<T extends Interval & { id: string }>(
  candidate: Interval,
  existing: T[],
  ignoreId?: string,
): T | undefined {
  return existing.find((s) => s.id !== ignoreId && overlaps(candidate, s));
}

export type GenerationResult = { toCreate: Slot[]; skipped: { slot: Slot; reason: string }[] };

/**
 * Genera los horarios de la plantilla semanal entre dos fechas (inclusive).
 * Saltea los que se superponen con horarios existentes o con otros generados.
 */
export function generateFromTemplate(
  template: Record<Weekday, TemplateSlot[]>,
  from: string,
  to: string,
  existing: Slot[],
): GenerationResult {
  const candidates: Slot[] = [];
  for (const date of datesBetween(from, to)) {
    for (const t of template[weekdayOf(date)] ?? []) {
      candidates.push(newOpenSlot({ date, ...t }));
    }
  }
  return placeCandidates(candidates, existing);
}

/** Copia los horarios de la semana anterior (lunes `prevMonday`) a la semana siguiente, como libres. */
export function copyWeek(previousWeekSlots: Slot[], existing: Slot[]): GenerationResult {
  const candidates = previousWeekSlots.map((s) =>
    newOpenSlot({ date: addDaysStr(s.date, 7), time: s.time, durationMin: s.durationMin, modality: s.modality }),
  );
  return placeCandidates(candidates, existing);
}

function placeCandidates(candidates: Slot[], existing: Slot[]): GenerationResult {
  const placed: Slot[] = [...existing];
  const toCreate: Slot[] = [];
  const skipped: GenerationResult["skipped"] = [];
  for (const c of candidates) {
    const err = validateSlotInput(c);
    if (err) {
      skipped.push({ slot: c, reason: err });
      continue;
    }
    const clash = placed.find((s) => s.id === c.id || overlaps(c, s));
    if (clash) {
      skipped.push({ slot: c, reason: `Se superpone con ${clash.date} ${clash.time}` });
      continue;
    }
    placed.push(c);
    toCreate.push(c);
  }
  return { toCreate, skipped };
}

export function validateTemplate(template: Record<Weekday, TemplateSlot[]>): string | null {
  for (const [day, list] of Object.entries(template)) {
    const slots = list.map((t) => newOpenSlot({ date: "2026-01-05", ...t }));
    for (const [i, t] of list.entries()) {
      const err = validateSlotInput({ date: "2026-01-05", ...t });
      if (err) return `${day} ${t.time}: ${err}`;
      if (findOverlap(slots[i], slots, slots[i].id) || slots.some((s, j) => j !== i && s.id === slots[i].id))
        return `${day} ${t.time}: se superpone con otro horario de la plantilla`;
    }
  }
  return null;
}
