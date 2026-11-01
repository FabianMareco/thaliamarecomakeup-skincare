import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingSummary } from "@/components/BookingSummary";
import { CopyButton, Countdown } from "@/components/client-bits";
import { WhatsAppButton } from "@/components/site";
import { Alert, ButtonLink, Card, PageTitle } from "@/components/ui";
import { formatARS } from "@/lib/domain/money";
import { arTimeStr } from "@/lib/domain/time";
import { getPaymentView } from "@/server/views";
import { ReceiptForm } from "./ReceiptForm";

export const metadata: Metadata = { title: "Pago de la seña", robots: { index: false } };

export default async function PagoPage(props: PageProps<"/turnos/pago/[token]">) {
  const { token } = await props.params;
  const view = await getPaymentView(token);
  if (!view) notFound();
  const { booking: b, payment } = view;
  const place = b.line === "makeup" ? "la fecha" : "el horario";

  return (
    <div className="space-y-6">
      <PageTitle eyebrow={`Reserva ${b.code}`} title={payment ? "Transferí la seña" : "Tu reserva"} />
      <BookingSummary b={b} />

      {b.status === "awaiting_approval" && (
        <Alert tone="warn" title="Tu solicitud está pendiente de confirmación">
          Como el turno es para hoy, Thalia tiene que aprobarlo. Cuando lo apruebe te llega por email y WhatsApp el link para transferir la
          seña. <strong>No transfieras nada todavía.</strong>
          {b.approvalDeadline && <> Vas a tener una respuesta antes de las {arTimeStr(b.approvalDeadline)} hs.</>}
        </Alert>
      )}

      {b.status === "requested" && (
        <Alert tone="info" title="Recibimos tu solicitud">
          Thalia la va a revisar y, si tiene la fecha disponible, te manda el precio final y el link para abonar la seña.
        </Alert>
      )}

      {payment && (
        <>
          {payment.resubmitReason && (
            <Alert tone="warn" title="Thalia necesita que vuelvas a enviar el comprobante">
              Motivo: {payment.resubmitReason}
            </Alert>
          )}
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-muted">Monto exacto a transferir</p>
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-3xl tabular-nums">{formatARS(payment.amount)}</p>
                <CopyButton value={String(payment.amount)} label="Copiar monto" />
              </div>
            </div>
            <dl className="space-y-3 text-[15px]">
              {[
                ["Alias", payment.alias],
                ["CVU", payment.cvu],
                ["Titular", payment.holderName],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="break-all font-medium">{value}</dd>
                  </div>
                  {label !== "Titular" && <CopyButton value={value} />}
                </div>
              ))}
              <div>
                <dt className="text-xs text-muted">Banco / billetera</dt>
                <dd className="font-medium">{payment.provider}</dd>
              </div>
            </dl>
          </Card>
          {payment.deadline && (
            <Alert tone="warn">
              Tiempo para subir el comprobante:{" "}
              <strong>
                <Countdown until={payment.deadline.toISOString()} onDoneReload />
              </strong>
              . Si no recibimos el comprobante a tiempo, {place} se libera.
            </Alert>
          )}
          <ReceiptForm token={token} />
        </>
      )}

      {b.status === "awaiting_payment" && view.expiredByDeadline && (
        <Alert tone="danger" title="Se venció el plazo">
          No recibimos el comprobante a tiempo y {place} se liberó. Si ya transferiste, escribinos por WhatsApp.
        </Alert>
      )}

      {b.status === "awaiting_verification" && (
        <Alert tone="ok" title="Recibimos tu comprobante">
          Thalia lo va a verificar y te llega la confirmación por email y WhatsApp.
        </Alert>
      )}

      {b.status === "confirmed" && (
        <div className="space-y-3">
          <Alert tone="ok" title="¡Tu reserva está confirmada!">
            Te enviamos todos los detalles por email y WhatsApp.
          </Alert>
          <ButtonLink href={`/turnos/gestionar/${token}`} variant="secondary" className="w-full">
            Ver o gestionar mi reserva
          </ButtonLink>
        </div>
      )}

      {(b.status === "rejected" || b.status === "expired") && (
        <Alert tone="danger" title={b.status === "rejected" ? "La reserva no pudo confirmarse" : "La reserva venció"}>
          {b.rejectionReason ? <>Motivo: {b.rejectionReason}. </> : null}
          Si querés, escribinos por WhatsApp y buscamos otra opción.
        </Alert>
      )}

      {(b.status.startsWith("cancelled") || b.status === "completed" || b.status === "no_show") && (
        <ButtonLink href={`/turnos/gestionar/${token}`} variant="secondary" className="w-full">
          Ver mi reserva
        </ButtonLink>
      )}

      <div className="space-y-3 pt-2">
        <details className="rounded-2xl bg-sand/60 p-4 text-sm leading-relaxed">
          <summary className="cursor-pointer font-medium">Política de reserva</summary>
          <p className="mt-2">{view.policy}</p>
        </details>
        <WhatsAppButton number={view.whatsappNumber} text={`Hola! Te escribo por la reserva ${b.code}`} label="Consultar por WhatsApp" className="w-full" />
      </div>
    </div>
  );
}
