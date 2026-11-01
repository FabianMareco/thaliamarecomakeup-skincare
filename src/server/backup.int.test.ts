import { beforeEach, describe, expect, it } from "vitest";
import { seedServiceId } from "@/lib/domain/defaults";
import { arLocalToInstant } from "@/lib/domain/time";
import { createBackup, restoreBackup, tenantHasData } from "./backup";
import { confirmDepositManually } from "./flows/admin";
import { uploadReceipt } from "./flows/receipts";
import { createSkincareBooking } from "./flows/skincare";
import { manageTokenFor } from "./links";
import { readReceipt } from "./receiptStore";
import { getBooking, getClient, getSlot } from "./repo/bookings";
import { loadTenant } from "./repo/tenant";
import { JPG, putSlot, resetEmulators, setupTenant } from "./test-helpers";

const NOW = arLocalToInstant("2026-11-02", "08:00");
const LIMPIEZA = seedServiceId({ line: "skincare", category: "Tratamientos faciales", name: "Limpieza profunda Clásica" });

beforeEach(async () => {
  await setupTenant();
});

describe("copia de seguridad", () => {
  it("respalda todo, sobrevive a pasar por JSON y se restaura idéntico", async () => {
    const slot = await putSlot({ date: "2026-11-10", time: "09:00", durationMin: 120, modality: "in_person" });
    const { bookingId } = await createSkincareBooking(
      { name: "Ana Pérez", phone: "11 5000-0001", email: "ana@example.com", firstVisit: true, acceptPolicies: true, serviceId: LIMPIEZA, slotId: slot.id },
      { now: NOW },
    );
    const withReceipt = await uploadReceipt(manageTokenFor(bookingId), JPG, "Ana Pérez", NOW);
    await confirmDepositManually(bookingId, {}, NOW);
    const before = { booking: await getBooking(bookingId), slot: await getSlot(slot.id), client: await getClient("+5491150000001"), tenant: await loadTenant() };

    const file = JSON.parse(JSON.stringify(await createBackup("test")));
    expect(file.docs.some((d: { path: string }) => d.path.startsWith("rateLimits/"))).toBe(false);

    await resetEmulators();
    expect(await tenantHasData()).toBe(false);
    await restoreBackup(file);

    expect(await getBooking(bookingId)).toEqual(before.booking);
    expect(await getSlot(slot.id)).toEqual(before.slot);
    expect(await getClient("+5491150000001")).toEqual(before.client);
    expect(await loadTenant()).toEqual(before.tenant);
    expect(await readReceipt(withReceipt.deposit.receipts[0].path)).toEqual(JPG);
    expect((await getBooking(bookingId))!.createdAt).toBeInstanceOf(Date);
  });
});
