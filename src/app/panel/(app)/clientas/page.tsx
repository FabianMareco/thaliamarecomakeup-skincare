import Link from "next/link";
import { Badge, Input } from "@/components/ui";
import { fmtDateShort } from "@/lib/domain/time";
import { listClients } from "@/server/repo/bookings";

export const metadata = { title: "Clientas" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function ClientasPage(props: PageProps<"/panel/clientas">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const all = await listClients();
  const digits = q.replace(/\D/g, "");
  const list = all
    .filter((c) => !q || norm(c.name).includes(norm(q)) || (digits.length >= 3 && c.phone.includes(digits)) || norm(c.email).includes(norm(q)))
    .sort((a, b) => b.lastBookingAt.getTime() - a.lastBookingAt.getTime())
    .slice(0, 100);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl">Clientas</h1>
      <form action="/panel/clientas">
        <Input name="q" type="search" defaultValue={q} placeholder="Buscar por nombre, teléfono o email" aria-label="Buscar clienta" />
      </form>
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.id}>
            <Link href={`/panel/clientas/${encodeURIComponent(c.id)}`} className="block rounded-2xl border border-line bg-white p-4 hover:border-accent">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-sm text-muted">{c.phone}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted">
                  <span>{c.bookingsCount} reserva(s)</span>
                  <span>Última: {fmtDateShort(c.lastBookingAt)}</span>
                  {c.noShowCount > 0 && <Badge tone="danger">{c.noShowCount} ausencia(s)</Badge>}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="text-sm text-muted">No hay clientas que coincidan.</p>}
    </div>
  );
}
