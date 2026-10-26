"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, cx, Input, Select } from "@/components/ui";
import type { Modality, SlotStatus, TemplateSlot, Weekday } from "@/lib/domain/types";
import { WEEKDAYS } from "@/lib/domain/types";
import { Feedback, useAction } from "../../_components/actions";
import { closeDayAction, copyWeekAction, createSlotAction, deleteSlotAction, generateRangeAction, saveTemplateAction, updateSlotAction } from "../../actions";

const DAY_LABEL: Record<Weekday, string> = { mon: "Lunes", tue: "Martes", wed: "Miércoles", thu: "Jueves", fri: "Viernes", sat: "Sábado", sun: "Domingo" };
const MODALITY_LABEL: Record<Modality, string> = { in_person: "Presencial", virtual: "Virtual" };

export function GeneratePanel({ ranges, today }: { ranges: { label: string; from: string; to: string }[]; today: string }) {
  const { pending, error, done, run } = useAction();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(ranges[1]?.to ?? today);
  const [msg, setMsg] = useState<string | null>(null);
  const generate = (f: string, t: string) =>
    run(async () => {
      const r = await generateRangeAction(f, t);
      if (r.ok) setMsg(`Listo: ${r.data.created} horarios publicados${r.data.skipped ? ` (${r.data.skipped} ya existían o se superponían)` : ""}.`);
      return r;
    });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {ranges.map((r) => (
          <Button key={r.label} variant="secondary" disabled={pending} onClick={() => generate(r.from, r.to)}>
            {r.label}
          </Button>
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-accent">Otro rango de fechas</summary>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex-1">
            <span className="text-xs text-muted">Desde</span>
            <Input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex-1">
            <span className="text-xs text-muted">Hasta</span>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <Button disabled={pending || !from || !to} onClick={() => generate(from, to)}>
            Generar
          </Button>
        </div>
      </details>
      <Feedback error={error} done={done ?? msg} />
    </div>
  );
}

type DaySlot = { id: string; time: string; durationMin: number; modality: Modality; status: SlotStatus; bookingId: string | null };

export function DayEditor({ date, slots }: { date: string; slots: DaySlot[] }) {
  const { pending, error, done, run } = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ time: "", durationMin: "120", modality: "in_person" as Modality });
  const [edit, setEdit] = useState({ time: "", durationMin: "", modality: "in_person" as Modality });

  return (
    <div className="space-y-4">
      {slots.length === 0 && <p className="text-sm text-muted">No hay horarios publicados este día.</p>}
      <ul className="space-y-2">
        {slots.map((s) => (
          <li key={s.id} className="rounded-xl border border-line p-3">
            {editing === s.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Input type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} aria-label="Hora" />
                  <Input type="number" inputMode="numeric" value={edit.durationMin} onChange={(e) => setEdit({ ...edit, durationMin: e.target.value })} aria-label="Duración (min)" />
                  <Select value={edit.modality} onChange={(e) => setEdit({ ...edit, modality: e.target.value as Modality })} aria-label="Modalidad">
                    <option value="in_person">Presencial</option>
                    <option value="virtual">Virtual</option>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setEditing(null)} disabled={pending}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={pending}
                    onClick={() =>
                      run(() => updateSlotAction(s.id, { time: edit.time, durationMin: Number(edit.durationMin), modality: edit.modality }), undefined, () => setEditing(null))
                    }
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium tabular-nums">
                    {s.time} <span className="text-sm font-normal text-muted">· {s.durationMin} min · {MODALITY_LABEL[s.modality]}</span>
                  </p>
                  <div className="mt-1">
                    {s.status === "open" ? (
                      <Badge tone="ok">Libre</Badge>
                    ) : (
                      <Link href={`/panel/reservas/${s.bookingId}`}>
                        <Badge tone={s.status === "booked" ? "accent" : "warn"}>{s.status === "booked" ? "Reservado" : "Retenido"} · ver reserva</Badge>
                      </Link>
                    )}
                  </div>
                </div>
                {s.status === "open" && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      className="px-3"
                      onClick={() => {
                        setEditing(s.id);
                        setEdit({ time: s.time, durationMin: String(s.durationMin), modality: s.modality });
                      }}
                    >
                      Editar
                    </Button>
                    <Button variant="ghost" className="px-3 text-red-700" disabled={pending} onClick={() => run(() => deleteSlotAction(s.id))}>
                      Borrar
                    </Button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <form
        className="space-y-2 rounded-xl bg-sand/50 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createSlotAction({ date, time: form.time, durationMin: Number(form.durationMin), modality: form.modality }), "Horario agregado", () =>
            setForm({ ...form, time: "" }),
          );
        }}
      >
        <p className="text-sm font-medium">Agregar horario</p>
        <div className="grid grid-cols-3 gap-2">
          <Input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} aria-label="Hora" />
          <Input type="number" inputMode="numeric" required min={10} max={600} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} aria-label="Duración en minutos" />
          <Select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value as Modality })} aria-label="Modalidad">
            <option value="in_person">Presencial</option>
            <option value="virtual">Virtual</option>
          </Select>
        </div>
        <p className="text-xs text-muted">Hora · duración (min) · modalidad</p>
        <Button type="submit" className="w-full" disabled={pending}>
          Agregar
        </Button>
      </form>

      <Feedback error={error} done={done} />

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => copyWeekAction(date), "Semana anterior copiada a esta semana")}
        >
          Copiar semana anterior
        </Button>
        <Button
          variant="danger"
          disabled={pending || !slots.some((s) => s.status === "open")}
          onClick={() => {
            if (confirm("¿Borrar todos los horarios libres de este día?")) run(() => closeDayAction(date), "Día cerrado");
          }}
        >
          Cerrar día
        </Button>
      </div>
    </div>
  );
}

export function TemplateEditor({ initial }: { initial: Record<Weekday, TemplateSlot[]> }) {
  const { pending, error, done, run } = useAction();
  const [tpl, setTpl] = useState(initial);
  const [day, setDay] = useState<Weekday>("mon");
  const update = (d: Weekday, list: TemplateSlot[]) => setTpl({ ...tpl, [d]: list });

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto">
        {WEEKDAYS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            className={cx("rounded-full px-3 py-1.5 text-sm whitespace-nowrap", d === day ? "bg-ink text-white" : "bg-sand text-ink")}
          >
            {DAY_LABEL[d].slice(0, 3)} <span className="text-xs opacity-70">{tpl[d].length}</span>
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {tpl[day].map((t, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
            <Input type="time" value={t.time} onChange={(e) => update(day, tpl[day].map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} aria-label="Hora" />
            <Input
              type="number"
              inputMode="numeric"
              value={t.durationMin}
              onChange={(e) => update(day, tpl[day].map((x, j) => (j === i ? { ...x, durationMin: Number(e.target.value) } : x)))}
              aria-label="Duración (min)"
            />
            <Select value={t.modality} onChange={(e) => update(day, tpl[day].map((x, j) => (j === i ? { ...x, modality: e.target.value as Modality } : x)))} aria-label="Modalidad">
              <option value="in_person">Presencial</option>
              <option value="virtual">Virtual</option>
            </Select>
            <button type="button" className="px-2 text-red-700" aria-label="Quitar" onClick={() => update(day, tpl[day].filter((_, j) => j !== i))}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      {tpl[day].length === 0 && <p className="text-sm text-muted">{DAY_LABEL[day]}: sin horarios.</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => update(day, [...tpl[day], { time: "09:00", durationMin: 120, modality: "in_person" }])}>
          + Horario
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            const copy = Object.fromEntries(WEEKDAYS.map((d) => [d, d === "sun" ? tpl[d] : tpl[day].map((x) => ({ ...x }))])) as Record<Weekday, TemplateSlot[]>;
            setTpl(copy);
          }}
        >
          Copiar a lunes–sábado
        </Button>
      </div>
      <Feedback error={error} done={done} />
      <Button className="w-full" disabled={pending} onClick={() => run(() => saveTemplateAction(tpl), "Plantilla guardada")}>
        Guardar plantilla
      </Button>
    </div>
  );
}
