import { NextResponse } from "next/server";
import { isValidDateStr } from "@/lib/domain/time";
import { getAdmin } from "@/server/auth";
import { dayAgendaImage } from "@/server/images";
import { loadTenant } from "@/server/repo/tenant";

// Imagen con la agenda de un día y los datos de las pacientes. Solo para Thalia.
//   /api/panel/imagen/agenda?date=2026-11-16
export async function GET(req: Request) {
  if (!(await getAdmin())) return new NextResponse("No autorizado", { status: 401 });
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!isValidDateStr(date)) return new NextResponse("Fecha inválida", { status: 400 });
  return dayAgendaImage(await loadTenant(), date);
}
