import type { Transaction } from "firebase-admin/firestore";
import type { Booking, BookingStatus, Client, DepositStatus, Slot } from "@/lib/domain/types";
import { cols, fromSnap, toData } from "../db";
import { hashToken } from "../tokens";

// Lecturas y escrituras de reservas, horarios y clientas.

export const bookingRef = (id: string) => cols.bookings().doc(id);
export const slotRef = (id: string) => cols.slots().doc(id);
export const clientRef = (id: string) => cols.clients().doc(id);

export async function getBooking(id: string): Promise<Booking | null> {
  return fromSnap<Booking>(await bookingRef(id).get());
}

export async function txGetBooking(tx: Transaction, id: string): Promise<Booking | null> {
  return fromSnap<Booking>(await tx.get(bookingRef(id)));
}

export async function txGetSlot(tx: Transaction, id: string): Promise<Slot | null> {
  return fromSnap<Slot>(await tx.get(slotRef(id)));
}

export function txSetBooking(tx: Transaction, booking: Booking): void {
  tx.set(bookingRef(booking.id), toData(booking));
}

export function txSetSlot(tx: Transaction, slot: Slot): void {
  tx.set(slotRef(slot.id), toData(slot));
}

/** Busca la reserva a partir del token de los links (solo se guarda su hash). */
export async function findBookingByToken(token: string): Promise<Booking | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const snap = await cols.bookings().where("manageTokenHash", "==", hashToken(token)).limit(1).get();
  return snap.empty ? null : fromSnap<Booking>(snap.docs[0]);
}

export async function findBookingByCode(code: string): Promise<Booking | null> {
  const snap = await cols.bookings().where("code", "==", code).limit(1).get();
  return snap.empty ? null : fromSnap<Booking>(snap.docs[0]);
}

export async function listBookingsByStatus(statuses: BookingStatus[]): Promise<Booking[]> {
  if (statuses.length === 0) return [];
  const snap = await cols.bookings().where("status", "in", statuses).get();
  return snap.docs.map((d) => fromSnap<Booking>(d)!);
}

export async function listBookingsByDepositStatus(status: DepositStatus): Promise<Booking[]> {
  const snap = await cols.bookings().where("deposit.status", "==", status).get();
  return snap.docs.map((d) => fromSnap<Booking>(d)!);
}

/** Reservas cuyo turno/evento empieza en el rango [from, to). */
export async function listBookingsBetween(from: Date, to: Date): Promise<Booking[]> {
  const snap = await cols.bookings().where("startAt", ">=", from).where("startAt", "<", to).get();
  return snap.docs.map((d) => fromSnap<Booking>(d)!);
}

export async function listBookingsByClient(clientId: string): Promise<Booking[]> {
  const snap = await cols.bookings().where("clientId", "==", clientId).get();
  return snap.docs
    .map((d) => fromSnap<Booking>(d)!)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Reservas de maquillaje en una fecha de evento (para superposiciones). */
export async function listMakeupByEventDate(date: string): Promise<Booking[]> {
  const snap = await cols.bookings().where("makeup.eventDate", "==", date).get();
  return snap.docs.map((d) => fromSnap<Booking>(d)!);
}

export async function listBookingsByTrialDate(date: string): Promise<Booking[]> {
  const snap = await cols.bookings().where("makeup.trialDate", "==", date).get();
  return snap.docs.map((d) => fromSnap<Booking>(d)!);
}

export async function listSlotsBetween(fromDate: string, toDate: string): Promise<Slot[]> {
  const snap = await cols.slots().where("date", ">=", fromDate).where("date", "<=", toDate).get();
  return snap.docs
    .map((d) => fromSnap<Slot>(d)!)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export async function getSlot(id: string): Promise<Slot | null> {
  return fromSnap<Slot>(await slotRef(id).get());
}

export async function listClients(): Promise<Client[]> {
  const snap = await cols.clients().get();
  return snap.docs.map((d) => fromSnap<Client>(d)!);
}

export async function getClient(id: string): Promise<Client | null> {
  return fromSnap<Client>(await clientRef(id).get());
}
