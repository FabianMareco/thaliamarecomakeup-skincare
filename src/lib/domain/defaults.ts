import type { Service, Tenant, TemplateSlot } from "./types";

// Configuración inicial (sección 6.1) y catálogo (sección 16). Todo es editable
// desde el panel; los valores marcados [CONFIRMAR] en la spec son supuestos.

const weekdaySlots: TemplateSlot[] = [
  { time: "09:00", durationMin: 120, modality: "in_person" },
  { time: "11:00", durationMin: 120, modality: "in_person" },
  { time: "14:00", durationMin: 120, modality: "in_person" },
  { time: "16:00", durationMin: 120, modality: "in_person" },
];

export const DEFAULT_TENANT: Tenant = {
  name: "Thalia Mareco",
  whatsappNumber: "+5491158470009",
  publicZone: "Zona Tribunales, CABA",
  privateAddress: "",
  notificationEmail: "",
  timezone: "America/Argentina/Buenos_Aires",
  bankTransfer: {
    holderName: "Thalia Evelyn Mareco Gimenez",
    alias: "thalia.mareco.makeup",
    cvu: "0000003100049881664215",
    provider: "Mercado Pago",
  },
  skincare: {
    depositAmount: 20000,
    cancellationWindowHours: 48,
    receiptUploadMinutes: 60,
    bookingHorizonDays: 90,
    sameDayRequiresApproval: true,
    sameDayApprovalTimeoutMinutes: 120,
    maxSelfReschedules: 1,
    reminderOffsetsHours: [72, 24],
  },
  makeup: {
    depositPercent: 50,
    receiptUploadHours: 48,
    reminderOffsetsHours: [24],
  },
  verificationReminderMinutes: 60,
  weeklyTemplate: {
    mon: weekdaySlots,
    tue: weekdaySlots,
    wed: weekdaySlots,
    thu: weekdaySlots,
    fri: weekdaySlots,
    sat: weekdaySlots,
    sun: [],
  },
  policies: {
    skincare:
      "Para reservar se abona una seña de $20.000 por transferencia. Si cancelás o reprogramás con 48 hs o más de anticipación, podés elegir el reintegro de la seña o reprogramar. Con menos de 48 hs, la seña no se reintegra. El saldo se abona en el turno. El estudio no tiene sala de espera y los turnos empiezan puntuales.",
    makeup:
      "Para reservar la fecha se abona una seña del 50 % del servicio por transferencia, una vez que Thalia confirma la disponibilidad. La seña no se reintegra. El saldo (y el viático, si es a domicilio) se abona el día del evento.",
  },
};

export const MAKEUP_CATEGORIES = ["Sociales y eventos", "Quinceañeras", "Novias", "Producciones"] as const;

export const MAKEUP_SERVICES_NOTE =
  "El precio final ya incluye pestañas postizas de tira, strass, glitters, etc. Duración aproximada: 1 h 30 a 3 hs según la complejidad. Mismo precio en el estudio o a domicilio; a domicilio se suma viático según distancia.";

type SeedService = Omit<Service, "id" | "active" | "order">;

const sk = (name: string, price: number, durationMin: number, extra: Partial<SeedService> = {}): SeedService => ({
  line: "skincare",
  category: "Tratamientos faciales",
  name,
  price,
  durationMin,
  modality: "in_person",
  ...extra,
});

const mk = (category: string, name: string, price: number, includesTrial = false): SeedService => ({
  line: "makeup",
  category,
  name,
  price,
  modality: "in_person",
  includesTrial,
});

export const SEED_SERVICES: SeedService[] = [
  sk("Limpieza profunda Clásica", 50000, 120, { badge: "Ideal 1ª sesión" }),
  sk("Limpieza profunda + Dermaplaning", 53000, 120),
  sk("Total Glow (Dermaplaning + Peeling)", 55000, 120),
  sk("Limpieza profunda + Dermapen", 57000, 120),
  sk("Limpieza profunda + Dermaplaning + Dermapen", 60000, 120),
  sk("Dermapen Premium con exosomas importados", 75000, 120),
  sk("Tratamiento pieles con acné o engrosadas + punta de diamante", 55000, 120),
  sk("Reparación de barrera para pieles con rosácea", 52000, 120),
  sk("Tratamiento full anti-age + cabina LED", 65000, 120),
  sk("Limpieza profunda + Peeling de invierno", 55000, 120),
  sk("Full hidratación + Glow (ácidos según profesional)", 55000, 120),
  sk("Limpieza profunda Premium (masajes faciales + Hydralips)", 70000, 120),
  sk("Dermapen en labios – Hydralips", 25000, 60),
  sk("Ritual relajante: limpieza suave + masajes faciales", 47000, 120),
  sk("Limpieza profunda de espalda", 53000, 120, { category: "Corporal" }),
  sk("Asesoría virtual + armado de rutina", 35000, 40, { modality: "virtual", category: "Asesoría" }),
  sk("Diseño + perfilado de cejas", 20000, 60, { category: "Cejas y pestañas" }),
  sk("Diseño + perfilado + laminado de cejas", 35000, 60, { category: "Cejas y pestañas" }),
  sk("Lifting de pestañas + nutrición (opcional tinte)", 40000, 60, { category: "Cejas y pestañas" }),

  mk("Sociales y eventos", "Maquillaje o peinado profesional para eventos", 150000),
  mk("Sociales y eventos", "Combo maquillaje + peinado", 240000),
  mk("Quinceañeras", "Maquillaje o peinado para fiesta", 180000),
  mk("Quinceañeras", "Prueba de maquillaje", 120000),
  mk("Quinceañeras", "Prueba de maquillaje + peinado", 220000),
  mk("Quinceañeras", "Combo maquillaje + peinado (día del evento)", 290000),
  mk("Quinceañeras", "Combo completo (pruebas + maquillaje y peinado del evento)", 470000, true),
  mk("Novias", "Maquillaje fiesta", 190000),
  mk("Novias", "Maquillaje civil", 160000),
  mk("Novias", "Prueba de maquillaje", 130000),
  mk("Novias", "Prueba de peinado", 110000),
  mk("Novias", "Prueba de maquillaje + peinado", 230000),
  mk("Novias", "Combo sólo makeup (prueba + makeup)", 280000, true),
  mk("Novias", "Combo maquillaje + peinado", 300000),
  mk("Novias", "Combo pruebas + makeup y peinado", 490000, true),
  mk("Producciones", "Maquillaje profesional para producciones, books, videos", 140000),
  mk("Producciones", "Combo maquillaje + peinado", 220000),
];

/** Id estable a partir de línea, categoría y nombre (el seed es idempotente). */
export function seedServiceId(s: Pick<Service, "line" | "category" | "name">): string {
  const slug = `${s.line}-${s.category}-${s.name}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.slice(0, 120);
}
