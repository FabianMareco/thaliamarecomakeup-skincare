import { notFound } from "next/navigation";
import { WhatsAppButton } from "@/components/site";
import { Badge, Card, Row } from "@/components/ui";
import { fmtDateShort } from "@/lib/domain/time";
import { getClient, listBookingsByClient } from "@/server/repo/bookings";
import { BookingRow } from "../../../_components/bits";

export const metadata = { title: "Clienta" };

export default async function ClientaPage(props: PageProps<"/panel/clientas/[id]">) {
  const { id } = await props.params;
  const clientId = decodeURIComponent(id);
  const [client, bookings] = await Promise.all([getClient(clientId), listBookingsByClient(clientId)]);
  if (!client) notFound();
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl">{client.name}</h1>
      <Card className="space-y-1">
        <Row label="WhatsApp">{client.phone}</Row>
        <Row label="Email">{client.email}</Row>
        <Row label="Primera reserva">{fmtDateShort(client.firstSeenAt)}</Row>
        <Row label="Reservas">{client.bookingsCount}</Row>
        <Row label="Ausencias">{client.noShowCount > 0 ? <Badge tone="danger">{client.noShowCount}</Badge> : "0"}</Row>
        <div className="pt-3">
          <WhatsAppButton number={client.phone} label="WhatsApp" />
        </div>
      </Card>
      <h2 className="font-medium">Historial de reservas</h2>
      <div className="space-y-2">
        {bookings.map((b) => (
          <BookingRow key={b.id} b={b} />
        ))}
      </div>
    </div>
  );
}
