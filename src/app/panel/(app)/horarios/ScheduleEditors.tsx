"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, cx, Input, Select } from "@/components/ui";
import type { Modality, SlotStatus, TemplateSlot, Weekday } from "@/lib/domain/types";
import { WEEKDAYS } from "@/lib/domain/types";
import { Feedback, useAction } from "../../_components/actions";
import {
  adminBookingAction,
  closeDayAction,
  copyWeekAction,
  createSlotAction,
  deleteSlotAction,
  generateRangeAction,
  saveTemplateAction,
  updateSlotAction,
} from "../../actions";
import { pricingPayload } from "../../_components/ExtrasEditor";
import { BookingFields, emptyBookingFields, type BookingFieldsValue, type ServiceOption } from "./BookingFields";

function bookingPayload(v: BookingFieldsValue, where: { slotId: string } | { newSlot: { date: string; time: string; durationMin: number; modality: Modality } }) {
  const { pricing, ...rest } = v;
  return { ...rest, ...pricingPayload(pricing), ...where };
}

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

/** Selector de fecha que cambia de día apenas se elige otra fecha. */
export function DateJump({ date }: { date: string }) {
  const router = useRouter();
  return (
    <Input
      type="date"
      value={date}
      aria-label="Ir a fecha"
      onChange={(e) => {
        if (e.target.value) router.push(`/panel/horarios?date=${e.target.value}`);
      }}
    />
  );
}

type DaySlot = {
  id: string;
  time: string;
  durationMin: number;
  modality: Modality;
  status: SlotStatus;
  bookingId: string | null;
  clientName?: string;
  serviceName?: string;
};

export function DayEditor({ date, slots, services }: { date: string; slots: DaySlot[]; services: ServiceOption[] }) {
  // Cada zona tiene su propio estado, así los mensajes aparecen junto a lo que se tocó.
  const list = useAction(); // editar, borrar y reservar un horario de la lista
  const add = useAction(); // agregar
  const day = useAction(); // copiar semana y cerrar día
  const pending = list.pending || add.pending || day.pending;
  // Qué horario de la lista se está editando o reservando.
  const [open, setOpen] = useState<{ id: string; mode: "edit" | "book" } | null>(null);
  const [form, setForm] = useState({ time: "", durationMin: "120", modality: "in_person" as Modality });
  const [edit, setEdit] = useState({ time: "", durationMin: "", modality: "in_person" as Modality });
  const [book, setBook] = useState<BookingFieldsValue>(emptyBookingFields);
  const [addBooked, setAddBooked] = useState(false);
  const [newBook, setNewBook] = useState<BookingFieldsValue>(emptyBookingFields);

  const close = () => {
    setOpen(null);
    list.setError(null);
  };
  const bookingMsg = (status: string) => (status === "confirmed" ? "Reserva cargada y confirmada" : "Reserva cargada: queda esperando la seña");

  return (
    <div className="space-y-4">
      {slots.length === 0 && <p className="text-sm text-muted">No hay horarios publicados este día.</p>}
      {!open && <Feedback error={list.error} done={list.done} />}
      <ul className="space-y-2">
        {slots.map((s) => (
          <li key={s.id} className="rounded-xl border border-line p-3">
            {open?.id === s.id && open.mode === "edit" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Input type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} aria-label="Hora" />
                  <Input type="number" inputMode="numeric" value={edit.durationMin} onChange={(e) => setEdit({ ...edit, durationMin: e.target.value })} aria-label="Duración (min)" />
                  <Select value={edit.modality} onChange={(e) => setEdit({ ...edit, modality: e.target.value as Modality })} aria-label="Modalidad">
                    <option value="in_person">Presencial</option>
                    <option value="virtual">Virtual</option>
                  </Select>
                </div>
                <Feedback error={list.error} />
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={close} disabled={pending}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={pending}
                    onClick={() =>
                      list.run(() => updateSlotAction(s.id, { time: edit.time, durationMin: Number(edit.durationMin), modality: edit.modality }), undefined, () => setOpen(null))
                    }
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            ) : open?.id === s.id && open.mode === "book" ? (
              <div className="space-y-3">
                <p className="font-medium">
                  Reservar {s.time} <span className="text-sm font-normal text-muted">· {s.durationMin} min · {MODALITY_LABEL[s.modality]}</span>
                </p>
                <BookingFields value={book} onChange={setBook} services={services} idPrefix={`book-${s.id}`} />
                <Feedback error={list.error} />
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={close} disabled={pending}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={pending}
                    onClick={() =>
                      list.run(
                        () => adminBookingAction(bookingPayload(book, { slotId: s.id })),
                        (d) => bookingMsg(d.status),
                        () => {
                          setOpen(null);
                          setBook(emptyBookingFields);
                        },
                      )
                    }
                  >
                    Guardar reserva
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium tabular-nums">
                    {s.time} <span className="text-sm font-normal text-muted">· {s.durationMin} min · {MODALITY_LABEL[s.modality]}</span>
                  </p>
                  {s.clientName && (
                    <p className="truncate text-sm">
                      {s.clientName}
                      {s.serviceName ? ` · ${s.serviceName}` : ""}
                    </p>
                  )}
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
                      variant="secondary"
                      className="px-3"
                      onClick={() => {
                        list.setError(null);
                        setBook(emptyBookingFields);
                        setOpen({ id: s.id, mode: "book" });
                      }}
                    >
                      Reservar
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-3"
                      onClick={() => {
                        list.setError(null);
                        setEdit({ time: s.time, durationMin: String(s.durationMin), modality: s.modality });
                        setOpen({ id: s.id, mode: "edit" });
                      }}
                    >
                      Editar
                    </Button>
                    <Button variant="ghost" className="px-3 text-red-700" disabled={pending} onClick={() => list.run(() => deleteSlotAction(s.id))}>
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
        className="space-y-3 rounded-xl bg-sand/50 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const slot = { date, time: form.time, durationMin: Number(form.durationMin), modality: form.modality };
          if (addBooked) {
            add.run(
              () => adminBookingAction(bookingPayload(newBook, { newSlot: slot })),
              (d) => bookingMsg(d.status),
              () => {
                setForm({ ...form, time: "" });
                setNewBook(emptyBookingFields);
                setAddBooked(false);
              },
            );
          } else {
            add.run(() => createSlotAction(slot), "Horario agregado", () => setForm({ ...form, time: "" }));
          }
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
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" className="h-5 w-5 accent-[var(--color-accent)]" checked={addBooked} onChange={(e) => setAddBooked(e.target.checked)} />
          Ya está reservado (cargar los datos de la paciente)
        </label>
        {addBooked && <BookingFields value={newBook} onChange={setNewBook} services={services} idPrefix="new" />}
        <Feedback error={add.error} done={add.done} />
        <Button type="submit" className="w-full" disabled={pending}>
          {addBooked ? "Agregar horario reservado" : "Agregar"}
        </Button>
      </form>

      <Feedback error={day.error} done={day.done} />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => day.run(() => copyWeekAction(date), "Semana anterior copiada a esta semana")}>
          Copiar semana anterior
        </Button>
        <Button
          variant="danger"
          disabled={pending || !slots.some((s) => s.status === "open")}
          onClick={() => {
            if (confirm("¿Borrar todos los horarios libres de este día?")) day.run(() => closeDayAction(date), "Día cerrado");
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
