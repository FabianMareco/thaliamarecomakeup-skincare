"use client";

import { useEffect, useState } from "react";
import { cx } from "./ui";

/** Botón para copiar un dato (alias, CVU, monto). */
export function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className={cx(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        copied ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-line bg-white text-accent hover:bg-sand",
      )}
      aria-live="polite"
    >
      {copied ? "¡Copiado!" : label}
    </button>
  );
}

function remaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m}:${String(sec).padStart(2, "0")}`;
}

/** Cuenta regresiva hasta un instante. Al llegar a cero llama a `onDone`. */
export function Countdown({ until, onDoneReload = false }: { until: string; onDoneReload?: boolean }) {
  const target = new Date(until).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (onDoneReload && now !== null && now >= target) {
      const id = setTimeout(() => window.location.reload(), 1500);
      return () => clearTimeout(id);
    }
  }, [now, target, onDoneReload]);
  if (now === null) return <span className="tabular-nums">…</span>;
  return <span className="tabular-nums">{remaining(target - now)}</span>;
}
