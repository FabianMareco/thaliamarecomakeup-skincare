"use client";

import { useState } from "react";
import { Badge, Button, Card, cx, Field, Input, Select } from "@/components/ui";
import { formatARS } from "@/lib/domain/money";
import type { Line, Service } from "@/lib/domain/types";
import { Feedback, useAction } from "../../_components/actions";
import { saveServiceAction } from "../../actions";

type Draft = {
  id?: string;
  line: Line;
  category: string;
  name: string;
  description: string;
  badge: string;
  price: string;
  durationMin: string;
  modality: "in_person" | "virtual";
  includesTrial: boolean;
  active: boolean;
  order: string;
};

const toDraft = (s: Service): Draft => ({
  id: s.id,
  line: s.line,
  category: s.category,
  name: s.name,
  description: s.description ?? "",
  badge: s.badge ?? "",
  price: String(s.price),
  durationMin: s.durationMin ? String(s.durationMin) : "",
  modality: s.modality,
  includesTrial: !!s.includesTrial,
  active: s.active,
  order: String(s.order),
});

export function ServicesEditor({ services }: { services: Service[] }) {
  const [line, setLine] = useState<Line>("skincare");
  const [editing, setEditing] = useState<Draft | null>(null);
  const list = services.filter((s) => s.line === line);
  const nextOrder = (list.at(-1)?.order ?? 0) + 10;

  return (
    <div className="space-y-4">
      <div className="flex rounded-full border border-line bg-white p-0.5 text-sm">
        {(["skincare", "makeup"] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLine(l)} className={cx("flex-1 rounded-full px-3 py-2", line === l ? "bg-ink text-white" : "text-muted")}>
            {l === "skincare" ? "Skincare" : "Maquillaje"}
          </button>
        ))}
      </div>

      {editing ? (
        <ServiceForm draft={editing} onClose={() => setEditing(null)} />
      ) : (
        <Button
          className="w-full"
          onClick={() =>
            setEditing({
              line,
              category: list[0]?.category ?? "",
              name: "",
              description: "",
              badge: "",
              price: "",
              durationMin: line === "skincare" ? "60" : "",
              modality: "in_person",
              includesTrial: false,
              active: true,
              order: String(nextOrder),
            })
          }
        >
          + Nuevo servicio
        </Button>
      )}

      <ul className="space-y-2">
        {list.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => setEditing(toDraft(s))} className="w-full rounded-2xl border border-line bg-white p-4 text-left hover:border-accent">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{s.category}</p>
                  <p className="font-medium leading-snug">{s.name}</p>
                  <p className="text-sm text-muted">
                    {formatARS(s.price)}
                    {s.durationMin ? ` · ${s.durationMin} min` : ""}
                    {s.modality === "virtual" ? " · virtual" : ""}
                    {s.includesTrial ? " · incluye prueba" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {!s.active && <Badge tone="danger">Inactivo</Badge>}
                  {s.badge && <Badge tone="accent">{s.badge}</Badge>}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ServiceForm({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { pending, error, run } = useAction();
  const [d, setD] = useState(draft);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  return (
    <Card className="space-y-3">
      <h2 className="font-medium">{d.id ? "Editar servicio" : "Nuevo servicio"}</h2>
      <Field label="Nombre" htmlFor="s-name">
        <Input id="s-name" value={d.name} onChange={set("name")} />
      </Field>
      <Field label="Categoría" htmlFor="s-cat">
        <Input id="s-cat" value={d.category} onChange={set("category")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio" htmlFor="s-price">
          <Input id="s-price" type="number" inputMode="numeric" value={d.price} onChange={set("price")} />
        </Field>
        {d.line === "skincare" ? (
          <Field label="Duración (min)" htmlFor="s-dur">
            <Input id="s-dur" type="number" inputMode="numeric" value={d.durationMin} onChange={set("durationMin")} />
          </Field>
        ) : (
          <Field label="Orden" htmlFor="s-order">
            <Input id="s-order" type="number" inputMode="numeric" value={d.order} onChange={set("order")} />
          </Field>
        )}
      </div>
      {d.line === "skincare" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Modalidad" htmlFor="s-mod">
            <Select id="s-mod" value={d.modality} onChange={(e) => setD({ ...d, modality: e.target.value as Draft["modality"] })}>
              <option value="in_person">Presencial</option>
              <option value="virtual">Virtual</option>
            </Select>
          </Field>
          <Field label="Orden" htmlFor="s-order2">
            <Input id="s-order2" type="number" inputMode="numeric" value={d.order} onChange={set("order")} />
          </Field>
        </div>
      )}
      {d.line === "skincare" && (
        <Field label="Etiqueta (opcional)" htmlFor="s-badge" hint='Ej.: "Ideal 1ª sesión"'>
          <Input id="s-badge" value={d.badge} onChange={set("badge")} />
        </Field>
      )}
      <Field label="Descripción (opcional)" htmlFor="s-desc">
        <Input id="s-desc" value={d.description} onChange={set("description")} />
      </Field>
      {d.line === "makeup" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={d.includesTrial} onChange={(e) => setD({ ...d, includesTrial: e.target.checked })} />
          Incluye prueba previa
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />
        Activo (visible para las clientas)
      </label>
      <Feedback error={error} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button
          className="flex-1"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                saveServiceAction({
                  ...d,
                  price: Number(d.price),
                  order: Number(d.order),
                  durationMin: d.line === "skincare" ? Number(d.durationMin) : undefined,
                }),
              undefined,
              onClose,
            )
          }
        >
          Guardar
        </Button>
      </div>
    </Card>
  );
}
