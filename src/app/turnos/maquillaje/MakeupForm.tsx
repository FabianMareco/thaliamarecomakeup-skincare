"use client";

import { useState, useTransition } from "react";
import { Alert, Button, cx, Field, Input, Select, Textarea } from "@/components/ui";
import { formatARS } from "@/lib/domain/money";
import { requestMakeup } from "../actions";

type ServiceItem = { id: string; name: string; category: string; price: number; includesTrial: boolean };

export function MakeupForm({ services, today }: { services: ServiceItem[]; today: string }) {
  const [f, setF] = useState({
    serviceId: "",
    eventDate: "",
    readyByTime: "",
    location: "studio" as "studio" | "home",
    homeAddress: "",
    peopleCount: "1",
    name: "",
    phone: "",
    email: "",
    comments: "",
    preferredTrialDate: "",
    website: "",
  });
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const service = services.find((s) => s.id === f.serviceId);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  if (done) {
    return (
      <Alert tone="ok" title="¡Recibimos tu solicitud!">
        Thalia la va a revisar y, si tiene la fecha disponible, te manda por email y WhatsApp el precio final y el link para abonar la seña.
        Te enviamos un email con el resumen.
      </Alert>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await requestMakeup({
            ...f,
            peopleCount: Number(f.peopleCount),
            homeAddress: f.location === "home" ? f.homeAddress : undefined,
            preferredTrialDate: service?.includesTrial ? f.preferredTrialDate : "",
            acceptPolicies: accept as true,
          });
          if (r.ok) {
            setDone(true);
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          } else setError(r.error);
        });
      }}
    >
      <Field label="Servicio" htmlFor="serviceId">
        <Select id="serviceId" required value={f.serviceId} onChange={set("serviceId")}>
          <option value="">Elegí un servicio</option>
          {[...new Set(services.map((s) => s.category))].map((cat) => (
            <optgroup key={cat} label={cat}>
              {services
                .filter((s) => s.category === cat)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatARS(s.price)}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha del evento" htmlFor="eventDate">
          <Input id="eventDate" type="date" required min={today} value={f.eventDate} onChange={set("eventDate")} />
        </Field>
        <Field label="Lista a las" htmlFor="readyByTime" hint="Hora a la que necesitás estar lista">
          <Input id="readyByTime" type="time" required value={f.readyByTime} onChange={set("readyByTime")} />
        </Field>
      </div>
      {service?.includesTrial && (
        <Field label="Fecha preferida para la prueba (opcional)" htmlFor="preferredTrialDate" hint="Thalia la confirma al aceptar.">
          <Input id="preferredTrialDate" type="date" min={today} value={f.preferredTrialDate} onChange={set("preferredTrialDate")} />
        </Field>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Lugar</legend>
        <div className="flex gap-2">
          {(["studio", "home"] as const).map((v) => (
            <label
              key={v}
              className={cx(
                "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border px-4 text-[15px]",
                f.location === v ? "border-accent bg-accent text-white" : "border-line bg-white",
              )}
            >
              <input type="radio" name="location" className="sr-only" checked={f.location === v} onChange={() => setF({ ...f, location: v })} />
              {v === "studio" ? "En el estudio" : "A domicilio"}
            </label>
          ))}
        </div>
      </fieldset>
      {f.location === "home" && (
        <Field label="Dirección o barrio" htmlFor="homeAddress" hint="A domicilio se suma viático según la distancia.">
          <Input id="homeAddress" required value={f.homeAddress} onChange={set("homeAddress")} />
        </Field>
      )}
      <Field label="Cantidad de personas" htmlFor="peopleCount">
        <Input id="peopleCount" type="number" inputMode="numeric" min={1} max={30} required value={f.peopleCount} onChange={set("peopleCount")} />
      </Field>
      <Field label="Nombre y apellido" htmlFor="name">
        <Input id="name" autoComplete="name" required value={f.name} onChange={set("name")} />
      </Field>
      <Field label="WhatsApp" htmlFor="phone" hint="Con código de área, ej. 11 5847-0009.">
        <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" required value={f.phone} onChange={set("phone")} />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required value={f.email} onChange={set("email")} />
      </Field>
      <Field label="Comentarios (opcional)" htmlFor="comments" hint="Referencias, estilo que buscás, tipo de evento…">
        <Textarea id="comments" value={f.comments} onChange={set("comments")} maxLength={1000} />
      </Field>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Sitio web
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
        </label>
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-[15px]">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-accent)]" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span>Leí y acepto la política de reserva (la seña no se reintegra).</span>
      </label>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending || !accept}>
        {pending ? "Enviando…" : "Enviar solicitud"}
      </Button>
    </form>
  );
}
