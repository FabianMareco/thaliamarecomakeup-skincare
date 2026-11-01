import Link from "next/link";
import { connection } from "next/server";
import { PrivacyNotice, WhatsAppButton } from "@/components/site";
import { getTenant } from "@/server/repo/tenant";

export default async function TurnosLayout({ children }: LayoutProps<"/turnos">) {
  await connection();
  const tenant = await getTenant();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link href="/turnos" className="leading-tight">
            <span className="block font-display text-xl">{tenant.name}</span>
            <span className="block text-[11px] uppercase tracking-[0.2em] text-muted">Skincare · Makeup</span>
          </Link>
          <span className="text-right text-xs text-muted">{tenant.publicZone}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-line bg-sand/50">
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
          <WhatsAppButton number={tenant.whatsappNumber} />
          <p className="text-sm text-muted">{tenant.publicZone}</p>
          <PrivacyNotice />
        </div>
      </footer>
    </div>
  );
}
