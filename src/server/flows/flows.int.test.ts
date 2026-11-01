import { beforeEach, describe, expect, it } from "vitest";
import { isSlotFree } from "@/lib/domain/availability";
import { seedServiceId } from "@/lib/domain/defaults";
import { arLocalToInstant } from "@/lib/domain/time";
import { env } from "../env";
import { bucket } from "../firebase";
import { manageTokenFor } from "../links";
import { deleteReceipt, readReceipt } from "../receiptStore";
import { getBooking, getClient, getSlot } from "../repo/bookings";
import { JPG, putSlot, setupTenant, type Sent } from "../test-helpers";
import { getManageView, getPaymentView } from "../views";
import {
  adminCancel,
  approveReceipt,
  approveSameDay,
  confirmDepositManually,
  markAttendance,
  markRefunded,
  rejectBooking,
  requestResubmit,
} from "./admin";
import { runTick } from "./cron";
import { acceptMakeup, createMakeupRequest } from "./makeup";
import { cancelByClient, rescheduleByClient } from "./manage";
import { uploadReceipt } from "./receipts";
import { createSkincareBooking, getAvailability } from "./skincare";
import { closeDay, createSlot, deleteSlot, generateRange, updateSlot } from "./schedule";

const MIN = 60_000;
const H = 3600_000;
const LIMPIEZA = seedServiceId({ line: "skincare", category: "Tratamientos faciales", name: "Limpieza profunda Clásica" });
const ASESORIA = seedServiceId({ line: "skincare", category: "Asesoría", name: "Asesoría virtual + armado de rutina" });
const COMBO = seedServiceId({ line: "makeup", category: "Sociales y eventos", name: "Combo maquillaje + peinado" });
const NOVIAS_COMBO = seedServiceId({ line: "makeup", category: "Novias", name: "Combo pruebas + makeup y peinado" });

// Lunes 2/11/2026, 08:00 en Buenos Aires.
const NOW = arLocalToInstant("2026-11-02", "08:00");

const client = (n: number) => ({
  name: `Clienta ${n}`,
  phone: `11 5000-000${n}`,
  email: `clienta${n}@example.com`,
  firstVisit: true,
  acceptPolicies: true as const,
});

let sent: Sent[];
beforeEach(async () => {
  sent = await setupTenant();
});

async function bookFuture(n = 1, slotTime = "11:00", date = "2026-11-10") {
  const slot = await putSlot({ date, time: slotTime, durationMin: 120, modality: "in_person" });
  const r = await createSkincareBooking({ ...client(n), serviceId: LIMPIEZA, slotId: slot.id }, { now: NOW });
  return { slot, ...r };
}

describe("Fase 3 — reserva skincare y pago por transferencia", () => {
  it("dos clientas que intentan el mismo horario a la vez: solo una lo obtiene", async () => {
    const slot = await putSlot({ date: "2026-11-10", time: "09:00", durationMin: 120, modality: "in_person" });
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map((n) => createSkincareBooking({ ...client(n), serviceId: LIMPIEZA, slotId: slot.id }, { now: NOW })),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed.map((f) => f.reason.message)).toEqual(Array(3).fill("Ese horario ya no está disponible. Elegí otro, por favor."));
    const s = await getSlot(slot.id);
    expect(s).toMatchObject({ status: "held", bookingId: (ok[0] as PromiseFulfilledResult<{ bookingId: string }>).value.bookingId });
  });

  it("crea la reserva en awaiting_payment, retiene el horario y manda el link de pago", async () => {
    const { bookingId, token, status, slot } = await bookFuture();
    expect(status).toBe("awaiting_payment");
    expect(token).toBe(manageTokenFor(bookingId));
    const b = (await getBooking(bookingId))!;
    expect(b).toMatchObject({
      code: expect.stringMatching(/^TM-\d{4}$/),
      deposit: { amount: 20000, status: "pending" },
      balance: { amount: 30000 },
      service: { name: "Limpieza profunda Clásica", price: 50000, durationMin: 120 },
      client: { phone: "+5491150000001" },
    });
    expect(b.manageTokenHash).not.toContain(token);
    expect(b.deposit.receiptUploadDeadline!.getTime()).toBe(NOW.getTime() + 60 * MIN);
    expect(await getSlot(slot.id)).toMatchObject({ status: "held", bookingId, heldUntil: b.deposit.receiptUploadDeadline });
    expect(sent.map((s) => s.channel + ":" + (s.template ?? s.subject))).toEqual([
      expect.stringMatching(/^email:Reservá tu lugar/),
      "whatsapp:turno_link_pago",
    ]);
    expect(await getClient("+5491150000001")).toMatchObject({ bookingsCount: 1, noShowCount: 0 });
    // El horario ya no aparece disponible.
    const avail = await getAvailability(LIMPIEZA, NOW);
    expect(avail.flatMap((d) => d.slots.map((s) => s.id))).not.toContain(slot.id);
  });

  it("si la clienta no sube el comprobante a tiempo, el horario se libera", async () => {
    const { bookingId, slot } = await bookFuture();
    // Expiración perezosa: apenas vence el plazo, el horario ya cuenta como libre.
    const later = new Date(NOW.getTime() + 61 * MIN);
    expect(isSlotFree((await getSlot(slot.id))!, later)).toBe(true);
    // Y no se puede subir el comprobante fuera de plazo.
    await expect(uploadReceipt(manageTokenFor(bookingId), JPG, "Clienta 1", later)).rejects.toThrow(/venció/);
    const report = await runTick(later);
    expect(report.expiredPayments).toEqual([bookingId]);
    expect((await getBooking(bookingId))!.status).toBe("expired");
    expect(await getSlot(slot.id)).toMatchObject({ status: "open", bookingId: null, heldUntil: null });
    expect(sent.some((s) => s.template === "turno_vencido")).toBe(true);
  });

  it("mientras un comprobante espera verificación, el horario no se libera solo", async () => {
    const { bookingId, slot } = await bookFuture();
    const token = manageTokenFor(bookingId);
    const b = await uploadReceipt(token, JPG, "Clienta Uno", new Date(NOW.getTime() + 10 * MIN));
    expect(b).toMatchObject({ status: "awaiting_verification", deposit: { status: "submitted" } });
    expect(b.deposit.receipts).toHaveLength(1);
    const s = (await getSlot(slot.id))!;
    expect(s).toMatchObject({ status: "held", heldUntil: null });
    const muchLater = new Date(NOW.getTime() + 5 * 24 * H);
    expect(isSlotFree(s, muchLater)).toBe(false);
    await runTick(muchLater);
    expect((await getBooking(bookingId))!.status).toBe("awaiting_verification");
    expect((await getSlot(slot.id))!.status).toBe("held");
    expect(sent.filter((s) => s.subject?.includes("Comprobante para verificar"))).toHaveLength(1);
  });

  it("aprobar confirma la reserva y reserva el horario", async () => {
    const { bookingId, slot } = await bookFuture();
    await uploadReceipt(manageTokenFor(bookingId), JPG, "Clienta Uno", NOW);
    const b = await approveReceipt(bookingId, NOW);
    expect(b).toMatchObject({ status: "confirmed", deposit: { status: "verified" } });
    expect(b.deposit.receipts[0].result).toBe("approved");
    expect(await getSlot(slot.id)).toMatchObject({ status: "booked", bookingId });
    // Idempotente: aprobar de nuevo no duplica la confirmación.
    await approveReceipt(bookingId, NOW);
    expect(sent.filter((s) => s.template === "turno_confirmado")).toHaveLength(1);
    const confirmation = sent.find((s) => s.template === "turno_confirmado")!;
    expect(confirmation.params!.join(" ")).toContain("Calle Falsa 123");
  });

  it("pedir reenviar permite subir otro comprobante", async () => {
    const { bookingId, slot } = await bookFuture();
    const token = manageTokenFor(bookingId);
    await uploadReceipt(token, JPG, "Clienta Uno", NOW);
    const t1 = new Date(NOW.getTime() + 30 * MIN);
    const b = await requestResubmit(bookingId, "No se ve el monto", t1);
    expect(b).toMatchObject({ status: "awaiting_payment", deposit: { status: "pending", resubmitReason: "No se ve el monto" } });
    expect(b.deposit.receiptUploadDeadline!.getTime()).toBe(t1.getTime() + 60 * MIN);
    expect((await getSlot(slot.id))!.heldUntil!.getTime()).toBe(t1.getTime() + 60 * MIN);
    const view = (await getPaymentView(token, t1))!;
    expect(view.payment?.resubmitReason).toBe("No se ve el monto");
    const again = await uploadReceipt(token, JPG, "Clienta Uno", new Date(t1.getTime() + 5 * MIN));
    expect(again.status).toBe("awaiting_verification");
    expect(again.deposit.receipts.map((r) => r.result)).toEqual(["rejected", undefined]);
  });

  it("rechazar libera el horario", async () => {
    const { bookingId, slot } = await bookFuture();
    await uploadReceipt(manageTokenFor(bookingId), JPG, "Clienta Uno", NOW);
    const b = await rejectBooking(bookingId, "El dinero no ingresó", NOW);
    expect(b.status).toBe("rejected");
    expect(await getSlot(slot.id)).toMatchObject({ status: "open", bookingId: null });
  });

  it("un archivo que no es imagen ni PDF, o que supera 5 MB, se rechaza", async () => {
    const { bookingId } = await bookFuture();
    const token = manageTokenFor(bookingId);
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    await expect(uploadReceipt(token, html, "Clienta Uno", NOW)).rejects.toThrow(/imagen .* o un PDF/);
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(JPG);
    await expect(uploadReceipt(token, big, "Clienta Uno", NOW)).rejects.toThrow(/5 MB/);
    expect((await getBooking(bookingId))!.status).toBe("awaiting_payment");
  });

  it("un comprobante solo es visible para Thalia, nunca por URL pública (Firestore, plan Spark)", async () => {
    const { bookingId } = await bookFuture();
    const b = await uploadReceipt(manageTokenFor(bookingId), JPG, "Clienta Uno", NOW);
    const ref = b.deposit.receipts[0].path;
    expect(ref).toMatch(/^firestore:[A-Za-z0-9]+$/);
    expect(await readReceipt(ref)).toEqual(JPG);
    // Sin credenciales de administrador, las reglas de Firestore niegan la lectura.
    const docPath = `projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/tenants/${env.tenantId}/receiptFiles/${ref.slice(10)}`;
    expect((await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/${docPath}`)).status).toBe(403);
    expect((await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/${docPath}/chunks/0`)).status).toBe(403);
    // La vista pública de la reserva no expone referencias de comprobantes.
    const view = await getPaymentView(manageTokenFor(bookingId), NOW);
    expect(JSON.stringify(view)).not.toContain(ref);
  });

  it("guarda archivos de hasta 5 MB partidos en pedazos y los recupera intactos", async () => {
    const { bookingId } = await bookFuture();
    const big = new Uint8Array(5 * 1024 * 1024);
    for (let i = 0; i < big.length; i++) big[i] = (i * 31) % 251;
    big.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
    const b = await uploadReceipt(manageTokenFor(bookingId), big, "Clienta Uno", NOW);
    const ref = b.deposit.receipts[0].path;
    const back = await readReceipt(ref);
    expect(back.length).toBe(big.length);
    expect(Buffer.from(back).equals(Buffer.from(big))).toBe(true);
    await deleteReceipt(ref);
    await expect(readReceipt(ref)).rejects.toThrow(/inexistente/);
  });

  it("con RECEIPT_STORAGE=storage usa Firebase Storage, privado, y los comprobantes anteriores se siguen leyendo", async () => {
    const first = await bookFuture(1, "09:00");
    const old = (await uploadReceipt(manageTokenFor(first.bookingId), JPG, "Clienta Uno", NOW)).deposit.receipts[0].path;
    process.env.RECEIPT_STORAGE = "storage";
    try {
      const second = await bookFuture(2, "11:00");
      const path = (await uploadReceipt(manageTokenFor(second.bookingId), JPG, "Clienta Dos", NOW)).deposit.receipts[0].path;
      expect(path).toMatch(new RegExp(`^receipts/${env.tenantId}/${second.bookingId}/\\d+\\.jpg$`));
      expect(await readReceipt(path)).toEqual(JPG);
      // Sin credenciales de administrador, las reglas de Storage niegan la lectura.
      const url = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${bucket().name}/o/${encodeURIComponent(path)}?alt=media`;
      expect((await fetch(url)).status).toBe(403);
      // El comprobante guardado antes en Firestore se sigue leyendo.
      expect(await readReceipt(old)).toEqual(JPG);
    } finally {
      delete process.env.RECEIPT_STORAGE;
    }
  });

  it("máximo 1 reserva esperando pago por teléfono", async () => {
    await bookFuture(1, "09:00");
    const slot2 = await putSlot({ date: "2026-11-11", time: "09:00", durationMin: 120, modality: "in_person" });
    await expect(
      createSkincareBooking({ ...client(1), email: "otra@example.com", serviceId: LIMPIEZA, slotId: slot2.id }, { now: NOW }),
    ).rejects.toThrow(/Ya tenés una reserva esperando/);
  });

  it("respeta compatibilidad de duración y modalidad", async () => {
    const short = await putSlot({ date: "2026-11-10", time: "15:00", durationMin: 60, modality: "in_person" });
    await expect(createSkincareBooking({ ...client(1), serviceId: LIMPIEZA, slotId: short.id }, { now: NOW })).rejects.toThrow(/no está disponible/);
    const virtual = await putSlot({ date: "2026-11-10", time: "20:00", durationMin: 40, modality: "virtual" });
    const ok = await createSkincareBooking({ ...client(2), serviceId: ASESORIA, slotId: virtual.id }, { now: NOW });
    expect(ok.status).toBe("awaiting_payment");
  });
});

describe("Fase 4 — gestión", () => {
  async function confirmed(date = "2026-11-10", time = "11:00", n = 1) {
    const { bookingId, slot } = await bookFuture(n, time, date);
    await confirmDepositManually(bookingId, {}, NOW);
    return { bookingId, slot, token: manageTokenFor(bookingId) };
  }

  it("una reserva del mismo día no muestra datos de transferencia hasta que Thalia la aprueba", async () => {
    const slot = await putSlot({ date: "2026-11-02", time: "16:00", durationMin: 120, modality: "in_person" });
    const r = await createSkincareBooking({ ...client(1), serviceId: LIMPIEZA, slotId: slot.id }, { now: NOW });
    expect(r.status).toBe("awaiting_approval");
    const b = (await getBooking(r.bookingId))!;
    expect(b.approvalDeadline!.getTime()).toBe(NOW.getTime() + 120 * MIN);
    expect((await getSlot(slot.id))!.heldUntil!.getTime()).toBe(b.approvalDeadline!.getTime());

    const before = (await getPaymentView(r.token, NOW))!;
    expect(before.payment).toBeNull();
    expect(JSON.stringify(before)).not.toContain("thalia.mareco.makeup");
    expect(sent.map((s) => s.template ?? s.subject)).toEqual(
      expect.arrayContaining(["turno_mismo_dia_recibido", expect.stringMatching(/URGENTE · Solicitud para hoy/)]),
    );
    expect(sent.some((s) => s.template === "turno_link_pago")).toBe(false);

    const t1 = new Date(NOW.getTime() + 20 * MIN);
    await approveSameDay(r.bookingId, t1);
    const after = (await getPaymentView(r.token, t1))!;
    expect(after.payment).toMatchObject({ alias: "thalia.mareco.makeup", amount: 20000 });
    expect(sent.some((s) => s.template === "turno_aprobado_link_pago")).toBe(true);
    expect((await getSlot(slot.id))!.heldUntil!.getTime()).toBe(t1.getTime() + 60 * MIN);
  });

  it("una solicitud del mismo día sin respuesta vence y libera el horario", async () => {
    const slot = await putSlot({ date: "2026-11-02", time: "16:00", durationMin: 120, modality: "in_person" });
    const r = await createSkincareBooking({ ...client(1), serviceId: LIMPIEZA, slotId: slot.id }, { now: NOW });
    const report = await runTick(new Date(NOW.getTime() + 121 * MIN));
    expect(report.expiredApprovals).toEqual([r.bookingId]);
    expect((await getSlot(slot.id))!.status).toBe("open");
  });

  it("cancelar con reintegro con 48:00 de anticipación; 47:59 ya no", async () => {
    const { bookingId, slot, token } = await confirmed("2026-11-10", "09:00");
    const at4759 = arLocalToInstant("2026-11-08", "09:01");
    await expect(cancelByClient(token, { refund: true, destination: "mi.alias.mp" }, at4759)).rejects.toThrow(/menos de 48 hs/);
    const at4800 = arLocalToInstant("2026-11-08", "09:00");
    const b = await cancelByClient(token, { refund: true, destination: "mi.alias.mp" }, at4800);
    expect(b).toMatchObject({ status: "cancelled_refunded", deposit: { status: "refund_pending", refundDestination: "mi.alias.mp" } });
    expect((await getSlot(slot.id))!.status).toBe("open");
    expect(sent.some((s) => s.subject?.startsWith("Reintegro pendiente"))).toBe(true);
    const refunded = await markRefunded(bookingId, at4800);
    expect(refunded.deposit.status).toBe("refunded");
    expect(sent.some((s) => s.template === "turno_reintegro_realizado")).toBe(true);
  });

  it("con menos de 48 hs solo se puede cancelar sin reintegro", async () => {
    const { token } = await confirmed("2026-11-10", "09:00");
    const at = arLocalToInstant("2026-11-09", "10:00");
    expect((await getManageView(token, at))!.options).toMatchObject({ canCancelWithRefund: false, canCancelForfeit: true });
    const b = await cancelByClient(token, { refund: false }, at);
    expect(b).toMatchObject({ status: "cancelled_forfeited", deposit: { status: "forfeited" } });
  });

  it("reprogramación autogestionada: hasta 1 vez y respetando 48 hs", async () => {
    const { token, slot } = await confirmed("2026-11-10", "09:00");
    const s2 = await putSlot({ date: "2026-11-12", time: "09:00", durationMin: 120, modality: "in_person" });
    const s3 = await putSlot({ date: "2026-11-13", time: "09:00", durationMin: 120, modality: "in_person" });
    const b = await rescheduleByClient(token, s2.id, NOW);
    expect(b).toMatchObject({ status: "confirmed", slotId: s2.id, date: "2026-11-12", rescheduleCount: 1 });
    expect(b.history.at(-1)).toMatchObject({ from: "confirmed", to: "confirmed", by: "client" });
    expect(await getSlot(slot.id)).toMatchObject({ status: "open", bookingId: null });
    expect(await getSlot(s2.id)).toMatchObject({ status: "booked", bookingId: b.id });
    await expect(rescheduleByClient(token, s3.id, NOW)).rejects.toThrow(/WhatsApp/);
  });

  it("Thalia puede cancelar ignorando la regla de 48 hs y marcar asistencia", async () => {
    const a = await confirmed("2026-11-03", "09:00", 1);
    const b = await adminCancel(a.bookingId, { refund: true, destination: "alias.x" }, arLocalToInstant("2026-11-03", "08:00"));
    expect(b.status).toBe("cancelled_refunded");
    const c = await confirmed("2026-11-04", "09:00", 2);
    const noShow = await markAttendance(c.bookingId, false, NOW);
    expect(noShow).toMatchObject({ status: "no_show", attendance: "no_show", deposit: { status: "forfeited" } });
    expect((await getClient("+5491150000002"))!.noShowCount).toBe(1);
  });
});

describe("Fase 5 — maquillaje", () => {
  const request = {
    ...client(5),
    serviceId: COMBO,
    eventDate: "2026-12-05",
    readyByTime: "18:00",
    location: "home" as const,
    homeAddress: "Palermo",
    peopleCount: 2,
    comments: "Look natural",
  };

  it("flujo completo de solicitud a confirmación; la seña nunca incluye el viático", async () => {
    const { bookingId, token } = await createMakeupRequest(request, { now: NOW });
    expect((await getBooking(bookingId))!).toMatchObject({ status: "requested", line: "makeup" });
    expect((await getPaymentView(token, NOW))!.payment).toBeNull();
    expect(sent.map((s) => s.subject ?? s.template)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Recibimos tu solicitud/), expect.stringMatching(/^Nueva solicitud de maquillaje/)]),
    );

    const r = await acceptMakeup(bookingId, { finalPrice: 480000, travelFee: 20000, startTime: "15:30" }, NOW);
    expect(r.accepted).toBe(true);
    const b = (await getBooking(bookingId))!;
    expect(b).toMatchObject({
      status: "awaiting_payment",
      deposit: { amount: 240000 },
      balance: { amount: 260000 },
      makeup: { finalPrice: 480000, travelFee: 20000, startTime: "15:30" },
      date: "2026-12-05",
      time: "15:30",
    });
    expect(b.deposit.receiptUploadDeadline!.getTime()).toBe(NOW.getTime() + 48 * H);
    expect((await getPaymentView(token, NOW))!.payment).toMatchObject({ amount: 240000 });

    await uploadReceipt(token, new TextEncoder().encode("%PDF-1.4 comprobante"), "Clienta Cinco", NOW);
    const done = await approveReceipt(bookingId, NOW);
    expect(done.status).toBe("confirmed");
    expect(sent.some((s) => s.template === "turno_confirmado")).toBe(true);
  });

  it("vence si no sube el comprobante en 48 hs y avisa a Thalia", async () => {
    const { bookingId } = await createMakeupRequest(request, { now: NOW });
    await acceptMakeup(bookingId, { finalPrice: 240000, startTime: "16:00" }, NOW);
    await runTick(new Date(NOW.getTime() + 47 * H));
    expect((await getBooking(bookingId))!.status).toBe("awaiting_payment");
    await runTick(new Date(NOW.getTime() + 48 * H + MIN));
    expect((await getBooking(bookingId))!.status).toBe("expired");
    expect(sent.some((s) => s.subject?.startsWith("Solicitud de maquillaje vencida"))).toBe(true);
  });

  it("avisa superposición con la agenda de skincare (sin bloquear)", async () => {
    await putSlot({ date: "2026-12-05", time: "16:00", durationMin: 120, modality: "in_person" });
    const { bookingId } = await createMakeupRequest({ ...request, serviceId: NOVIAS_COMBO, preferredTrialDate: "2026-11-20" }, { now: NOW });
    const r = await acceptMakeup(bookingId, { finalPrice: 490000, startTime: "15:00", trialDate: "2026-11-20", trialTime: "10:00" }, NOW);
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.warnings).toEqual([{ kind: "event", label: "Skincare: horario publicado 16:00 (120 min)" }]);
    const forced = await acceptMakeup(bookingId, { finalPrice: 490000, startTime: "15:00", trialDate: "2026-11-20", trialTime: "10:00", force: true }, NOW);
    expect(forced.accepted).toBe(true);
    expect((await getBooking(bookingId))!.makeup).toMatchObject({ trialDate: "2026-11-20", trialTime: "10:00", preferredTrialDate: "2026-11-20" });
  });
});

describe("Fase 6 — recordatorios", () => {
  it("ejecutar el tick dos veces seguidas no duplica envíos", async () => {
    const { bookingId } = await bookFuture(1, "09:00", "2026-11-10");
    await confirmDepositManually(bookingId, {}, NOW);
    const at72 = new Date(arLocalToInstant("2026-11-10", "09:00").getTime() - 71 * H);
    const [r1, r2] = await Promise.all([runTick(at72), runTick(at72)]);
    await runTick(at72);
    expect([...r1.reminders, ...r2.reminders]).toHaveLength(1);
    const reminders = sent.filter((s) => s.template === "turno_recordatorio");
    expect(reminders).toHaveLength(1);
    expect(reminders[0].params![3]).toContain("para reprogramar o cancelar con reintegro");
    const at24 = new Date(arLocalToInstant("2026-11-10", "09:00").getTime() - 23 * H);
    await runTick(at24);
    await runTick(at24);
    const all = sent.filter((s) => s.template === "turno_recordatorio");
    expect(all).toHaveLength(2);
    expect(all[1].params![3]).toContain("Calle Falsa 123");
  });

  it("una reserva hecha 30 hs antes no recibe el recordatorio de 72 hs", async () => {
    const start = arLocalToInstant("2026-11-03", "14:00");
    const created = new Date(start.getTime() - 30 * H);
    const slot = await putSlot({ date: "2026-11-03", time: "14:00", durationMin: 120, modality: "in_person" });
    const r = await createSkincareBooking({ ...client(1), serviceId: LIMPIEZA, slotId: slot.id }, { now: created });
    await confirmDepositManually(r.bookingId, {}, created);
    const report = await runTick(new Date(start.getTime() - 25 * H));
    expect(report.reminders).toEqual([]);
    const report24 = await runTick(new Date(start.getTime() - 24 * H));
    expect(report24.reminders).toEqual([{ bookingId: r.bookingId, offset: 24, delivered: true }]);
  });

  it("re-avisa a Thalia una sola vez por comprobante sin verificar", async () => {
    const { bookingId } = await bookFuture();
    await uploadReceipt(manageTokenFor(bookingId), JPG, "Clienta Uno", NOW);
    await runTick(new Date(NOW.getTime() + 59 * MIN));
    await runTick(new Date(NOW.getTime() + 61 * MIN));
    await runTick(new Date(NOW.getTime() + 90 * MIN));
    expect(sent.filter((s) => s.subject?.startsWith("Comprobante sin verificar"))).toHaveLength(1);
  });
});

describe("Fase 2 — agenda", () => {
  it("no permite horarios superpuestos ni borrar o editar uno reservado", async () => {
    await createSlot({ date: "2026-11-16", time: "09:00", durationMin: 120, modality: "in_person" });
    await expect(createSlot({ date: "2026-11-16", time: "10:00", durationMin: 60, modality: "in_person" })).rejects.toThrow(/superpone/);
    await createSlot({ date: "2026-11-16", time: "11:00", durationMin: 60, modality: "in_person" });
    const { slot } = await bookFuture(1, "15:00", "2026-11-16");
    await expect(deleteSlot(slot.id)).rejects.toThrow(/tiene una reserva/);
    await expect(updateSlot(slot.id, { time: "17:00", durationMin: 60, modality: "in_person" })).rejects.toThrow(/tiene una reserva/);
    await expect(updateSlot("2026-11-16_1100", { time: "10:30", durationMin: 60, modality: "in_person" })).rejects.toThrow(/superpone/);
    const moved = await updateSlot("2026-11-16_1100", { time: "12:00", durationMin: 90, modality: "in_person" });
    expect(moved.id).toBe("2026-11-16_1200");
    expect(await getSlot("2026-11-16_1100")).toBeNull();
    const closed = await closeDay("2026-11-16");
    expect(closed).toEqual({ deleted: 2, kept: 1 });
  });

  it("genera una semana desde la plantilla en una sola acción", async () => {
    const r = await generateRange("2026-11-16", "2026-11-22");
    expect(r.toCreate).toHaveLength(24); // lunes a sábado, 4 horarios
    const again = await generateRange("2026-11-16", "2026-11-22");
    expect(again.toCreate).toHaveLength(0);
    expect(again.skipped).toHaveLength(24);
  });
});
