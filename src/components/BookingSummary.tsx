import { formatARS } from "@/lib/domain/money";
import { fmtDateStrLong, fmtDateTimeLong } from "@/lib/domain/time";
import { STATUS_LABEL } from "@/lib/domain/transitions";
import type { PublicBooking } from "@/server/views";
import { Badge, Card, Row } from "./ui";

const tone = (s: PublicBooking["status"]) =>
  s === "confirmed" || s === "completed" ? "ok" : s === "rejected" || s === "expired" || s.startsWith("cancelled") || s === "no_show" ? "danger" : "warn";

export function BookingSummary({ b, address }: { b: PublicBooking; address?: string }) {
  return (
    <Card className="space-y-1">
      <div className="flex items-start justify-between gap-3 pb-2">
        <div>
          <p className="text-xs text-muted">Reserva {b.code}</p>
          <p className="text-[17px] font-medium leading-snug">{b.serviceName}</p>
        </div>
        <Badge tone={tone(b.status)}>{STATUS_LABEL[b.status]}</Badge>
      </div>
      {b.line === "skincare" && b.startAt && (
        <Row label="Turno">
          <span className="first-letter:uppercase">{fmtDateTimeLong(b.startAt)}</span>
        </Row>
      )}
      {b.line === "skincare" && b.modality === "virtual" && <Row label="Modalidad">Virtual (online)</Row>}
      {b.makeup && (
        <>
          <Row label="Evento">
            <span className="first-letter:uppercase">{fmtDateStrLong(b.makeup.eventDate)}</span>
          </Row>
          <Row label="Lista a las">{b.makeup.readyByTime} hs</Row>
          {b.makeup.startTime && <Row label="Inicio">{b.makeup.startTime} hs</Row>}
          <Row label="Lugar">{b.makeup.location === "home" ? "A domicilio" : "Estudio"}</Row>
          {b.makeup.peopleCount > 1 && <Row label="Personas">{b.makeup.peopleCount}</Row>}
          {b.makeup.trialDate && (
            <Row label="Prueba">
              <span className="first-letter:uppercase">
                {fmtDateStrLong(b.makeup.trialDate)} {b.makeup.trialTime} hs
              </span>
            </Row>
          )}
        </>
      )}
      {address && <Row label="Dirección">{address}</Row>}
      {b.depositAmount > 0 && (
        <>
          <Row label="Precio">{formatARS(b.makeup?.finalPrice ?? b.servicePrice)}</Row>
          <Row label="Seña">{formatARS(b.depositAmount)}</Row>
          {b.makeup?.travelFee ? <Row label="Viático (con el saldo)">{formatARS(b.makeup.travelFee)}</Row> : null}
          <Row label={b.line === "makeup" ? "Saldo el día del evento" : "Saldo en el turno"}>{formatARS(b.balanceAmount)}</Row>
        </>
      )}
    </Card>
  );
}
