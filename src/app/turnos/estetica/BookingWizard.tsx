"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SlotPicker, type PickerDay } from "@/components/SlotPicker";
import { Alert, Badge, Button, Card, cx, Field, Input, Row } from "@/components/ui";
import { formatARS, skincareDeposit } from "@/lib/domain/money";
import { fmtDateStrLong } from "@/lib/domain/time";
import type { Modality } from "@/lib/domain/types";
import { bookSkincare, fetchAvailability } from "../actions";

type ServiceItem = {
  id: string;
  name: string;
  category: string;
  description?: string;
  badge?: string;
  price: number;
  durationMin?: number;
  modality: Modality;
};

type Step = "service" | "slot" | "data" | "confirm";

export function BookingWizard({
  services,
  depositAmount,
  horizonDays,
  policy,
  today: initialToday,
}: {
  services: ServiceItem[];
  depositAmount: number;
  horizonDays: number;
  policy: string;
  today: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<ServiceItem | null>(null);
  const [days, setDays] = useState<PickerDay[] | null>(null);
  const [today, setToday] = useState(initialToday);
  const [slot, setSlot] = useState<{ id: string; date: string; time: string } | null>(null);
  const [data, setData] = useState({ name: "", phone: "", email: "", firstVisit: "" as "" | "yes" | "no", website: "" });
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const categories = [...new Set(services.map((s) => s.category))];

  function chooseService(s: ServiceItem) {
    setService(s);
    setSlot(null);
    setDays(null);
    setError(null);
    setStep("slot");
    startLoading(async () => {
      const r = await fetchAvailability(s.id);
      if (r.ok) {
        setDays(r.data.days);
        setToday(r.data.today);
      } else setError(r.error);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit() {
    if (!service || !slot) return;
    setError(null);
    startSubmit(async () => {
      const r = await bookSkincare({
        serviceId: service.id,
        slotId: slot.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        firstVisit: data.firstVisit === "yes",
        acceptPolicies: accept as true,
        website: data.website,
      });
      if (r.ok) router.push(`/turnos/pago/${r.data.token}`);
      else {
        setError(r.error);
        if (/horario/.test(r.error)) {
          setSlot(null);
          setStep("slot");
          const again = await fetchAvailability(service.id);
          if (again.ok) setDays(again.data.days);
        }
      }
    });
  }

  const money = service ? skincareDeposit(service.price, depositAmount) : null;
  const dataValid = data.name.trim().length >= 2 && data.phone.replace(/\D/g, "").length >= 8 && /\S+@\S+\.\S+/.test(data.email) && data.firstVisit !== "";

  return (
    <div className="space-y-6">
      <Steps step={step} />

      {error && <Alert tone="danger">{error}</Alert>}

      {step === "service" && (
        <div className="space-y-8">
          {categories.map((cat) => (
            <section key={cat} className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{cat}</h2>
              <div className="grid gap-3">
                {services
                  .filter((s) => s.category === cat)
                  .map((s) => {
                    const m = skincareDeposit(s.price, depositAmount);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => chooseService(s)}
                        className="rounded-2xl border border-line bg-white p-4 text-left transition-colors hover:border-accent"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {s.badge && <Badge tone="accent">{s.badge}</Badge>}
                          {s.modality === "virtual" && <Badge tone="info">Virtual</Badge>}
                        </div>
                        <p className="mt-1.5 text-[16px] font-medium leading-snug">{s.name}</p>
                        {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
                        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                          <span className="text-base font-semibold">{formatARS(s.price)}</span>
                          <span className="text-muted">Seña {formatARS(m.deposit)}</span>
                          <span className="text-muted">Saldo {formatARS(m.balance)}</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </section>
          ))}
          {services.length === 0 && <p className="text-muted">Por el momento no hay tratamientos disponibles para reservar online.</p>}
        </div>
      )}

      {step !== "service" && service && money && (
        <Card className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{service.name}</p>
              {service.modality === "virtual" && <p className="text-sm text-muted">Online</p>}
            </div>
            <button type="button" className="text-sm text-accent underline" onClick={() => setStep("service")}>
              Cambiar
            </button>
          </div>
          <Row label="Precio">{formatARS(service.price)}</Row>
          <Row label="Seña para reservar">{formatARS(money.deposit)}</Row>
          <Row label="Saldo en el turno">{formatARS(money.balance)}</Row>
          {slot && (
            <div className="flex items-start justify-between gap-3 border-t border-line pt-3">
              <p className="first-letter:uppercase">
                {fmtDateStrLong(slot.date)}, {slot.time} hs
              </p>
              {step !== "slot" && (
                <button type="button" className="text-sm text-accent underline" onClick={() => setStep("slot")}>
                  Cambiar
                </button>
              )}
            </div>
          )}
        </Card>
      )}

      {step === "slot" && service && (
        <section className="space-y-4">
          <h2 className="font-display text-xl">Elegí día y horario</h2>
          {loading || !days ? (
            <p className="text-muted">Buscando horarios…</p>
          ) : (
            <SlotPicker
              days={days}
              today={today}
              horizonDays={horizonDays}
              value={slot?.id ?? null}
              onChange={(id, date, time) => setSlot({ id, date, time })}
            />
          )}
          <Button className="w-full" disabled={!slot} onClick={() => setStep("data")}>
            Continuar
          </Button>
        </section>
      )}

      {step === "data" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (dataValid) setStep("confirm");
          }}
        >
          <h2 className="font-display text-xl">Tus datos</h2>
          <Field label="Nombre y apellido" htmlFor="name">
            <Input id="name" autoComplete="name" required value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
          </Field>
          <Field label="WhatsApp" htmlFor="phone" hint="Con código de área, ej. 11 5847-0009. Te mandamos la confirmación por acá.">
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" required value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">¿Es tu primera vez?</legend>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map((v) => (
                <label
                  key={v}
                  className={cx(
                    "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border px-4 text-[15px]",
                    data.firstVisit === v ? "border-accent bg-accent text-white" : "border-line bg-white",
                  )}
                >
                  <input type="radio" name="firstVisit" className="sr-only" checked={data.firstVisit === v} onChange={() => setData({ ...data, firstVisit: v })} />
                  {v === "yes" ? "Sí, es la primera" : "No, ya vine"}
                </label>
              ))}
            </div>
            {data.firstVisit === "yes" && <p className="text-xs text-muted">En la primera consulta Thalia arma tu ficha cosmetológica.</p>}
          </fieldset>
          {/* Honeypot: invisible para personas. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Sitio web
              <input tabIndex={-1} autoComplete="off" value={data.website} onChange={(e) => setData({ ...data, website: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep("slot")}>
              Volver
            </Button>
            <Button type="submit" className="flex-1" disabled={!dataValid}>
              Continuar
            </Button>
          </div>
        </form>
      )}

      {step === "confirm" && service && slot && money && (
        <section className="space-y-4">
          <h2 className="font-display text-xl">Revisá y confirmá</h2>
          <Card className="space-y-1">
            <Row label="Nombre">{data.name}</Row>
            <Row label="WhatsApp">{data.phone}</Row>
            <Row label="Email">{data.email}</Row>
          </Card>
          <div className="space-y-2 rounded-2xl bg-sand/70 p-4 text-sm leading-relaxed">
            <p className="font-medium">Política de reserva y cancelación</p>
            <p>{policy}</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-[15px]">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-accent)]" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span>Acepto las políticas de reserva y cancelación.</span>
          </label>
          <p className="text-sm text-muted">
            Al confirmar, el horario queda reservado para vos por un rato mientras transferís la seña de <strong>{formatARS(money.deposit)}</strong> y
            subís el comprobante.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep("data")} disabled={submitting}>
              Volver
            </Button>
            <Button type="button" className="flex-1" disabled={!accept || submitting} onClick={submit}>
              {submitting ? "Reservando…" : "Reservar"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const order: Step[] = ["service", "slot", "data", "confirm"];
  const labels = ["Servicio", "Horario", "Datos", "Confirmar"];
  const idx = order.indexOf(step);
  return (
    <ol className="flex gap-2 text-xs" aria-label="Pasos">
      {labels.map((l, i) => (
        <li key={l} className="flex-1" aria-current={i === idx ? "step" : undefined}>
          <div className={cx("h-1 rounded-full", i <= idx ? "bg-accent" : "bg-line")} />
          <p className={cx("mt-1.5", i === idx ? "font-medium text-ink" : "text-muted")}>{l}</p>
        </li>
      ))}
    </ol>
  );
}
