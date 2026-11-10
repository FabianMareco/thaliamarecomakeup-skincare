"use server";

import { arDateStr } from "@/lib/domain/time";
import type { MakeupRequestInput, SkincareBookingInput } from "@/lib/schemas";
import { toResult, UserError, type ActionResult } from "@/server/errors";
import { createMakeupRequest } from "@/server/flows/makeup";
import { cancelByClient, rescheduleByClient } from "@/server/flows/manage";
import { availabilityFor, createSkincareBooking, getAvailability, type AvailabilityDay } from "@/server/flows/skincare";
import { clientIp, rateLimit } from "@/server/rateLimit";
import { findBookingByToken } from "@/server/repo/bookings";
import { loadTenant } from "@/server/repo/tenant";
import { hashIp } from "@/server/tokens";

// Acciones públicas de /turnos. Todas validan en el servidor y tienen rate limit.

async function limit(scope: string, max: number, windowSeconds: number) {
  const ip = await clientIp();
  await rateLimit(`${scope}:${ip}`, max, windowSeconds);
  return hashIp(ip);
}

export async function fetchAvailability(serviceId: string): Promise<ActionResult<{ days: AvailabilityDay[]; today: string }>> {
  return toResult(async () => {
    await limit("availability", 120, 600);
    const now = new Date();
    return { days: await getAvailability(String(serviceId), now), today: arDateStr(now) };
  });
}

export async function bookSkincare(input: SkincareBookingInput): Promise<ActionResult<{ token: string }>> {
  return toResult(async () => {
    if (input?.website) throw new UserError("No se pudo procesar la reserva.");
    const ipHash = await limit("book", 10, 3600);
    const r = await createSkincareBooking(input, { ipHash });
    return { token: r.token };
  });
}

export async function requestMakeup(input: MakeupRequestInput): Promise<ActionResult<{ token: string }>> {
  return toResult(async () => {
    if (input?.website) throw new UserError("No se pudo procesar la solicitud.");
    const ipHash = await limit("makeup", 5, 3600);
    const r = await createMakeupRequest(input, { ipHash });
    return { token: r.token };
  });
}

export async function fetchRescheduleOptions(token: string): Promise<ActionResult<{ days: AvailabilityDay[]; today: string }>> {
  return toResult(async () => {
    await limit("manage", 60, 600);
    const b = await findBookingByToken(String(token));
    if (!b || b.line !== "skincare") throw new UserError("No encontramos la reserva.");
    const tenant = await loadTenant();
    const now = new Date();
    const days = await availabilityFor(
      { durationMin: b.service.durationMin, modality: b.modality ?? "in_person" },
      now,
      tenant.skincare.bookingHorizonDays,
      b.slotId,
    );
    return { days, today: arDateStr(now) };
  });
}

export async function rescheduleBooking(token: string, slotId: string): Promise<ActionResult> {
  return toResult(async () => {
    await limit("manage-write", 20, 3600);
    await rescheduleByClient(String(token), String(slotId));
    return undefined;
  });
}

export async function cancelBooking(token: string, refund: boolean, destination?: string): Promise<ActionResult> {
  return toResult(async () => {
    await limit("manage-write", 20, 3600);
    await cancelByClient(String(token), refund ? { refund: true, destination: String(destination ?? "") } : { refund: false });
    return undefined;
  });
}
