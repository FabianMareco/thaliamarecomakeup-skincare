import Link from "next/link";
import { Card } from "@/components/ui";
import { addDaysStr, arDateStr, arLocalToInstant, fmtDateStrLong, isValidDateStr, mondayOf } from "@/lib/domain/time";
import { listBookingsBetween, listSlotsBetween } from "@/server/repo/bookings";
import { listServices } from "@/server/repo/services";
import { getTenant } from "@/server/repo/tenant";
import { DateJump, DayEditor, GeneratePanel, TemplateEditor } from "./ScheduleEditors";

export const metadata = { title: "Horarios" };

export default async function HorariosPage(props: PageProps<"/panel/horarios">) {
  const sp = await props.searchParams;
  const today = arDateStr(new Date());
  const date = typeof sp.date === "string" && isValidDateStr(sp.date) ? sp.date : today;
  const [tenant, slots, services, bookings] = await Promise.all([
    getTenant(),
    listSlotsBetween(date, date),
    listServices({ line: "skincare" }),
    listBookingsBetween(arLocalToInstant(date, "00:00"), arLocalToInstant(addDaysStr(date, 1), "00:00")),
  ]);
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const thisMonday = mondayOf(today);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl">Horarios</h1>

      <Card className="space-y-4">
        <h2 className="font-medium">Publicar horarios desde la plantilla</h2>
        <GeneratePanel
          ranges={[
            { label: "Esta semana", from: today, to: addDaysStr(thisMonday, 6) },
            { label: "Próxima semana", from: addDaysStr(thisMonday, 7), to: addDaysStr(thisMonday, 13) },
          ]}
          today={today}
        />
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/panel/horarios?date=${addDaysStr(date, -1)}`} className="rounded-full border border-line px-4 py-2 text-sm" aria-label="Día anterior">
            ‹
          </Link>
          <h2 className="text-center font-medium first-letter:uppercase">{fmtDateStrLong(date)}</h2>
          <Link href={`/panel/horarios?date=${addDaysStr(date, 1)}`} className="rounded-full border border-line px-4 py-2 text-sm" aria-label="Día siguiente">
            ›
          </Link>
        </div>
        <DateJump date={date} />
        <DayEditor
          key={date}
          date={date}
          slots={slots.map((s) => ({
            id: s.id,
            time: s.time,
            durationMin: s.durationMin,
            modality: s.modality,
            status: s.status,
            bookingId: s.bookingId,
            clientName: s.bookingId ? bookingById.get(s.bookingId)?.client.name : undefined,
            serviceName: s.bookingId ? bookingById.get(s.bookingId)?.service.name : undefined,
          }))}
          services={services.map((sv) => ({ id: sv.id, name: sv.name, price: sv.price, durationMin: sv.durationMin, active: sv.active }))}
        />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-medium">Plantilla semanal</h2>
        <p className="text-sm text-muted">Son tus horarios típicos. Se usan para publicar semanas completas con un toque; después podés ajustar cada día.</p>
        <TemplateEditor initial={tenant.weeklyTemplate} />
      </Card>
    </div>
  );
}
