import { Card } from "@/components/ui";
import { requireAdmin } from "@/server/auth";
import { getTenant } from "@/server/repo/tenant";
import { ChangePassword } from "./ChangePassword";
import { ConfigForm } from "./ConfigForm";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const [t, admin] = await Promise.all([getTenant(), requireAdmin()]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Configuración</h1>
      {admin.email && (
        <Card className="space-y-3">
          <h2 className="font-medium">Tu cuenta</h2>
          <ChangePassword email={admin.email} />
        </Card>
      )}
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
