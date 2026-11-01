import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth";
import { pendingCounts } from "@/server/panel";
import { logoutAction } from "../actions";
import { PanelNav } from "./PanelNav";

export const metadata: Metadata = { title: { default: "Panel", template: "%s · Panel" }, robots: { index: false } };

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  await requireAdmin();
  const counts = await pendingCounts();
  return (
    <div className="flex min-h-full flex-1 flex-col pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <p className="font-display text-lg">Panel · Thalia</p>
          <form action={logoutAction}>
            <button className="text-sm text-muted underline">Salir</button>
          </form>
        </div>
        <PanelNav pending={counts.total} variant="top" />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      <PanelNav pending={counts.total} variant="bottom" />
    </div>
  );
}
