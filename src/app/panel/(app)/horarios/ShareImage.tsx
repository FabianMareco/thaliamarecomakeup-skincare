"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

type Range = { label: string; from: string; to: string };

/** Vista previa y descarga de la imagen de turnos libres para redes. */
export function ShareImage({ ranges }: { ranges: Range[] }) {
  const [range, setRange] = useState(0);
  const [format, setFormat] = useState<"story" | "post">("story");
  const [version, setVersion] = useState(0);
  const r = ranges[range];
  const src = `/api/panel/imagen/libres?from=${r.from}&to=${r.to}&formato=${format}&v=${version}`;
  const fileName = `turnos-libres-${r.from}${r.to !== r.from ? `-al-${r.to}` : ""}.png`;
  const chip = (active: boolean) => cx("rounded-full px-3 py-1.5 text-sm", active ? "bg-plum text-white" : "bg-peach/50 text-ink");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ranges.map((x, i) => (
          <button key={x.label} type="button" className={chip(i === range)} onClick={() => setRange(i)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className={chip(format === "story")} onClick={() => setFormat("story")}>
          Historia (9:16)
        </button>
        <button type="button" className={chip(format === "post")} onClick={() => setFormat("post")}>
          Post (4:5)
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Vista previa de la imagen de turnos libres" className="mx-auto max-h-[28rem] rounded-xl border border-line" />
      <div className="flex gap-2">
        <a href={src} download={fileName} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-accent px-5 text-[15px] font-medium text-white hover:bg-accent-dark">
          Descargar imagen
        </a>
        <button type="button" className="rounded-full border border-line px-4 text-sm" onClick={() => setVersion((v) => v + 1)}>
          Actualizar
        </button>
      </div>
      <p className="text-xs text-muted">Muestra solo los horarios que siguen libres. Si alguien reserva, tocá &ldquo;Actualizar&rdquo; antes de publicar.</p>
    </div>
  );
}
