import { z } from "zod";
import { isValidDateStr, isValidTimeStr } from "./domain/time";

// Validación de entradas públicas y del panel.

const trimmed = (max: number) => z.string().trim().max(max);
const dateStr = z.string().refine(isValidDateStr, "Fecha inválida");
const timeStr = z.string().refine(isValidTimeStr, "Hora inválida");

export const clientDataSchema = z.object({
  name: trimmed(80).min(2, "Ingresá tu nombre y apellido"),
  phone: trimmed(30).min(6, "Ingresá tu WhatsApp"),
  email: trimmed(120).toLowerCase().pipe(z.email("Ingresá un email válido")),
});

export const skincareBookingSchema = clientDataSchema.extend({
  serviceId: z.string().min(1).max(150),
  slotId: z.string().regex(/^\d{4}-\d{2}-\d{2}_\d{4}$/, "Horario inválido"),
  firstVisit: z.boolean(),
  acceptPolicies: z.literal(true, "Tenés que aceptar las políticas"),
  website: z.string().max(0).optional(), // honeypot
});
export type SkincareBookingInput = z.input<typeof skincareBookingSchema>;

export const makeupRequestSchema = clientDataSchema
  .extend({
    serviceId: z.string().min(1).max(150),
    eventDate: dateStr,
    readyByTime: timeStr,
    location: z.enum(["studio", "home"]),
    homeAddress: trimmed(200).optional(),
    peopleCount: z.coerce.number().int().min(1, "Mínimo 1 persona").max(30, "Para más de 30 personas escribinos por WhatsApp"),
    comments: trimmed(1000).optional(),
    preferredTrialDate: z.union([dateStr, z.literal("")]).optional(),
    acceptPolicies: z.literal(true, "Tenés que aceptar las políticas"),
    website: z.string().max(0).optional(), // honeypot
  })
  .refine((d) => d.location !== "home" || (d.homeAddress && d.homeAddress.length >= 3), {
    message: "Indicá la dirección o el barrio",
    path: ["homeAddress"],
  });
export type MakeupRequestInput = z.input<typeof makeupRequestSchema>;

export const acceptMakeupSchema = z.object({
  finalPrice: z.coerce.number().int().min(0),
  travelFee: z.coerce.number().int().min(0).default(0),
  startTime: timeStr,
  trialDate: z.union([dateStr, z.literal("")]).optional(),
  trialTime: z.union([timeStr, z.literal("")]).optional(),
  force: z.boolean().default(false),
});
export type AcceptMakeupInput = z.input<typeof acceptMakeupSchema>;

export const refundDestinationSchema = trimmed(80).min(6, "Ingresá un alias o CBU/CVU válido");

export const payerNameSchema = trimmed(80).min(2, "Ingresá el nombre del titular de la cuenta");

export function firstError(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Datos inválidos";
}
