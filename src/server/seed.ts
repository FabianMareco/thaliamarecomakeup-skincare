import { DEFAULT_TENANT, SEED_SERVICES, seedServiceId } from "@/lib/domain/defaults";
import type { Tenant } from "@/lib/domain/types";
import { cols, tenantRef } from "./db";
import { db } from "./firebase";

// Datos iniciales (sección 16). Idempotente: no pisa la configuración ni los
// servicios ya cargados salvo que se pida `overwrite`.

export async function seed(opts: { overwrite?: boolean; tenant?: Partial<Tenant> } = {}) {
  const tenantSnap = await tenantRef().get();
  let tenantWritten = false;
  if (!tenantSnap.exists || opts.overwrite) {
    await tenantRef().set({ ...DEFAULT_TENANT, ...opts.tenant });
    tenantWritten = true;
  }

  const batch = db().batch();
  let created = 0;
  const counters: Record<string, number> = {};
  for (const s of SEED_SERVICES) {
    const id = seedServiceId(s);
    counters[s.line] = (counters[s.line] ?? 0) + 1;
    const ref = cols.services().doc(id);
    if (!opts.overwrite && (await ref.get()).exists) continue;
    batch.set(ref, { ...s, active: true, order: counters[s.line] * 10 });
    created++;
  }
  await batch.commit();
  return { tenantWritten, servicesCreated: created, servicesTotal: SEED_SERVICES.length };
}
