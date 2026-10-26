import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { MAKEUP_CATEGORIES, MAKEUP_SERVICES_NOTE } from "@/lib/domain/defaults";
import { formatARS } from "@/lib/domain/money";
import { arDateStr } from "@/lib/domain/time";
import { listServices } from "@/server/repo/services";
import { getTenant } from "@/server/repo/tenant";
import { MakeupForm } from "./MakeupForm";

export const metadata: Metadata = { title: "Maquillaje y peinado" };

export default async function MaquillajePage() {
  const [tenant, services] = await Promise.all([getTenant(), listServices({ line: "makeup", activeOnly: true })]);
  const categories = [
    ...MAKEUP_CATEGORIES.filter((c) => services.some((s) => s.category === c)),
    ...new Set(services.map((s) => s.category).filter((c) => !(MAKEUP_CATEGORIES as readonly string[]).includes(c))),
  ];
  return (
    <div className="space-y-10">
      <PageTitle eyebrow="Makeup" title="Maquillaje y peinado">
        Contanos la fecha de tu evento y Thalia te confirma si la tiene disponible.
      </PageTitle>

      <div className="space-y-8">
        {categories.map((cat) => (
          <section key={cat} className="space-y-3">
            <h2 className="font-display text-xl">{cat}</h2>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
              {services
                .filter((s) => s.category === cat)
                .map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                    <span className="text-[15px] leading-snug">
                      {s.name}
                      {s.includesTrial && <span className="ml-2 text-xs text-accent">incluye prueba</span>}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatARS(s.price)}</span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        <p className="text-sm font-medium">Los precios no incluyen viáticos.</p>
        <p className="text-sm leading-relaxed text-muted">{MAKEUP_SERVICES_NOTE}</p>
      </div>

      <section className="space-y-2 rounded-3xl bg-sand/60 p-6 text-[15px] leading-relaxed">
        <h2 className="font-display text-xl">Política de reserva</h2>
        <p>{tenant.policies.makeup}</p>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">Solicitá tu fecha</h2>
        <MakeupForm
          services={services.map((s) => ({ id: s.id, name: s.name, category: s.category, price: s.price, includesTrial: !!s.includesTrial }))}
          today={arDateStr(new Date())}
        />
      </section>
    </div>
  );
}
