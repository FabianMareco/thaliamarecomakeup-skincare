import Link from "next/link";
import { Card } from "@/components/ui";
import { addDaysStr, arDateStr, fmtDateStrLong, isValidDateStr, mondayOf } from "@/lib/domain/time";
import { listSlotsBetween } from "@/server/repo/bookings";
import { getTenant } from "@/server/repo/tenant";
import { DayEditor, GeneratePanel, TemplateEditor } from "./ScheduleEditors";

export const metadata = { title: "Horarios" };

export default async function HorariosPage(props: PageProps<"/panel/horarios">) {
  const sp = await props.searchParams;
  const today = arDateStr(new Date());
  const date = typeof sp.date === "string" && isValidDateStr(sp.date) ? sp.date : today;
  const [tenant, slots] = await Promise.all([getTenant(), listSlotsBetween(date, date)]);
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
        <form className="flex gap-2" action="/panel/horarios">
          <input type="date" name="date" defaultValue={date} className="flex-1 rounded-xl border border-line bg-white px-3 py-2" aria-label="Ir a fecha" />
          <button className="rounded-full border border-line px-4 text-sm">Ir</button>
        </form>
        <DayEditor
          date={date}
          slots={slots.map((s) => ({
            id: s.id,
            time: s.time,
            durationMin: s.durationMin,
            modality: s.modality,
            status: s.status,
            bookingId: s.bookingId,
          }))}
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
