import { newOpenSlot, type SlotInput } from "@/lib/domain/slots";
import type { Slot } from "@/lib/domain/types";
import { toData } from "./db";
import type { SendResult } from "./notify/providers";
import { setNotifyProviders } from "./notify/notify";
import { slotRef } from "./repo/bookings";
import { seed } from "./seed";

// Utilidades para los tests de integración contra los emuladores.

export type Sent = { channel: "email" | "whatsapp"; to: string; subject?: string; template?: string; params?: string[] };

export async function resetEmulators(): Promise<void> {
  const project = process.env.FIREBASE_PROJECT_ID;
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const res = await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`No se pudo limpiar Firestore: ${res.status}`);
}

export async function setupTenant(): Promise<Sent[]> {
  await resetEmulators();
  await seed({ tenant: { privateAddress: "Calle Falsa 123, 4° B", notificationEmail: "thalia@example.com" } });
  return captureNotifications();
}

export function captureNotifications(fail = false): Sent[] {
  const sent: Sent[] = [];
  const result = (): SendResult => (fail ? { status: "failed", error: "boom" } : { status: "sent", id: "test" });
  setNotifyProviders({
    email: {
      async send(m) {
        sent.push({ channel: "email", to: m.to, subject: m.subject });
        return result();
      },
    },
    whatsapp: {
      mode: "cloud_api",
      async sendTemplate(m) {
        sent.push({ channel: "whatsapp", to: m.to, template: m.template, params: m.params });
        return result();
      },
    },
  });
  return sent;
}

export async function putSlot(input: SlotInput, patch: Partial<Slot> = {}): Promise<Slot> {
  const slot = { ...newOpenSlot(input), ...patch };
  await slotRef(slot.id).set(toData(slot));
  return slot;
}

/** Bytes mínimos de un JPG válido para las pruebas. */
export const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
