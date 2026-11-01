import { createHash, randomInt } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Código corto legible de la reserva, ej. "TM-4821". */
export function newBookingCode(digits = 4): string {
  const n = randomInt(10 ** (digits - 1), 10 ** digits);
  return `TM-${n}`;
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`ip:${ip}`).digest("hex").slice(0, 32);
}
