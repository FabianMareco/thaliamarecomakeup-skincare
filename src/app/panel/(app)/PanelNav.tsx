"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const ITEMS = [
  { href: "/panel", label: "Pendientes", main: true },
  { href: "/panel/agenda", label: "Agenda", main: true },
  { href: "/panel/horarios", label: "Horarios", main: true },
  { href: "/panel/clientas", label: "Clientas", main: true },
  { href: "/panel/servicios", label: "Servicios", main: false },
  { href: "/panel/configuracion", label: "Configuración", main: false },
];

export function PanelNav({ pending, variant }: { pending: number; variant: "top" | "bottom" }) {
  const path = usePathname();
  const active = (href: string) => (href === "/panel" ? path === "/panel" : path.startsWith(href));
  const badge = (href: string) =>
    href === "/panel" && pending > 0 ? (
      <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
        {pending}
      </span>
    ) : null;

  if (variant === "top") {
    return (
      <nav className="mx-auto max-w-3xl overflow-x-auto px-2">
        <ul className="flex gap-1 pb-2 text-sm">
          {ITEMS.map((i) => (
            <li key={i.href} className={cx(i.main && "hidden md:block")}>
              <Link
                href={i.href}
                className={cx("inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5", active(i.href) ? "bg-ink text-white" : "text-muted hover:bg-sand")}
              >
                {i.label}
                {badge(i.href)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white md:hidden">
      <ul className="grid grid-cols-4">
        {ITEMS.filter((i) => i.main).map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className={cx("flex min-h-14 flex-col items-center justify-center text-xs", active(i.href) ? "font-semibold text-accent" : "text-muted")}
            >
              <span className="flex items-center">
                {i.label}
                {badge(i.href)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
