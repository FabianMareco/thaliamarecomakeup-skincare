"use client";

import { Button, Input, Select } from "@/components/ui";
import { formatARS, listPrice } from "@/lib/domain/money";

export type ExtraOption = { id: string; name: string; price: number };
export type ExtraDraft = { serviceId?: string; name: string; price: string };
export type PricingDraft = { extras: ExtraDraft[]; totalPrice: string };

export const emptyPricing: PricingDraft = { extras: [], totalPrice: "" };

/** Convierte el borrador al formato que esperan las acciones del servidor. */
export function pricingPayload(d: PricingDraft) {
  return {
    extras: d.extras.map((e) => ({ serviceId: e.serviceId, name: e.name, price: Number(e.price) || 0 })),
    totalPrice: d.totalPrice.trim() === "" ? ("" as const) : Number(d.totalPrice),
  };
}

/**
 * Tratamientos extra (elegidos del catálogo o escritos a mano, con precio
 * editable) y precio total de combo opcional.
 */
export function ExtrasEditor({
  value,
  onChange,
  options,
  basePrice,
  idPrefix,
}: {
  value: PricingDraft;
  onChange: (v: PricingDraft) => void;
  options: ExtraOption[];
  basePrice: number;
  idPrefix: string;
}) {
  const list = listPrice(basePrice, value.extras.map((e) => ({ name: e.name, price: Number(e.price) || 0 })));
  const setExtra = (i: number, patch: Partial<ExtraDraft>) =>
    onChange({ ...value, extras: value.extras.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  return (
    <div className="space-y-3 rounded-xl border border-line p-3">
      <p className="text-sm font-medium">Tratamientos extra y precio</p>
      {value.extras.map((e, i) => (
        <div key={i} className="space-y-2 rounded-lg bg-sand/40 p-2">
          <div className="flex items-center gap-2">
            <Select
              aria-label="Tratamiento extra"
              value={e.serviceId ?? (e.name ? "__otro" : "")}
              onChange={(ev) => {
                const opt = options.find((o) => o.id === ev.target.value);
                if (opt) setExtra(i, { serviceId: opt.id, name: opt.name, price: String(opt.price) });
                else setExtra(i, { serviceId: undefined, name: "", price: "" });
              }}
            >
              <option value="">Elegí un tratamiento</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {formatARS(o.price)}
                </option>
              ))}
              <option value="__otro">Otro (escribirlo)</option>
            </Select>
            <button
              type="button"
              className="px-2 text-red-700"
              aria-label="Quitar extra"
              onClick={() => onChange({ ...value, extras: value.extras.filter((_, j) => j !== i) })}
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <Input aria-label="Nombre del extra" placeholder="Nombre" value={e.name} onChange={(ev) => setExtra(i, { name: ev.target.value })} />
            <Input
              aria-label="Precio del extra"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Precio"
              value={e.price}
              onChange={(ev) => setExtra(i, { price: ev.target.value })}
            />
          </div>
        </div>
      ))}
      {value.extras.length < 5 && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => onChange({ ...value, extras: [...value.extras, { name: "", price: "" }] })}
        >
          + Agregar tratamiento extra
        </Button>
      )}
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-total`} className="block text-sm">
          Precio total {value.extras.length > 0 ? "(combo)" : ""}
        </label>
        <Input
          id={`${idPrefix}-total`}
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={String(list)}
          value={value.totalPrice}
          onChange={(ev) => onChange({ ...value, totalPrice: ev.target.value })}
        />
        <p className="text-xs text-muted">
          Precio de lista: {formatARS(list)}. Dejalo vacío para usar ese, o poné el precio del combo.
        </p>
      </div>
    </div>
  );
}
