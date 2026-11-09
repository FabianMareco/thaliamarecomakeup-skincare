"use client";

import { useEffect, useState } from "react";
import { Badge, Field, Input, Select } from "@/components/ui";
import { formatARS } from "@/lib/domain/money";
import { emptyPricing, ExtrasEditor, type PricingDraft } from "../../_components/ExtrasEditor";
import { searchPatientsAction, type PatientSuggestion } from "../../actions";

export type ServiceOption = { id: string; name: string; price: number; durationMin?: number; active: boolean };

export type BookingFieldsValue = {
  serviceId: string;
  name: string;
  phone: string;
  email: string;
  firstVisit: boolean;
  depositPaid: boolean;
  notifyClient: boolean;
  pricing: PricingDraft;
};

export const emptyBookingFields: BookingFieldsValue = {
  serviceId: "",
  name: "",
  phone: "",
  email: "",
  firstVisit: false,
  depositPaid: false,
  notifyClient: true,
  pricing: emptyPricing,
};

/** Busca pacientes que ya reservaron mientras Thalia escribe el nombre o el teléfono. */
function usePatientSuggestions(query: string, enabled: boolean): PatientSuggestion[] {
  const [list, setList] = useState<PatientSuggestion[]>([]);
  useEffect(() => {
    if (!enabled || query.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await searchPatientsAction(query);
      if (!cancelled) setList(r.ok ? r.data : []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, enabled]);
  return enabled && query.trim().length >= 2 ? list : [];
}

/** Datos de la paciente para una reserva cargada a mano por Thalia. */
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
  // Paciente elegida de la lista (se muestra como ficha en vez de los campos sueltos).
  const [pickedState, setPicked] = useState<PatientSuggestion | null>(null);
  // Si el formulario se vació (por ejemplo, después de guardar), la ficha elegida deja de valer.
  const picked = pickedState && pickedState.phone === value.phone ? pickedState : null;
  const [searchField, setSearchField] = useState<"name" | "phone">("name");
  const suggestions = usePatientSuggestions(searchField === "name" ? value.name : value.phone, !picked);
  const service = services.find((s) => s.id === value.serviceId);

  const pick = (p: PatientSuggestion) => {
    setPicked(p);
    onChange({ ...value, name: p.name, phone: p.phone, email: p.email, firstVisit: false });
  };

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

      {service && (
        <ExtrasEditor
          value={value.pricing}
          onChange={(p) => set("pricing", p)}
          options={services.filter((s) => s.id !== service.id && s.active)}
          basePrice={service.price}
          idPrefix={id("pricing")}
        />
      )}

      {picked ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-accent/40 bg-blush/30 p-3">
          <div className="min-w-0 text-sm">
            <p className="font-medium">{picked.name}</p>
            <p className="text-muted">
              {picked.phone}
              {picked.email ? ` · ${picked.email}` : ""}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge tone="accent">{picked.bookingsCount} reserva(s)</Badge>
              {picked.noShowCount > 0 && <Badge tone="danger">{picked.noShowCount} ausencia(s)</Badge>}
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 text-sm text-accent underline"
            onClick={() => {
              setPicked(null);
              onChange({ ...value, name: "", phone: "", email: "" });
            }}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <Field label="Nombre y apellido" htmlFor={id("name")} hint="Escribí para buscar entre tus pacientes.">
            <Input
              id={id("name")}
              value={value.name}
              onFocus={() => setSearchField("name")}
              onChange={(e) => {
                setSearchField("name");
                set("name", e.target.value);
              }}
              autoComplete="off"
            />
          </Field>
          {suggestions.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white" aria-label="Pacientes encontradas">
              {suggestions.map((p) => (
                <li key={p.phone}>
                  <button type="button" onClick={() => pick(p)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-sand">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-muted">{p.phone}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {p.bookingsCount} reserva(s){p.noShowCount > 0 ? ` · ${p.noShowCount} ausencia(s)` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="WhatsApp" htmlFor={id("phone")} hint="Ej. 11 5847-0009">
              <Input
                id={id("phone")}
                type="tel"
                inputMode="tel"
                value={value.phone}
                onFocus={() => setSearchField("phone")}
                onChange={(e) => {
                  setSearchField("phone");
                  set("phone", e.target.value);
                }}
                autoComplete="off"
              />
            </Field>
            <Field label="Email (opcional)" htmlFor={id("email")}>
              <Input id={id("email")} type="email" value={value.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" />
            </Field>
          </div>
        </>
      )}

      <div className="space-y-2 text-[15px]">
        {!picked && (
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-[var(--color-accent)]" checked={value.firstVisit} onChange={(e) => set("firstVisit", e.target.checked)} />
            Es su primera vez
          </label>
        )}
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
          Avisarle a la paciente {value.depositPaid ? "(confirmación con la dirección)" : "(link para pagar la seña)"}
        </label>
      </div>
    </div>
  );
}
