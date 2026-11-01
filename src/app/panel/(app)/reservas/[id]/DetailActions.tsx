"use client";

import { useState } from "react";
import { SlotPicker, type PickerDay } from "@/components/SlotPicker";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { formatARS, makeupDeposit } from "@/lib/domain/money";
import { fmtDateStrLong } from "@/lib/domain/time";
import type { Line } from "@/lib/domain/types";
import { Feedback, useAction } from "../../../_components/actions";
import {
  acceptMakeupAction,
  attendanceAction,
  balanceAction,
  cancelAction,
  confirmManualAction,
  notesAction,
  refundPendingAction,
  rejectAction,
  rescheduleAction,
  rescheduleOptionsAction,
} from "../../../actions";

export function AcceptMakeupForm({
  bookingId,
  defaultPrice,
  includesTrial,
  preferredTrialDate,
  homeService,
  depositPercent,
}: {
  bookingId: string;
  depositPercent: number;
  defaultPrice: number;
  includesTrial: boolean;
  preferredTrialDate: string;
  homeService: boolean;
}) {
  const { pending, error, run, setError } = useAction();
  const [f, setF] = useState({ finalPrice: String(defaultPrice), travelFee: "0", startTime: "", trialDate: preferredTrialDate, trialTime: "" });
  const [warnings, setWarnings] = useState<{ kind: string; label: string }[] | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [message, setMessage] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setWarnings(null);
    setF({ ...f, [k]: e.target.value });
  };
  const price = Number(f.finalPrice) || 0;
  const travel = Number(f.travelFee) || 0;
  const preview = makeupDeposit(price, depositPercent, travel);

  const submit = (force: boolean) =>
    run(async () => {
      const r = await acceptMakeupAction(bookingId, {
        finalPrice: price,
        travelFee: travel,
        startTime: f.startTime,
        trialDate: includesTrial ? f.trialDate : "",
        trialTime: includesTrial ? f.trialTime : "",
        force,
      });
      if (r.ok && !r.data.accepted) {
        setWarnings(r.data.warnings);
        setError(null);
      }
      return r;
    });

  if (rejecting) {
    return (
      <div className="space-y-2">
        <Field label="Mensaje para la clienta (opcional)" htmlFor="rej-msg">
          <Textarea id="rej-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ej.: ya tengo esa fecha ocupada" />
        </Field>
        <Feedback error={error} />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setRejecting(false)} disabled={pending}>
            Volver
          </Button>
          <Button variant="danger" className="flex-1" disabled={pending} onClick={() => run(() => rejectAction(bookingId, message))}>
            Rechazar solicitud
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio final" htmlFor="finalPrice" hint="Por defecto: lista × personas">
          <Input id="finalPrice" type="number" inputMode="numeric" min={0} value={f.finalPrice} onChange={set("finalPrice")} />
        </Field>
        <Field label="Viático" htmlFor="travelFee" hint={homeService ? "A domicilio" : "En estudio: 0"}>
          <Input id="travelFee" type="number" inputMode="numeric" min={0} value={f.travelFee} onChange={set("travelFee")} />
        </Field>
      </div>
      <Field label="Hora de inicio" htmlFor="startTime">
        <Input id="startTime" type="time" required value={f.startTime} onChange={set("startTime")} />
      </Field>
      {includesTrial && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de la prueba" htmlFor="trialDate">
            <Input id="trialDate" type="date" value={f.trialDate} onChange={set("trialDate")} />
          </Field>
          <Field label="Hora de la prueba" htmlFor="trialTime">
            <Input id="trialTime" type="time" value={f.trialTime} onChange={set("trialTime")} />
          </Field>
        </div>
      )}
      <p className="text-sm text-muted">
        Seña ({depositPercent} % del precio, sin viático): <strong className="text-ink">{formatARS(preview.deposit)}</strong> · Saldo el día del evento:{" "}
        <strong className="text-ink">{formatARS(preview.balance)}</strong>
      </p>
      {warnings && warnings.length > 0 && (
        <Alert tone="warn" title="Hay superposiciones con tu agenda">
          <ul className="list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>
                {w.kind === "trial" ? "Prueba — " : "Evento — "}
                {w.label}
              </li>
            ))}
          </ul>
          <p className="mt-2">Podés aceptar igual; los horarios de skincare no se bloquean solos.</p>
        </Alert>
      )}
      <Feedback error={error} />
      <div className="flex gap-2">
        <Button variant="danger" onClick={() => setRejecting(true)} disabled={pending}>
          Rechazar
        </Button>
        {warnings && warnings.length > 0 ? (
          <Button className="flex-1" disabled={pending} onClick={() => submit(true)}>
            Aceptar igualmente
          </Button>
        ) : (
          <Button className="flex-1" disabled={pending || !f.startTime} onClick={() => submit(false)}>
            Aceptar y enviar link de pago
          </Button>
        )}
      </div>
    </div>
  );
}

export function ManualConfirmForm({ bookingId }: { bookingId: string }) {
  const { pending, error, run } = useAction();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant="ghost" className="w-full" onClick={() => setOpen(true)}>
        Confirmar seña recibida por fuera del sistema
      </Button>
    );
  return (
    <form
      className="space-y-3 rounded-xl border border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => confirmManualAction(bookingId, fd));
      }}
    >
      <p className="text-sm">Usalo si la clienta te mandó la seña por otro medio (por ejemplo, por WhatsApp). La reserva queda confirmada.</p>
      <Field label="Titular que transfirió (opcional)" htmlFor="m-payer">
        <Input id="m-payer" name="payerName" />
      </Field>
      <Field label="Comprobante (opcional)" htmlFor="m-file">
        <input id="m-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="block w-full text-sm" />
      </Field>
      <Feedback error={error} />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
          Volver
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          Confirmar seña
        </Button>
      </div>
    </form>
  );
}

export function RescheduleForm({ bookingId }: { bookingId: string }) {
  const { pending, error, run, setError } = useAction();
  const [days, setDays] = useState<PickerDay[] | null>(null);
  const [today, setToday] = useState("");
  const [slot, setSlot] = useState<{ id: string; date: string; time: string } | null>(null);
  if (!days)
    return (
      <>
        <Feedback error={error} />
        <Button
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={async () => {
            const r = await rescheduleOptionsAction(bookingId);
            if (r.ok) {
              setDays(r.data.days);
              setToday(r.data.today);
            } else setError(r.error);
          }}
        >
          Elegir otro horario
        </Button>
      </>
    );
  return (
    <div className="space-y-3">
      <SlotPicker days={days} today={today} horizonDays={365} value={slot?.id ?? null} onChange={(id, date, time) => setSlot({ id, date, time })} />
      {slot && (
        <p className="text-sm">
          Nuevo horario: <strong>{fmtDateStrLong(slot.date)}, {slot.time} hs</strong>
        </p>
      )}
      <Feedback error={error} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setDays(null)} disabled={pending}>
          Cerrar
        </Button>
        <Button className="flex-1" disabled={!slot || pending} onClick={() => slot && run(() => rescheduleAction(bookingId, slot.id), undefined, () => setDays(null))}>
          Reprogramar y avisar a la clienta
        </Button>
      </div>
    </div>
  );
}

export function CancelForm({ bookingId, line }: { bookingId: string; line: Line }) {
  const { pending, error, run } = useAction();
  const [refund, setRefund] = useState<"" | "yes" | "no">("");
  const [destination, setDestination] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {line === "makeup" ? "En maquillaje la seña no se reintegra, salvo que vos decidas lo contrario." : "Podés cancelar con o sin reintegro, sin importar la regla de 48 hs."}
      </p>
      <Select value={refund} onChange={(e) => setRefund(e.target.value as "" | "yes" | "no")} aria-label="Tipo de cancelación">
        <option value="">Elegí cómo cancelar</option>
        <option value="no">Cancelar sin reintegro (seña retenida)</option>
        <option value="yes">Cancelar con reintegro de la seña</option>
      </Select>
      {refund === "yes" && (
        <Field label="Alias o CBU para el reintegro (opcional)" htmlFor="c-dest">
          <Input id="c-dest" value={destination} onChange={(e) => setDestination(e.target.value)} />
        </Field>
      )}
      <Feedback error={error} />
      <Button variant="danger" className="w-full" disabled={!refund || pending} onClick={() => run(() => cancelAction(bookingId, refund === "yes", destination))}>
        Cancelar reserva y avisar a la clienta
      </Button>
    </div>
  );
}

export function ExceptionalRefundForm({ bookingId }: { bookingId: string }) {
  const { pending, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState("");
  if (!open)
    return (
      <Button variant="ghost" className="w-full" onClick={() => setOpen(true)}>
        Reintegrar la seña de forma excepcional
      </Button>
    );
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <Field label="Alias o CBU de la clienta" htmlFor="x-dest">
        <Input id="x-dest" value={destination} onChange={(e) => setDestination(e.target.value)} />
      </Field>
      <Feedback error={error} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
          Volver
        </Button>
        <Button className="flex-1" disabled={pending || destination.trim().length < 6} onClick={() => run(() => refundPendingAction(bookingId, destination))}>
          Pasar a reintegro pendiente
        </Button>
      </div>
    </div>
  );
}

export function AttendanceButtons({ bookingId }: { bookingId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-2">
      <Feedback error={error} />
      <div className="flex gap-2">
        <Button className="flex-1" disabled={pending} onClick={() => run(() => attendanceAction(bookingId, true))}>
          Asistió
        </Button>
        <Button variant="danger" className="flex-1" disabled={pending} onClick={() => run(() => attendanceAction(bookingId, false))}>
          No vino
        </Button>
      </div>
    </div>
  );
}

export function BalanceForm({ bookingId }: { bookingId: string }) {
  const { pending, error, run } = useAction();
  const [method, setMethod] = useState("efectivo");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-40 flex-1">
        <Field label="Registrar saldo cobrado" htmlFor="b-method">
          <Select id="b-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="otro">Otro</option>
          </Select>
        </Field>
      </div>
      <Button variant="secondary" disabled={pending} onClick={() => run(() => balanceAction(bookingId, method))}>
        Registrar
      </Button>
      <div className="w-full">
        <Feedback error={error} />
      </div>
    </div>
  );
}

export function NotesForm({ bookingId, initial }: { bookingId: string; initial: string }) {
  const { pending, error, done, run } = useAction();
  const [notes, setNotes] = useState(initial);
  return (
    <div className="space-y-2">
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notas internas" placeholder="Solo las ves vos" />
      <Feedback error={error} done={done} />
      <Button variant="secondary" disabled={pending || notes === initial} onClick={() => run(() => notesAction(bookingId, notes), "Notas guardadas")}>
        Guardar notas
      </Button>
    </div>
  );
}
