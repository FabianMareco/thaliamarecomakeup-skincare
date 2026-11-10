import type { Query } from "firebase-admin/firestore";
import type { Line, Service } from "@/lib/domain/types";
import { cols, fromSnap, toData } from "../db";

export async function listServices(opts: { line?: Line; activeOnly?: boolean } = {}): Promise<Service[]> {
  let q: Query = cols.services();
  if (opts.line) q = q.where("line", "==", opts.line);
  const snap = await q.get();
  return snap.docs
    .map((d) => fromSnap<Service>(d)!)
    .filter((s) => !opts.activeOnly || s.active)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function getService(id: string): Promise<Service | null> {
  return fromSnap<Service>(await cols.services().doc(id).get());
}

export async function saveService(service: Service): Promise<void> {
  await cols.services().doc(service.id).set(toData(service));
}

export function newServiceId(): string {
  return cols.services().doc().id;
}
