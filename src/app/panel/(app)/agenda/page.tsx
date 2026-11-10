import Link from "next/link";
import { AGENDA_TONES } from "@/components/palette";
import { cx } from "@/components/ui";
import { addDaysStr, arDateStr, fmtDateStrLong, isValidDateStr, mondayOf } from "@/lib/domain/time";
import { agenda, type AgendaItem } from "@/server/panel";

export const metadata = { title: "Agenda" };

const COLORS = Object.fromEntries(Object.entries(AGENDA_TONES).map(([k, v]) => [k, v.item])) as Record<keyof typeof AGENDA_TONES, string>;

function Item({ item }: { item: AgendaItem }) {
  if (item.kind === "slot") {
    const s = item.slot;
    const b = item.booking;
    const label = s.status === "open" ? "Libre" : s.status === "held" ? "Retenido" : "Reservado";
    const body = (
      <div className={cx("rounded-xl border border-l-4 border-line px-3 py-2", COLORS[s.status])}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-medium tabular-nums">
            {s.time} <span className="text-xs font-normal text-muted">· {s.durationMin} min{s.modality === "virtual" ? " · virtual" : ""}</span>
          </p>
          <span className="text-xs text-muted">{s.status === "open" ? "Libre · reservar ›" : label}</span>
        </div>
        {b && (
          <p className="truncate text-sm">
            {b.client.name} · {b.service.name}
          </p>
        )}
      </div>
    );
    // Un horario libre lleva al editor del día, donde se puede reservar.
    return <Link href={b ? `/panel/reservas/${b.id}` : `/panel/horarios?date=${s.date}`}>{body}</Link>;
  }
  const b = item.booking;
  return (
    <Link href={`/panel/reservas/${b.id}`} className={cx("block rounded-xl border border-l-4 border-line px-3 py-2", COLORS[item.kind])}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium tabular-nums">
          {item.kind === "makeup_event" ? b.makeup?.startTime : b.makeup?.trialTime}{" "}
          <span className="text-xs font-normal text-muted">{item.kind === "makeup_event" ? `· lista ${b.makeup?.readyByTime}` : "· prueba"}</span>
        </p>
        <span className="text-xs text-muted">Maquillaje</span>
      </div>
      <p className="truncate text-sm">
        {b.client.name} · {b.service.name}
        {b.makeup?.location === "home" ? " · domicilio" : ""}
      </p>
    </Link>
  );
}

export default async function AgendaPage(props: PageProps<"/panel/agenda">) {
  const sp = await props.searchParams;
  const today = arDateStr(new Date());
  const date = typeof sp.date === "string" && isValidDateStr(sp.date) ? sp.date : today;
  const view = sp.view === "week" ? "week" : "day";
  const from = view === "week" ? mondayOf(date) : date;
  const to = view === "week" ? addDaysStr(from, 6) : date;
  const items = await agenda(from, to);
  const step = view === "week" ? 7 : 1;
  const href = (d: string, v = view) => `/panel/agenda?date=${d}&view=${v}`;
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDaysStr(d, 1)) dates.push(d);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl">Agenda</h1>
        <div className="flex rounded-full border border-line bg-white p-0.5 text-sm">
          {(["day", "week"] as const).map((v) => (
            <Link key={v} href={href(date, v)} className={cx("rounded-full px-3 py-1.5", view === v ? "bg-plum text-white" : "text-muted")}>
              {v === "day" ? "Día" : "Semana"}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Link href={href(addDaysStr(date, -step))} className="rounded-full border border-line bg-white px-4 py-2 text-sm" aria-label="Anterior">
          ‹
        </Link>
        <Link href={href(today)} className="text-sm text-accent underline">
          Hoy
        </Link>
        <Link href={href(addDaysStr(date, step))} className="rounded-full border border-line bg-white px-4 py-2 text-sm" aria-label="Siguiente">
          ›
        </Link>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {Object.values(AGENDA_TONES).map((t) => (
          <span key={t.label}>
            <span className={`mr-1 inline-block h-2.5 w-2.5 rounded-full ${t.dot}`} />
            {t.label}
          </span>
        ))}
      </div>
      <div className="space-y-6">
        {dates.map((d) => {
          const list = items.get(d) ?? [];
          return (
            <section key={d} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className={cx("text-sm font-medium first-letter:uppercase", d === today && "text-accent")}>
                  <Link href={`/panel/horarios?date=${d}`} className="hover:underline">
                    {fmtDateStrLong(d)}
                  </Link>
                </h2>
                {list.some((i) => i.kind !== "slot" || i.booking) && (
                  <a href={`/api/panel/imagen/agenda?date=${d}`} download={`agenda-${d}.png`} className="shrink-0 text-xs text-accent underline">
                    Descargar imagen del día
                  </a>
                )}
              </div>
              {list.length === 0 ? (
                <p className="text-sm text-muted">Sin horarios ni eventos.</p>
              ) : (
                <div className="space-y-2">
                  {list.map((i, idx) => (
                    <Item key={idx} item={i} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
