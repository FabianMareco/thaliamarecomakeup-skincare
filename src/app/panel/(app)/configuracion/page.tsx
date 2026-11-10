import { getTenant } from "@/server/repo/tenant";
import { ConfigForm } from "./ConfigForm";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const t = await getTenant();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Configuración</h1>
      <ConfigForm
        initial={{
          name: t.name,
          whatsappNumber: t.whatsappNumber,
          publicZone: t.publicZone,
          privateAddress: t.privateAddress,
          notificationEmail: t.notificationEmail,
          bankTransfer: t.bankTransfer,
          skincare: t.skincare,
          makeup: t.makeup,
          verificationReminderMinutes: t.verificationReminderMinutes,
          policies: t.policies,
        }}
      />
    </div>
  );
}
