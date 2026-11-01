import { notFound } from "next/navigation";
import { CopyButton } from "@/components/client-bits";
import { WhatsAppButton } from "@/components/site";
import { Alert, Badge, Card, Row } from "@/components/ui";
import { fmtDateStrLong, fmtDateTimeShort } from "@/lib/domain/time";
import { DEPOSIT_LABEL, STATUS_LABEL } from "@/lib/domain/transitions";
import { manageUrl, paymentUrl } from "@/server/links";
import { getBooking } from "@/server/repo/bookings";
import { getService } from "@/server/repo/services";
import { getTenant } from "@/server/repo/tenant";
import { ReceiptActions, RefundDoneButton, SameDayActions } from "../../../_components/actions";
import { money, ReceiptPreview, StatusBadge, whenShort } from "../../../_components/bits";
import { AcceptMakeupForm, AttendanceButtons, BalanceForm, CancelForm, ExceptionalRefundForm, ManualConfirmForm, NotesForm, RescheduleForm } from "./DetailActions";

export const metadata = { title: "Reserva" };

export default async function ReservaPage(props: PageProps<"/panel/reservas/[id]">) {
  const { id } = await props.params;
  const b = await getBooking(id);
  if (!b) notFound();
  const [service, tenant] = await Promise.all([b.line === "makeup" ? getService(b.service.id) : null, getTenant()]);
  const active = ["awaiting_payment", "awaiting_verification", "confirmed"].includes(b.status);
  const actor = { client: "Clienta", admin: "Thalia", system: "Sistema" };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">{b.code}</span>
          <StatusBadge status={b.status} />
          <Badge tone="neutral">{b.line === "skincare" ? "Skincare" : "Maquillaje"}</Badge>
        </div>
        <h1 className="font-display text-2xl leading-tight">{b.service.name}</h1>
        <p className="text-[15px]">{whenShort(b)}</p>
      </header>

      <Card className="space-y-1">
        <Row label="Clienta">{b.client.name}</Row>
        <Row label="WhatsApp">{b.client.phone}</Row>
        <Row label="Email">{b.client.email}</Row>
        {b.line === "skincare" && <Row label="Primera vez">{b.client.firstVisit ? "Sí" : "No"}</Row>}
        <div className="flex flex-wrap gap-2 pt-3">
          <WhatsAppButton number={b.client.phone} text={`Hola ${b.client.name.split(" ")[0]}! Te escribo por tu reserva ${b.code}.`} label="WhatsApp" />
          <a href={`/panel/clientas/${encodeURIComponent(b.clientId)}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm">
            Ver historial
          </a>
        </div>
      </Card>

      {b.makeup && (
        <Card className="space-y-1">
          <h2 className="pb-1 font-medium">Detalle del evento</h2>
          <Row label="Fecha">{fmtDateStrLong(b.makeup.eventDate)}</Row>
          <Row label="Lista a las">{b.makeup.readyByTime} hs</Row>
          {b.makeup.startTime && <Row label="Inicio">{b.makeup.startTime} hs</Row>}
          <Row label="Lugar">{b.makeup.location === "home" ? `Domicilio: ${b.makeup.homeAddress}` : "Estudio"}</Row>
          <Row label="Personas">{b.makeup.peopleCount}</Row>
          {b.makeup.preferredTrialDate && <Row label="Prueba preferida">{fmtDateStrLong(b.makeup.preferredTrialDate)}</Row>}
          {b.makeup.trialDate && <Row label="Prueba">{`${fmtDateStrLong(b.makeup.trialDate)} ${b.makeup.trialTime} hs`}</Row>}
          {b.makeup.finalPrice !== undefined && <Row label="Precio final">{money(b.makeup.finalPrice)}</Row>}
          {b.makeup.travelFee ? <Row label="Viático">{money(b.makeup.travelFee)}</Row> : null}
          {b.makeup.comments && <p className="pt-2 text-sm"><span className="text-muted">Comentarios:</span> {b.makeup.comments}</p>}
        </Card>
      )}

      {b.status === "awaiting_approval" && (
        <Card className="space-y-3">
          <h2 className="font-medium">Solicitud para hoy</h2>
          <SameDayActions bookingId={b.id} />
        </Card>
      )}

      {b.status === "requested" && b.makeup && (
        <Card className="space-y-3">
          <h2 className="font-medium">Aceptar o rechazar la solicitud</h2>
          <AcceptMakeupForm
            bookingId={b.id}
            defaultPrice={(service?.price ?? b.service.price) * b.makeup.peopleCount}
            includesTrial={!!service?.includesTrial}
            preferredTrialDate={b.makeup.preferredTrialDate ?? ""}
            homeService={b.makeup.location === "home"}
            depositPercent={tenant.makeup.depositPercent}
          />
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-medium">Seña y pagos</h2>
        <div>
          <Row label="Seña">{b.deposit.amount ? money(b.deposit.amount) : "A definir"}</Row>
          <Row label="Estado de la seña">{DEPOSIT_LABEL[b.deposit.status]}</Row>
          {b.deposit.receiptUploadDeadline && b.status === "awaiting_payment" && (
            <Row label="Plazo para el comprobante">{fmtDateTimeShort(b.deposit.receiptUploadDeadline)}</Row>
          )}
          {b.deposit.refundDestination && <Row label="Reintegro a">{b.deposit.refundDestination}</Row>}
          <Row label="Saldo">{money(b.balance.amount)}</Row>
          {b.balance.paidAt && <Row label="Saldo cobrado">{`${fmtDateTimeShort(b.balance.paidAt)} (${b.balance.method})`}</Row>}
        </div>
        {b.deposit.receipts.map((r, i) => (
          <div key={i} className="space-y-2 rounded-xl bg-sand/40 p-3">
            <p className="text-sm">
              Comprobante {i + 1} · {fmtDateTimeShort(r.uploadedAt)} · {r.payerName}
              {r.result && <> · {r.result === "approved" ? "Aprobado" : `Rechazado${r.rejectionReason ? `: ${r.rejectionReason}` : ""}`}</>}
            </p>
            <ReceiptPreview bookingId={b.id} index={i} receipt={r} />
          </div>
        ))}
        {b.status === "awaiting_verification" && (
          <>
            <Alert tone="warn">
              <strong>Antes de aprobar, verificá en tu app de Mercado Pago que el dinero haya ingresado. Un comprobante puede ser falso.</strong>
            </Alert>
            <ReceiptActions bookingId={b.id} />
          </>
        )}
        {(b.status === "awaiting_payment" || b.status === "awaiting_verification") && <ManualConfirmForm bookingId={b.id} />}
        {b.deposit.status === "refund_pending" && <RefundDoneButton bookingId={b.id} />}
        {b.deposit.status === "forfeited" && <ExceptionalRefundForm bookingId={b.id} />}
        {(b.status === "confirmed" || b.status === "completed") && !b.balance.paidAt && b.balance.amount > 0 && <BalanceForm bookingId={b.id} />}
      </Card>

      {active && (
        <Card className="space-y-2">
          <h2 className="font-medium">Links de la clienta</h2>
          <p className="text-sm text-muted">Por si necesitás reenviárselos por WhatsApp.</p>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>Pago / estado</span>
            <CopyButton value={paymentUrl(b.id)} label="Copiar link" />
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>Gestión de la reserva</span>
            <CopyButton value={manageUrl(b.id)} label="Copiar link" />
          </div>
        </Card>
      )}

      {active && b.line === "skincare" && (
        <Card className="space-y-3">
          <h2 className="font-medium">Reprogramar</h2>
          <RescheduleForm bookingId={b.id} />
        </Card>
      )}

      {b.status === "confirmed" && (
        <Card className="space-y-3">
          <h2 className="font-medium">Asistencia</h2>
          <AttendanceButtons bookingId={b.id} />
        </Card>
      )}

      {b.status === "confirmed" && (
        <Card className="space-y-3">
          <h2 className="font-medium">Cancelar</h2>
          <CancelForm bookingId={b.id} line={b.line} />
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-medium">Notas internas</h2>
        <NotesForm bookingId={b.id} initial={b.internalNotes ?? ""} />
      </Card>

      <Card className="space-y-2">
        <h2 className="font-medium">Historial</h2>
        <ol className="space-y-2 text-sm">
          {b.history.map((h, i) => (
            <li key={i} className="border-l-2 border-line pl-3">
              <p>
                <span className="text-muted">{fmtDateTimeShort(h.at)}</span> · {actor[h.by]}
              </p>
              <p>
                {h.from ? `${STATUS_LABEL[h.from as keyof typeof STATUS_LABEL] ?? h.from} → ` : ""}
                {STATUS_LABEL[h.to as keyof typeof STATUS_LABEL] ?? h.to}
                {h.note ? ` · ${h.note}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
