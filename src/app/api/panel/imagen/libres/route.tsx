import { NextResponse } from "next/server";
import { datesBetween, isValidDateStr } from "@/lib/domain/time";
import { getAdmin } from "@/server/auth";
import { freeSlotsImage, type ImageFormat } from "@/server/images";
import { loadTenant } from "@/server/repo/tenant";

// Imagen con los turnos libres para publicar en redes (historia o post).
//   /api/panel/imagen/libres?from=2026-11-16&to=2026-11-22&formato=story
export async function GET(req: Request) {
  if (!(await getAdmin())) return new NextResponse("No autorizado", { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? from;
  const format: ImageFormat = url.searchParams.get("formato") === "post" ? "post" : "story";
  if (!isValidDateStr(from) || !isValidDateStr(to) || from > to || datesBetween(from, to).length > 14) {
    return new NextResponse("Rango de fechas inválido (máximo 14 días)", { status: 400 });
  }
  return freeSlotsImage(await loadTenant(), from, to, format);
}
