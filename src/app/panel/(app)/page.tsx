import { Countdown } from "@/components/client-bits";
import { Alert, Badge, Card, Row } from "@/components/ui";
import { fmtDateTimeShort } from "@/lib/domain/time";
import { manualMessages } from "@/server/notify/manual";
import { pendingLists, upcomingConfirmed } from "@/server/panel";
import { getTenant } from "@/server/repo/tenant";
import { ReceiptActions, RefundDoneButton, SameDayActions } from "../_components/actions";
import { BookingRow, money, ReceiptPreview, whenShort } from "../_components/bits";

export const metadata = { title: "Pendientes" };

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-display text-xl">
        {title} {count > 0 && <Badge tone="danger">{count}</Badge>}
      </h2>
      {count === 0 ? <p className="text-sm text-muted">Nada pendiente.</p> : children}
    </section>
  );
}

export default async function PendientesPage() {
  const [l, upcoming, tenant] = await Promise.all([pendingLists(), upcomingConfirmed(48), getTenant()]);
  return (
    <div className="space-y-10">
      <Section title="Comprobantes por verificar" count={l.receipts.length}>
        <div className="space-y-4">
          {l.receipts.map((b) => {
            const i = b.deposit.receipts.length - 1;
            const r = b.deposit.receipts[i];
            return (
              <Card key={b.id} className="space-y-3">
                <BookingRow b={b} />
                <div>
                  <Row label="Monto esperado">
                    <span className="text-lg">{money(b.deposit.amount)}</span>
                  </Row>
                  <Row label="Titular que transfirió">{r?.payerName}</Row>
                  <Row label="Subido">{r ? fmtDateTimeShort(r.uploadedAt) : "-"}</Row>
                </div>
                {r && <ReceiptPreview bookingId={b.id} index={i} receipt={r} />}
                <Alert tone="warn">
                  <strong>Antes de aprobar, verificá en tu app de Mercado Pago que el dinero haya ingresado. Un comprobante puede ser falso.</strong>
                </Alert>
                <ReceiptActions bookingId={b.id} />
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title="Solicitudes para hoy" count={l.sameDay.length}>
        <div className="space-y-4">
          {l.sameDay.map((b) => (
            <Card key={b.id} className="space-y-3">
              <BookingRow b={b} />
              {b.approvalDeadline && (
                <p className="text-sm">
                  Vence en <strong><Countdown until={b.approvalDeadline.toISOString()} /></strong>
                </p>
              )}
              <SameDayActions bookingId={b.id} />
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Solicitudes de maquillaje" count={l.makeupRequests.length}>
        <div className="space-y-3">
          {l.makeupRequests.map((b) => (
            <BookingRow
              key={b.id}
              b={b}
              extra={
                <p className="mt-2 text-sm text-muted">
                  {b.makeup?.location === "home" ? `A domicilio (${b.makeup.homeAddress})` : "Estudio"} · {b.makeup?.peopleCount} persona(s) · Tocá para aceptar o rechazar
                </p>
              }
            />
          ))}
        </div>
      </Section>

      <Section title="Reintegros pendientes" count={l.refunds.length}>
        <div className="space-y-4">
          {l.refunds.map((b) => (
            <Card key={b.id} className="space-y-3">
              <BookingRow b={b} />
              <Row label="Monto">{money(b.deposit.amount)}</Row>
              <Row label="Alias / CBU">{b.deposit.refundDestination ?? "(no indicado)"}</Row>
              <RefundDoneButton bookingId={b.id} />
            </Card>
          ))}
        </div>
      </Section>

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl">Turnos de las próximas 48 hs</h2>
          <p className="text-sm text-muted">Si querés, mandales el recordatorio por WhatsApp.</p>
          {upcoming.map((b) => {
            const reminder = manualMessages(b, tenant).find((m) => m.event === "reminder");
            return (
              <div key={b.id} className="space-y-2">
                <BookingRow b={b} />
                {reminder && (
                  <a
                    href={reminder.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center rounded-full bg-[#1f8f4e] px-4 text-sm font-medium text-white hover:bg-[#187a42]"
                  >
                    Recordatorio por WhatsApp a {b.client.name.split(" ")[0]}
                  </a>
                )}
              </div>
            );
          })}
        </section>
      )}

      {l.unpaidManual.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl">Reservas cargadas por vos, esperando la seña</h2>
          <p className="text-sm text-muted">No vencen solas. Cuando recibas la seña, entrá a la reserva y tocá &ldquo;Confirmar seña recibida&rdquo;.</p>
          {l.unpaidManual.map((b) => (
            <BookingRow key={b.id} b={b} extra={<p className="mt-2 text-sm text-muted">Seña: {money(b.deposit.amount)}</p>} />
          ))}
        </section>
      )}

      {l.expiredMakeup.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl">Maquillaje vencido sin comprobante (últimos 7 días)</h2>
          {l.expiredMakeup.map((b) => (
            <BookingRow key={b.id} b={b} extra={<p className="mt-2 text-sm text-muted">Evento: {whenShort(b)}</p>} />
          ))}
        </section>
      )}
    </div>
  );
}
