import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { cols, revive } from "./db";
import { db } from "./firebase";

// Rate limit básico de ventana fija, guardado en Firestore para que funcione
// entre instancias serverless.

export class RateLimitError extends Error {
  constructor() {
    super("Demasiados intentos. Esperá unos minutos y volvé a probar.");
    this.name = "RateLimitError";
  }
}

export async function rateLimit(key: string, max: number, windowSeconds: number, now = new Date()): Promise<void> {
  const ref = cols.rateLimits().doc(createHash("sha256").update(key).digest("hex").slice(0, 40));
  const allowed = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? revive<{ windowStart: Date; count: number }>(snap.data()) : null;
    const windowMs = windowSeconds * 1000;
    if (!data || now.getTime() - data.windowStart.getTime() >= windowMs) {
      tx.set(ref, { windowStart: now, count: 1, expiresAt: new Date(now.getTime() + windowMs) });
      return true;
    }
    if (data.count >= max) return false;
    tx.update(ref, { count: data.count + 1 });
    return true;
  });
  if (!allowed) throw new RateLimitError();
}

/** IP de la request (Vercel la pone en x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
