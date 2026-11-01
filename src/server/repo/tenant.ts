import { cache } from "react";
import { DEFAULT_TENANT } from "@/lib/domain/defaults";
import type { Tenant } from "@/lib/domain/types";
import { revive, tenantRef } from "../db";

/** Mezcla lo guardado con los valores por defecto, para tolerar campos faltantes. */
export function withDefaults(stored: Partial<Tenant> | undefined): Tenant {
  const s = stored ?? {};
  return {
    ...DEFAULT_TENANT,
    ...s,
    bankTransfer: { ...DEFAULT_TENANT.bankTransfer, ...s.bankTransfer },
    skincare: { ...DEFAULT_TENANT.skincare, ...s.skincare },
    makeup: { ...DEFAULT_TENANT.makeup, ...s.makeup },
    weeklyTemplate: { ...DEFAULT_TENANT.weeklyTemplate, ...s.weeklyTemplate },
    policies: { ...DEFAULT_TENANT.policies, ...s.policies },
  };
}

export async function loadTenant(): Promise<Tenant> {
  const snap = await tenantRef().get();
  return withDefaults(snap.exists ? revive<Partial<Tenant>>(snap.data()) : undefined);
}

/** Una lectura por request de render. */
export const getTenant = cache(loadTenant);

export async function updateTenant(patch: Partial<Tenant>): Promise<void> {
  await tenantRef().set(patch, { merge: true });
}

/** Reemplaza la plantilla semanal completa (merge no sirve para borrar días). */
export async function setWeeklyTemplate(template: Tenant["weeklyTemplate"]): Promise<void> {
  await tenantRef().set({ weeklyTemplate: template }, { mergeFields: ["weeklyTemplate"] });
}
