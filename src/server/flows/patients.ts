import { normalizePhone } from "@/lib/domain/phone";
import type { Booking, Client } from "@/lib/domain/types";
import { z } from "zod";
import { cols, fromSnap, toData } from "../db";
import { UserError } from "../errors";
import { db } from "../firebase";
import { bookingRef, clientRef } from "../repo/bookings";

// Edición de los datos de una paciente desde el panel. La ficha se identifica
// por el teléfono: si cambia, se mueve a un documento nuevo y todas sus
// reservas pasan a apuntar a él. Las reservas guardan una copia de los datos
// (para los avisos), así que también se actualizan.

export type PatientInput = { name: string; phone: string; email: string };

export async function updatePatient(clientId: string, raw: PatientInput, now = new Date()): Promise<Client> {
  const name = (raw.name ?? "").trim();
  if (name.length < 2 || name.length > 80) throw new UserError("Ingresá el nombre de la paciente.");
  // El email es opcional (muchas pacientes solo tienen WhatsApp).
  const email = (raw.email ?? "").trim().toLowerCase();
  if (email && !z.email().safeParse(email).success) throw new UserError("El email no es válido.");
  const phone = normalizePhone(raw.phone ?? "");
  if (!phone) throw new UserError("Revisá el WhatsApp (con código de área, ej. 11 5847-0009).");

  return db().runTransaction(async (tx) => {
    const cur = fromSnap<Client>(await tx.get(clientRef(clientId)));
    if (!cur) throw new UserError("No encontramos a la paciente.");
    const moving = phone !== cur.id;
    if (moving && (await tx.get(clientRef(phone))).exists) {
      throw new UserError("Ya hay otra paciente con ese WhatsApp.");
    }
    const bookings = (await tx.get(cols.bookings().where("clientId", "==", clientId))).docs.map((d) => fromSnap<Booking>(d)!);

    const next: Client = { ...cur, id: phone, name, phone, email };
    if (moving) tx.delete(clientRef(cur.id));
    tx.set(clientRef(phone), toData(next));
    for (const b of bookings) {
      tx.update(bookingRef(b.id), {
        clientId: phone,
        "client.name": name,
        "client.phone": phone,
        "client.email": email,
        updatedAt: now,
      });
    }
    return next;
  });
}
