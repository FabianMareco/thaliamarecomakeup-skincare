import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingSummary } from "@/components/BookingSummary";
import { WhatsAppButton } from "@/components/site";
import { Alert, ButtonLink, PageTitle } from "@/components/ui";
import { formatARS } from "@/lib/domain/money";
import { fmtDateTimeLong } from "@/lib/domain/time";
import { getManageView } from "@/server/views";
import { ManageActions } from "./ManageActions";

export const metadata: Metadata = { title: "Mi reserva", robots: { index: false } };

export default async function GestionarPage(props: PageProps<"/turnos/gestionar/[token]">) {
  const { token } = await props.params;
  const view = await getManageView(token);
  if (!view) notFound();
  const { booking: b, options } = view;
  const wa = `Hola! Te escribo por la reserva ${b.code}`;

  return (
    <div className="space-y-6">
      <PageTitle eyebrow={`Reserva ${b.code}`} title="Mi reserva" />
      <BookingSummary b={b} address={view.address} />

      {["awaiting_payment", "awaiting_approval", "awaiting_verification", "requested"].includes(b.status) && (
        <ButtonLink href={`/turnos/pago/${token}`} className="w-full">
          {b.status === "awaiting_payment" ? "Ver datos para transferir la seña" : "Ver estado de la reserva"}
        </ButtonLink>
      )}

      {b.status === "confirmed" && b.line === "skincare" && (
        <Alert tone="info">El estudio no tiene sala de espera y los turnos empiezan puntuales. Te pedimos llegar a horario.</Alert>
      )}

      {b.status === "confirmed" && b.line === "skincare" && view.refundDeadline && (options.canCancelWithRefund || options.canReschedule) && (
        <p className="text-[15px] leading-relaxed">
          Tenés hasta el <strong>{fmtDateTimeLong(view.refundDeadline)}</strong> para reprogramar o cancelar con reintegro de la seña.
        </p>
      )}

      {(options.canReschedule || options.canCancelWithRefund || options.canCancelForfeit) && (
        <ManageActions
          token={token}
          canReschedule={options.canReschedule}
          canCancelWithRefund={options.canCancelWithRefund}
          canCancelForfeit={options.canCancelForfeit}
          depositLabel={formatARS(b.depositAmount)}
          horizonDays={view.bookingHorizonDays}
          windowHours={view.cancellationWindowHours}
        />
      )}

      {b.status === "confirmed" && b.line === "skincare" && options.canCancelWithRefund && !options.canReschedule && (
        <p className="text-sm text-muted">Ya usaste la reprogramación online. Para otro cambio, escribinos por WhatsApp.</p>
      )}

      {b.status === "confirmed" && b.line === "makeup" && (
        <Alert tone="info">La seña no se reintegra. Para cualquier cambio, escribinos por WhatsApp.</Alert>
      )}

      {b.status === "cancelled_refunded" && (
        <Alert tone={b.depositStatus === "refunded" ? "ok" : "info"} title="Reserva cancelada">
          {b.depositStatus === "refunded"
            ? `Ya te reintegramos la seña de ${formatARS(b.depositAmount)}.`
            : `Vamos a reintegrarte la seña de ${formatARS(b.depositAmount)}${b.refundDestination ? ` a ${b.refundDestination}` : ""}. Te avisamos cuando esté hecho.`}
        </Alert>
      )}
      {b.status === "cancelled_forfeited" && <Alert tone="info" title="Reserva cancelada">La seña no se reintegra.</Alert>}
      {(b.status === "rejected" || b.status === "expired") && (
        <Alert tone="danger" title={b.status === "rejected" ? "La reserva no pudo confirmarse" : "La reserva venció"}>
          {b.rejectionReason ? `Motivo: ${b.rejectionReason}` : "Si querés, escribinos por WhatsApp y buscamos otra opción."}
        </Alert>
      )}

      <details className="rounded-2xl bg-sand/60 p-4 text-sm leading-relaxed">
        <summary className="cursor-pointer font-medium">Política de reserva</summary>
        <p className="mt-2">{view.policy}</p>
      </details>
      <WhatsAppButton number={view.whatsappNumber} text={wa} label="Contactar por WhatsApp" className="w-full" />
    </div>
  );
}
