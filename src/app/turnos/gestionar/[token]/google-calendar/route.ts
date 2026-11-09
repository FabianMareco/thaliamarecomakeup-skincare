import { NextResponse } from "next/server";
import { calendarLinks } from "@/server/calendar";
import { findBookingByToken } from "@/server/repo/bookings";
import { loadTenant } from "@/server/repo/tenant";

// Link corto para WhatsApp: lleva a Google Calendar con el turno ya cargado.
export async function GET(_req: Request, ctx: RouteContext<"/turnos/gestionar/[token]/google-calendar">) {
  const { token } = await ctx.params;
  const b = await findBookingByToken(token);
  const links = b && b.status === "confirmed" ? calendarLinks(b, await loadTenant()) : null;
  if (!links) return new NextResponse("La reserva no está confirmada.", { status: 404 });
  return NextResponse.redirect(links.google, { status: 302 });
}
