import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { isSlotFree } from "@/lib/domain/availability";
import { displayPhone } from "@/lib/domain/phone";
import { balanceFor, bookingTotal, formatARS, serviceLabel } from "@/lib/domain/money";
import { arTimeStr, datesBetween, fmtDateStrLong } from "@/lib/domain/time";
import type { Booking, Tenant } from "@/lib/domain/types";
import { env } from "./env";
import { agenda, type AgendaItem } from "./panel";

// Imágenes que genera el panel: turnos libres para publicar en redes y la
// agenda del día para Thalia. Se dibujan con JSX (Satori), que solo admite
// flexbox: cada contenedor con más de un hijo lleva display: "flex".

const C = {
  cream: "#faf6f3",
  sand: "#f1e7e1",
  blush: "#e9d6cc",
  ink: "#3b2f2f",
  muted: "#7a6a64",
  accent: "#8a5a4a",
  line: "#e6d9d1",
  ok: "#2f7a4f",
  warn: "#a8661b",
};

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 600; style: "normal" }[]> | undefined;
function fonts() {
  fontsPromise ??= Promise.all(
    (
      [
        ["Fraunces", "fraunces-latin-400-normal.woff", 400],
        ["Fraunces", "fraunces-latin-600-normal.woff", 600],
        ["Geist", "geist-sans-latin-400-normal.woff", 400],
        ["Geist", "geist-sans-latin-600-normal.woff", 600],
      ] as const
    ).map(async ([name, file, weight]) => ({
      name,
      data: await readFile(join(process.cwd(), "assets/fonts", file)),
      weight,
      style: "normal" as const,
    })),
  );
  return fontsPromise;
}

export type ImageFormat = "story" | "post";
const SIZES: Record<ImageFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dayTitle = (date: string) => capitalize(fmtDateStrLong(date));

// ---------- Turnos libres (para redes) ----------

export type FreeDay = { date: string; slots: { time: string; virtual: boolean }[] };

/** Horarios de skincare libres y futuros, por día, entre dos fechas. */
export async function freeSlotsByDay(from: string, to: string, now = new Date()): Promise<FreeDay[]> {
  const items = await agenda(from, to);
  return datesBetween(from, to)
    .map((date) => ({
      date,
      slots: (items.get(date) ?? [])
        .filter((i): i is Extract<AgendaItem, { kind: "slot" }> => i.kind === "slot")
        .map((i) => i.slot)
        .filter((s) => isSlotFree(s, now) && s.startAt.getTime() > now.getTime())
        .map((s) => ({ time: s.time, virtual: s.modality === "virtual" })),
    }))
    .filter((d) => d.slots.length > 0);
}

function rangeLabel(from: string, to: string): string {
  const f = (d: string) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;
  return from === to ? dayTitle(from) : `Del ${f(from)} al ${f(to)}`;
}

export async function freeSlotsImage(tenant: Tenant, from: string, to: string, format: ImageFormat, now = new Date()) {
  const days = await freeSlotsByDay(from, to, now);
  const size = SIZES[format];
  // Pocos días en historia: tarjetas grandes. Si no entran (post o muchos días): una fila por día.
  const rows = format === "post" || days.length > 6;
  const maxDays = format === "post" ? 8 : 14;
  const shown = days.slice(0, maxDays);
  const hidden = days.length - shown.length;
  const site = env.baseUrl.replace(/^https?:\/\//, "");
  const shortDay = (date: string) => {
    const [dow] = fmtDateStrLong(date).split(" ");
    return `${capitalize(dow.slice(0, 3))} ${Number(date.slice(8))}/${Number(date.slice(5, 7))}`;
  };
  const chip = (s: { time: string; virtual: boolean }, big: boolean) => (
    <div key={s.time} style={{ display: "flex", alignItems: "center", background: C.blush, color: C.ink, borderRadius: 999, padding: big ? "10px 26px" : "6px 18px", fontSize: big ? 36 : 28, fontWeight: 600 }}>
      {s.time}
      {s.virtual ? <span style={{ fontSize: big ? 22 : 18, fontWeight: 400, marginLeft: 8, color: C.muted }}>virtual</span> : null}
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.cream, color: C.ink, fontFamily: "Geist", padding: format === "story" ? "110px 80px" : "64px 72px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "Fraunces", fontSize: format === "story" ? 46 : 40, fontWeight: 600 }}>{tenant.name}</div>
          <div style={{ fontSize: 22, letterSpacing: 8, color: C.muted, marginTop: 6 }}>SKINCARE · MAKEUP</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: format === "story" ? 80 : 36 }}>
          <div style={{ fontFamily: "Fraunces", fontSize: format === "story" ? 92 : 68, fontWeight: 600, lineHeight: 1.05 }}>Turnos disponibles</div>
          <div style={{ fontSize: format === "story" ? 34 : 30, color: C.accent, marginTop: 12 }}>{rangeLabel(from, to)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: format === "story" ? 60 : 32, gap: rows ? 12 : 34, flexGrow: 1 }}>
          {shown.length === 0 ? (
            <div style={{ fontSize: 38, color: C.muted }}>No quedan turnos libres en estas fechas. ¡Escribime y te aviso!</div>
          ) : rows ? (
            shown.map((d) => (
              <div key={d.date} style={{ display: "flex", alignItems: "center", background: "#ffffff", borderRadius: 22, border: `2px solid ${C.line}`, padding: "12px 20px" }}>
                <div style={{ display: "flex", width: 190, fontSize: 30, fontWeight: 600 }}>{shortDay(d.date)}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, flex: 1 }}>{d.slots.map((s) => chip(s, false))}</div>
              </div>
            ))
          ) : (
            shown.map((d) => (
              <div key={d.date} style={{ display: "flex", flexDirection: "column", background: "#ffffff", borderRadius: 28, border: `2px solid ${C.line}`, padding: "28px 32px" }}>
                <div style={{ fontSize: 38, fontWeight: 600 }}>{dayTitle(d.date)}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14 }}>{d.slots.map((s) => chip(s, true))}</div>
              </div>
            ))
          )}
          {hidden > 0 ? (
            <div style={{ display: "flex", fontSize: 26, color: C.muted }}>{`Y ${hidden === 1 ? "1 día más" : `${hidden} días más`} con turnos: miralos en la web.`}</div>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 28, borderTop: `2px solid ${C.line}`, paddingTop: 24 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: format === "story" ? 36 : 30, fontWeight: 600 }}>Reservá online</div>
            <div style={{ fontSize: format === "story" ? 32 : 28, color: C.accent, marginTop: 4 }}>{`${site}/turnos`}</div>
          </div>
          <div style={{ display: "flex", fontSize: format === "story" ? 28 : 24, color: C.muted }}>{tenant.publicZone}</div>
        </div>
      </div>
    ),
    { ...size, fonts: await fonts(), headers: { "Cache-Control": "private, no-store" } },
  );
}

// ---------- Agenda del día (para Thalia) ----------

/** Lo que Thalia cobra en el turno: el saldo, o todo si la seña todavía no llegó. */
function amountToCollect(b: Booking): { amount: number; includesDeposit: boolean } {
  const total = b.line === "skincare" ? bookingTotal(b) : (b.makeup?.finalPrice ?? b.service.price) + (b.makeup?.travelFee ?? 0);
  if (b.deposit.status !== "verified") return { amount: total, includesDeposit: true };
  return { amount: b.line === "skincare" ? balanceFor(total, b.deposit.amount) : b.balance.amount, includesDeposit: false };
}

function depositBadge(b: Booking): { text: string; color: string } {
  if (b.deposit.status === "verified") return { text: "Seña recibida", color: C.ok };
  if (b.status === "awaiting_verification") return { text: "Comprobante por verificar", color: C.warn };
  return { text: "Seña pendiente", color: C.warn };
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", background: "#ffffff", borderRadius: 24, border: `2px solid ${C.line}`, padding: "22px 28px" }}>
      {children}
    </div>
  );
}

function BookingCard({ time, b, kind }: { time: string; b: Booking; kind: "skincare" | "makeup_event" | "makeup_trial" }) {
  const dep = depositBadge(b);
  const collect = amountToCollect(b);
  const tag = kind === "makeup_event" ? "Maquillaje" : kind === "makeup_trial" ? "Prueba de maquillaje" : null;
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <div style={{ fontSize: 40, fontWeight: 600 }}>{time}</div>
          <div style={{ fontSize: 34, fontWeight: 600 }}>{b.client.name}</div>
        </div>
        <div style={{ fontSize: 22, color: C.muted }}>{b.code}</div>
      </div>
      <div style={{ display: "flex", fontSize: 28, color: C.ink, marginTop: 6 }}>{(tag ? `${tag}: ` : "") + serviceLabel(b)}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12, fontSize: 24 }}>
        <div style={{ display: "flex", color: C.muted }}>{displayPhone(b.client.phone)}</div>
        {b.client.firstVisit && b.line === "skincare" ? <div style={{ display: "flex", color: C.accent, fontWeight: 600 }}>· Primera vez</div> : null}
        {b.makeup?.location === "home" ? <div style={{ display: "flex", color: C.accent }}>· A domicilio: {b.makeup.homeAddress ?? ""}</div> : null}
        {kind === "makeup_event" && b.makeup ? <div style={{ display: "flex", color: C.muted }}>· Lista a las {b.makeup.readyByTime}</div> : null}
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 12, fontSize: 24 }}>
        <div style={{ display: "flex", color: dep.color, fontWeight: 600 }}>{dep.text}</div>
        {kind !== "makeup_trial" ? (
          <div style={{ display: "flex", color: C.ink }}>
            {b.balance.paidAt
              ? "Saldo cobrado"
              : `A cobrar: ${formatARS(collect.amount)}${collect.includesDeposit ? " (incluye la seña)" : ""}${b.makeup?.travelFee ? ` · viático incluido` : ""}`}
          </div>
        ) : null}
      </div>
      {b.internalNotes ? (
        <div style={{ display: "flex", fontSize: 22, color: C.muted, marginTop: 10 }}>Nota: {b.internalNotes.slice(0, 140)}</div>
      ) : null}
    </Card>
  );
}

export async function dayAgendaImage(tenant: Tenant, date: string, now = new Date()) {
  const items = (await agenda(date, date)).get(date) ?? [];
  const rows = items.filter(
    (i) => i.kind !== "slot" || (i.booking && ["awaiting_payment", "awaiting_verification", "confirmed", "completed"].includes(i.booking.status)),
  );
  const free = items.filter((i): i is Extract<AgendaItem, { kind: "slot" }> => i.kind === "slot" && !i.booking && isSlotFree(i.slot, now));
  const toCollect = rows.reduce((sum, i) => {
    const b = i.booking!;
    if (i.kind === "makeup_trial" || b.balance.paidAt || b.status === "completed") return sum;
    return sum + amountToCollect(b).amount;
  }, 0);
  // La altura crece con la cantidad de turnos (mínimo, formato historia).
  const height = Math.max(1920, 560 + rows.length * 300 + (free.length ? 140 : 0));

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.cream, color: C.ink, fontFamily: "Geist", padding: "90px 70px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, letterSpacing: 6, color: C.muted }}>MI AGENDA · USO INTERNO</div>
          <div style={{ fontFamily: "Fraunces", fontSize: 72, fontWeight: 600, marginTop: 10 }}>{dayTitle(date)}</div>
          <div style={{ display: "flex", gap: 24, fontSize: 30, color: C.accent, marginTop: 10 }}>
            <div style={{ display: "flex" }}>{rows.length === 1 ? "1 turno" : `${rows.length} turnos`}</div>
            {toCollect > 0 ? <div style={{ display: "flex" }}>· A cobrar: {formatARS(toCollect)}</div> : null}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 50 }}>
          {rows.length === 0 ? (
            <div style={{ fontSize: 36, color: C.muted }}>No tenés turnos reservados este día.</div>
          ) : (
            rows.map((i, idx) =>
              i.kind === "slot" ? (
                <BookingCard key={idx} time={i.slot.time} b={i.booking!} kind="skincare" />
              ) : (
                <BookingCard key={idx} time={arTimeStr(i.startAt)} b={i.booking} kind={i.kind} />
              ),
            )
          )}
        </div>
        {free.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
            <div style={{ fontSize: 28, color: C.muted }}>Horarios libres</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
              {free.map((i) => (
                <div key={i.slot.id} style={{ display: "flex", background: C.sand, borderRadius: 999, padding: "8px 22px", fontSize: 28 }}>
                  {i.slot.time}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div style={{ display: "flex", marginTop: "auto", paddingTop: 40, fontSize: 22, color: C.muted }}>
          {tenant.name} · Contiene datos personales de pacientes: no compartir.
        </div>
      </div>
    ),
    { width: 1080, height, fonts: await fonts(), headers: { "Cache-Control": "private, no-store" } },
  );
}
