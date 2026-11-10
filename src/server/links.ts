import { createHmac } from "node:crypto";
import { env } from "./env";
import { hashToken } from "./tokens";

// Token de los links de pago y gestión. Es un valor de 32 bytes en base64url
// derivado con HMAC de un secreto del servidor, así se puede volver a armar el
// link en cada recordatorio sin guardar el token: en la base solo queda su hash.

function linkSecret(): string {
  const s = process.env.LINK_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production" && !env.usingEmulators) {
    throw new Error("Falta la variable LINK_SECRET");
  }
  return "dev-only-link-secret";
}

export function manageTokenFor(bookingId: string): string {
  return createHmac("sha256", linkSecret()).update(`manage:${bookingId}`).digest("base64url");
}

export function manageTokenHashFor(bookingId: string): string {
  return hashToken(manageTokenFor(bookingId));
}

export function paymentUrl(bookingId: string): string {
  return `${env.baseUrl}/turnos/pago/${manageTokenFor(bookingId)}`;
}

export function manageUrl(bookingId: string): string {
  return `${env.baseUrl}/turnos/gestionar/${manageTokenFor(bookingId)}`;
}

export function panelBookingUrl(bookingId: string): string {
  return `${env.baseUrl}/panel/reservas/${bookingId}`;
}
