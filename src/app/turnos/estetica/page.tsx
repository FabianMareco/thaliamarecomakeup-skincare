import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { arDateStr } from "@/lib/domain/time";
import { listServices } from "@/server/repo/services";
import { getTenant } from "@/server/repo/tenant";
import { BookingWizard } from "./BookingWizard";

export const metadata: Metadata = { title: "Tratamientos faciales" };

export default async function EsteticaPage() {
  const [tenant, services] = await Promise.all([getTenant(), listServices({ line: "skincare", activeOnly: true })]);
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Skincare" title="Tratamientos faciales">
        Elegí el tratamiento, el día y el horario. Para confirmar se abona una seña por transferencia.
      </PageTitle>
      <BookingWizard
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          description: s.description,
          badge: s.badge,
          price: s.price,
          durationMin: s.durationMin,
          modality: s.modality,
        }))}
        depositAmount={tenant.skincare.depositAmount}
        horizonDays={tenant.skincare.bookingHorizonDays}
        policy={tenant.policies.skincare}
        today={arDateStr(new Date())}
      />
    </div>
  );
}
