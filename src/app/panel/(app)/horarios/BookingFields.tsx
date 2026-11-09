"use client";

import { Field, Input, Select } from "@/components/ui";
import { formatARS } from "@/lib/domain/money";

export type ServiceOption = { id: string; name: string; price: number; durationMin?: number; active: boolean };

export type BookingFieldsValue = {
  serviceId: string;
  name: string;
  phone: string;
  email: string;
  firstVisit: boolean;
  depositPaid: boolean;
  notifyClient: boolean;
};

export const emptyBookingFields: BookingFieldsValue = {
  serviceId: "",
  name: "",
  phone: "",
  email: "",
  firstVisit: false,
  depositPaid: false,
  notifyClient: true,
};

/** Datos de la clienta para una reserva cargada a mano por Thalia. */
export function BookingFields({
  value,
  onChange,
  services,
  idPrefix,
}: {
  value: BookingFieldsValue;
  onChange: (v: BookingFieldsValue) => void;
  services: ServiceOption[];
  idPrefix: string;
}) {
  const set = <K extends keyof BookingFieldsValue>(k: K, v: BookingFieldsValue[K]) => onChange({ ...value, [k]: v });
  const id = (s: string) => `${idPrefix}-${s}`;
  return (
    <div className="space-y-3">
      <Field label="Tratamiento" htmlFor={id("service")}>
        <Select id={id("service")} value={value.serviceId} onChange={(e) => set("serviceId", e.target.value)}>
          <option value="">Elegí el tratamiento</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatARS(s.price)}
              {s.durationMin ? ` · ${s.durationMin} min` : ""}
              {s.active ? "" : " (inactivo)"}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nombre y apellido" htmlFor={id("name")}>
        <Input id={id("name")} value={value.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="WhatsApp" htmlFor={id("phone")} hint="Ej. 11 5847-0009">
          <Input id={id("phone")} type="tel" inputMode="tel" value={value.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Email (opcional)" htmlFor={id("email")}>
          <Input id={id("email")} type="email" value={value.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <div className="space-y-2 text-[15px]">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-[var(--color-accent)]" checked={value.firstVisit} onChange={(e) => set("firstVisit", e.target.checked)} />
          Es su primera vez
        </label>
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" className="h-5 w-5 accent-[var(--color-accent)]" checked={value.depositPaid} onChange={(e) => set("depositPaid", e.target.checked)} />
          La seña ya está recibida
        </label>
        <p className="pl-7 text-xs text-muted">
          {value.depositPaid
            ? "La reserva queda confirmada."
            : "La reserva queda esperando la seña, con el horario retenido sin vencimiento. Cuando la recibas, confirmala desde el detalle de la reserva."}
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-[var(--color-accent)]" checked={value.notifyClient} onChange={(e) => set("notifyClient", e.target.checked)} />
          Avisarle a la clienta {value.depositPaid ? "(confirmación con la dirección)" : "(link para pagar la seña)"}
        </label>
      </div>
    </div>
  );
}
