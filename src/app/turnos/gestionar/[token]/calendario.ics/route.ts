import { NextResponse } from "next/server";
import { calendarLinks } from "@/server/calendar";
import { findBookingByToken } from "@/server/repo/bookings";
import { loadTenant } from "@/server/repo/tenant";

// Archivo de calendario del turno (iPhone, Outlook, Gmail).
export async function GET(_req: Request, ctx: RouteContext<"/turnos/gestionar/[token]/calendario.ics">) {
  const { token } = await ctx.params;
  const b = await findBookingByToken(token);
  const links = b && b.status === "confirmed" ? calendarLinks(b, await loadTenant()) : null;
  if (!links) return new NextResponse("La reserva no está confirmada.", { status: 404 });
  return new NextResponse(links.icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="turno-${b!.code}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
