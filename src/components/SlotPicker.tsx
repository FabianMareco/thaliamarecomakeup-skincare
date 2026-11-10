"use client";

import { useMemo, useState } from "react";
import { addDaysStr, fmtDateStrLong, weekdayOf } from "@/lib/domain/time";
import { cx } from "./ui";

export type PickerDay = { date: string; slots: { id: string; time: string }[] };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const HEAD = ["L", "M", "M", "J", "V", "S", "D"];
const DAY_IDX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 } as const;

/**
 * Calendario de días con horarios disponibles y selección de horario.
 * Las fechas son "YYYY-MM-DD" en hora argentina; `today` viene del servidor.
 */
export function SlotPicker({
  days,
  today,
  horizonDays,
  value,
  onChange,
}: {
  days: PickerDay[];
  today: string;
  horizonDays: number;
  value: string | null;
  onChange: (slotId: string, date: string, time: string) => void;
}) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const last = addDaysStr(today, horizonDays);
  const months = useMemo(() => {
    const out: string[] = [];
    let ym = today.slice(0, 7);
    while (ym <= last.slice(0, 7)) {
      out.push(ym);
      const [y, m] = ym.split("-").map(Number);
      ym = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
    return out;
  }, [today, last]);
  const firstAvailableMonth = days[0]?.date.slice(0, 7) ?? today.slice(0, 7);
  const [monthIdx, setMonthIdx] = useState(Math.max(0, months.indexOf(firstAvailableMonth)));
  const selectedDate = value ? value.slice(0, 10) : null;
  const [openDate, setOpenDate] = useState<string | null>(selectedDate ?? days[0]?.date ?? null);

  if (days.length === 0) {
    return <p className="rounded-xl bg-sand p-4 text-sm text-muted">No hay horarios disponibles para este servicio en los próximos {horizonDays} días.</p>;
  }

  const ym = months[monthIdx];
  const [y, m] = ym.split("-").map(Number);
  const first = `${ym}-01`;
  const lead = DAY_IDX[weekdayOf(first)];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  const openDay = openDate ? byDate.get(openDate) : undefined;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
            disabled={monthIdx === 0}
            className="rounded-full px-3 py-1.5 text-lg text-accent disabled:opacity-30"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <p className="font-medium capitalize">
            {MONTHS[m - 1]} {y}
          </p>
          <button
            type="button"
            onClick={() => setMonthIdx((i) => Math.min(months.length - 1, i + 1))}
            disabled={monthIdx === months.length - 1}
            className="rounded-full px-3 py-1.5 text-lg text-accent disabled:opacity-30"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {HEAD.map((h, i) => (
            <div key={i} className="py-1">
              {h}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const available = byDate.has(date);
            const isOpen = date === openDate;
            return (
              <button
                key={date}
                type="button"
                disabled={!available}
                onClick={() => setOpenDate(date)}
                aria-pressed={isOpen}
                aria-label={`${fmtDateStrLong(date)}${available ? ", con horarios" : ", sin horarios"}`}
                className={cx(
                  "aspect-square rounded-xl text-sm transition-colors",
                  !available && "text-muted/40",
                  available && !isOpen && "bg-cream font-medium text-ink hover:bg-sand",
                  isOpen && "bg-accent font-medium text-white",
                  date === today && !isOpen && "ring-1 ring-accent/40",
                )}
              >
                {Number(date.slice(8))}
              </button>
            );
          })}
        </div>
      </div>

      {openDay && (
        <div className="space-y-2">
          <p className="text-sm font-medium first-letter:uppercase">{fmtDateStrLong(openDay.date)}</p>
          <div className="flex flex-wrap gap-2">
            {openDay.slots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onChange(s.id, openDay.date, s.time)}
                aria-pressed={value === s.id}
                className={cx(
                  "min-h-11 rounded-full border px-4 py-2 text-[15px] tabular-nums transition-colors",
                  value === s.id ? "border-accent bg-accent text-white" : "border-line bg-white hover:bg-sand",
                )}
              >
                {s.time} hs
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
