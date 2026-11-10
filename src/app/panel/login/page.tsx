import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/server/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar al panel", robots: { index: false } };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/panel");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Panel</p>
      <h1 className="font-display text-3xl">Thalia Mareco</h1>
      <p className="mb-6 text-[11px] uppercase tracking-[0.2em] text-muted">Skincare · Makeup</p>
      <LoginForm />
    </main>
  );
}
