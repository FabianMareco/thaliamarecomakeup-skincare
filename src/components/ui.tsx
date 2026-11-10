import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Componentes visuales básicos, compartidos por el sitio y el panel.

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-dark disabled:bg-accent/50",
  secondary: "bg-white text-ink border border-line hover:bg-sand disabled:opacity-50",
  ghost: "text-accent hover:bg-sand disabled:opacity-50",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50",
};

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-medium transition-colors disabled:cursor-not-allowed min-h-11";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cx(btnBase, variants[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(btnBase, variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-line bg-white p-5", className)} {...props} />;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "warn" | "ok" | "danger" | "info"; children: ReactNode }) {
  const tones = {
    neutral: "bg-sand text-ink",
    accent: "bg-blush text-accent-dark",
    warn: "bg-amber-100 text-amber-900",
    ok: "bg-emerald-100 text-emerald-900",
    danger: "bg-red-100 text-red-800",
    info: "bg-sky-100 text-sky-900",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warn" | "danger" | "ok"; title?: string; children: ReactNode }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-950",
    warn: "border-amber-300 bg-amber-50 text-amber-950",
    danger: "border-red-200 bg-red-50 text-red-900",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-950",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-xl border p-4 text-sm leading-relaxed", tones[tone])}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

const inputBase =
  "block w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputBase, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputBase, "appearance-none", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputBase, "min-h-24", className)} {...props} />;
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="space-y-2">
      {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{eyebrow}</p>}
      <h1 className="font-display text-3xl leading-tight">{title}</h1>
      {children && <div className="text-[15px] leading-relaxed text-muted">{children}</div>}
    </header>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[15px]">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
