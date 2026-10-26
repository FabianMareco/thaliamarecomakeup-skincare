import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { env } from "./env";
import { db } from "./firebase";

// Referencias a colecciones del tenant y conversión Timestamp → Date.

export function tenantRef() {
  return db().collection("tenants").doc(env.tenantId);
}

export const cols = {
  services: () => tenantRef().collection("services"),
  slots: () => tenantRef().collection("slots"),
  bookings: () => tenantRef().collection("bookings"),
  clients: () => tenantRef().collection("clients"),
  notifications: () => tenantRef().collection("notifications"),
  rateLimits: () => tenantRef().collection("rateLimits"),
};

/** Convierte recursivamente los Timestamp de Firestore en Date. */
export function revive<T>(value: unknown): T {
  if (value instanceof Timestamp) return value.toDate() as T;
  if (Array.isArray(value)) return value.map((v) => revive(v)) as T;
  if (value && typeof value === "object" && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = revive(v);
    return out as T;
  }
  return value as T;
}

export function fromSnap<T extends { id: string }>(snap: DocumentSnapshot): T | null {
  if (!snap.exists) return null;
  return { ...revive<Omit<T, "id">>(snap.data()), id: snap.id } as T;
}

/** Quita `id` antes de escribir (el id es el del documento). */
export function toData<T extends { id: string }>(obj: T): Omit<T, "id"> {
  const { id: _id, ...rest } = obj;
  void _id;
  return rest;
}
