"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { Feedback, useAction } from "../../../_components/actions";
import { updatePatientAction } from "../../../actions";

export function EditPatient({ id, initial }: { id: string; initial: { name: string; phone: string; email: string } }) {
  const router = useRouter();
  const { pending, error, done, run } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(initial);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Editar datos
      </Button>
    );
  }
  return (
    <form
      className="w-full space-y-3 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => updatePatientAction(id, f),
          (d) => {
            // Si cambió el WhatsApp, la ficha pasa a otra dirección.
            if (d.id !== id) router.replace(`/panel/pacientes/${encodeURIComponent(d.id)}`);
            return "Datos actualizados";
          },
          () => setOpen(false),
        );
      }}
    >
      <Field label="Nombre y apellido" htmlFor="p-name">
        <Input id="p-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="WhatsApp" htmlFor="p-phone" hint="Con código de área, ej. 11 5847-0009.">
        <Input id="p-phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </Field>
      <Field label="Email (opcional)" htmlFor="p-email">
        <Input id="p-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <p className="text-xs text-muted">Se actualizan también todas sus reservas, así los avisos llegan a los datos nuevos.</p>
      <Feedback error={error} done={done} />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setF(initial);
            setOpen(false);
          }}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
