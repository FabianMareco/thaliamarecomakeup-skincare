"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Textarea } from "@/components/ui";
import type { ActionResult } from "@/server/errors";
import { approveReceiptAction, approveSameDayAction, markRefundedAction, rejectAction, resubmitAction } from "../actions";

/** Ejecuta una acción del servidor mostrando estado y error. */
export function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult<unknown>>, okMsg?: string, onOk?: () => void) =>
    start(async () => {
      setError(null);
      setDone(null);
      const r = await fn();
      if (r.ok) {
        if (okMsg) setDone(okMsg);
        onOk?.();
      } else setError(r.error);
    });
  return { pending, error, done, run, setError };
}

export function Feedback({ error, done }: { error: string | null; done?: string | null }) {
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (done) return <Alert tone="ok">{done}</Alert>;
  return null;
}

/** Aprobar / pedir reenviar / rechazar un comprobante (sección 10.2). */
export function ReceiptActions({ bookingId }: { bookingId: string }) {
  const { pending, error, run } = useAction();
  const [mode, setMode] = useState<null | "resubmit" | "reject">(null);
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <Feedback error={error} />
      {mode ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor={`reason-${bookingId}`}>
            {mode === "resubmit" ? "Motivo (lo ve la clienta)" : "Motivo del rechazo (lo ve la clienta)"}
          </label>
          <Textarea id={`reason-${bookingId}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === "resubmit" ? "Ej.: no se ve el monto" : "Ej.: el dinero no ingresó"} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setMode(null)} disabled={pending}>
              Volver
            </Button>
            <Button
              variant={mode === "reject" ? "danger" : "primary"}
              className="flex-1"
              disabled={pending || (mode === "resubmit" && reason.trim().length < 3)}
              onClick={() => run(() => (mode === "resubmit" ? resubmitAction(bookingId, reason) : rejectAction(bookingId, reason)))}
            >
              {mode === "resubmit" ? "Pedir reenviar" : "Rechazar y liberar horario"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button className="col-span-3" disabled={pending} onClick={() => run(() => approveReceiptAction(bookingId))}>
            {pending ? "…" : "Aprobar"}
          </Button>
          <Button variant="secondary" className="col-span-2 px-3" disabled={pending} onClick={() => setMode("resubmit")}>
            Pedir reenviar
          </Button>
          <Button variant="danger" className="px-3" disabled={pending} onClick={() => setMode("reject")}>
            Rechazar
          </Button>
        </div>
      )}
    </div>
  );
}

export function SameDayActions({ bookingId }: { bookingId: string }) {
  const { pending, error, run } = useAction();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-2">
      <Feedback error={error} />
      {rejecting ? (
        <>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mensaje para la clienta (opcional)" aria-label="Mensaje para la clienta" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setRejecting(false)} disabled={pending}>
              Volver
            </Button>
            <Button variant="danger" className="flex-1" disabled={pending} onClick={() => run(() => rejectAction(bookingId, reason))}>
              Rechazar
            </Button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <Button className="flex-1" disabled={pending} onClick={() => run(() => approveSameDayAction(bookingId))}>
            Aprobar y enviar link de pago
          </Button>
          <Button variant="danger" disabled={pending} onClick={() => setRejecting(true)}>
            Rechazar
          </Button>
        </div>
      )}
    </div>
  );
}

export function RefundDoneButton({ bookingId }: { bookingId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-2">
      <Feedback error={error} />
      <Button variant="secondary" className="w-full" disabled={pending} onClick={() => run(() => markRefundedAction(bookingId))}>
        Marcar como reintegrado
      </Button>
    </div>
  );
}
