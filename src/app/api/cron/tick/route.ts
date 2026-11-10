import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { runTick } from "@/server/flows/cron";

// Tarea programada (sección 14). Llamarla cada 15 minutos con
// `Authorization: Bearer {CRON_SECRET}` (Vercel Cron o un programador externo).
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const report = await runTick();
  return NextResponse.json({ ok: true, report });
}

export const GET = handle;
export const POST = handle;
