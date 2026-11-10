"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SlotPicker, type PickerDay } from "@/components/SlotPicker";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { fmtDateStrLong } from "@/lib/domain/time";
import { cancelBooking, fetchRescheduleOptions, rescheduleBooking } from "../../actions";

type Mode = null | "reschedule" | "refund" | "forfeit";

export function ManageActions({
  token,
  canReschedule,
  canCancelWithRefund,
  canCancelForfeit,
  depositLabel,
  horizonDays,
  windowHours,
}: {
  token: string;
  canReschedule: boolean;
  canCancelWithRefund: boolean;
  canCancelForfeit: boolean;
  depositLabel: string;
  horizonDays: number;
  windowHours: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [days, setDays] = useState<PickerDay[] | null>(null);
  const [today, setToday] = useState("");
  const [slot, setSlot] = useState<{ id: string; date: string; time: string } | null>(null);
  const [destination, setDestination] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const open = (m: Mode) => {
    setError(null);
    setMode(m);
    if (m === "reschedule" && !days) {
      start(async () => {
        const r = await fetchRescheduleOptions(token);
        if (r.ok) {
          setDays(r.data.days);
          setToday(r.data.today);
        } else setError(r.error);
      });
    }
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        setMode(null);
        router.refresh();
      } else setError(r.error ?? "No se pudo completar la acción.");
    });

  return (
    <div className="space-y-3">
      {!mode && (
        <div className="grid gap-2">
          {canReschedule && (
            <Button variant="secondary" onClick={() => open("reschedule")}>
              Reprogramar
            </Button>
          )}
          {canCancelWithRefund && (
            <Button variant="danger" onClick={() => open("refund")}>
              Cancelar con reintegro de la seña
            </Button>
          )}
          {canCancelForfeit && (
            <Button variant="danger" onClick={() => open("forfeit")}>
              Cancelar el turno
            </Button>
          )}
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {mode === "reschedule" && (
        <Card className="space-y-4">
          <h2 className="font-display text-xl">Elegí el nuevo horario</h2>
          <p className="text-sm text-muted">Podés reprogramar una sola vez online. No hace falta pagar una seña nueva.</p>
          {!days ? (
            <p className="text-muted">Buscando horarios…</p>
          ) : (
            <SlotPicker days={days} today={today} horizonDays={horizonDays} value={slot?.id ?? null} onChange={(id, date, time) => setSlot({ id, date, time })} />
          )}
          {slot && (
            <p className="text-[15px]">
              Nuevo turno: <strong className="first-letter:uppercase">{fmtDateStrLong(slot.date)}, {slot.time} hs</strong>
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setMode(null)} disabled={pending}>
              Volver
            </Button>
            <Button className="flex-1" disabled={!slot || pending} onClick={() => slot && run(() => rescheduleBooking(token, slot.id))}>
              {pending ? "Guardando…" : "Confirmar cambio"}
            </Button>
          </div>
        </Card>
      )}

      {mode === "refund" && (
        <Card className="space-y-4">
          <h2 className="font-display text-xl">Cancelar con reintegro</h2>
          <p className="text-[15px]">
            Te reintegramos la seña de <strong>{depositLabel}</strong> por transferencia. Indicanos a dónde.
          </p>
          <Field label="Alias o CBU/CVU para el reintegro" htmlFor="destination">
            <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} autoComplete="off" />
          </Field>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setMode(null)} disabled={pending}>
              Volver
            </Button>
            <Button variant="danger" className="flex-1" disabled={destination.trim().length < 6 || pending} onClick={() => run(() => cancelBooking(token, true, destination))}>
              {pending ? "Cancelando…" : "Confirmar cancelación"}
            </Button>
          </div>
        </Card>
      )}

      {mode === "forfeit" && (
        <Card className="space-y-4">
          <Alert tone="warn" title="La seña no se reintegra">
            Faltan menos de {windowHours} hs para tu turno. Si cancelás ahora, perdés la seña de {depositLabel}. Si preferís, escribinos por
            WhatsApp.
          </Alert>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setMode(null)} disabled={pending}>
              Volver
            </Button>
            <Button variant="danger" className="flex-1" disabled={pending} onClick={() => run(() => cancelBooking(token, false))}>
              {pending ? "Cancelando…" : "Cancelar sin reintegro"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
