"use client";

import { useState } from "react";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { Feedback, useAction } from "../../_components/actions";
import { saveConfigAction, type ConfigInput } from "../../actions";

type Config = {
  name: string;
  whatsappNumber: string;
  publicZone: string;
  privateAddress: string;
  notificationEmail: string;
  bankTransfer: { holderName: string; alias: string; cvu: string; provider: string };
  skincare: {
    depositAmount: number;
    cancellationWindowHours: number;
    receiptUploadMinutes: number;
    bookingHorizonDays: number;
    sameDayRequiresApproval: boolean;
    sameDayApprovalTimeoutMinutes: number;
    maxSelfReschedules: number;
    reminderOffsetsHours: number[];
  };
  makeup: { depositPercent: number; receiptUploadHours: number; reminderOffsetsHours: number[] };
  verificationReminderMinutes: number;
  policies: { skincare: string; makeup: string };
};

const parseList = (s: string) =>
  s
    .split(/[,\s]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0);

export function ConfigForm({ initial }: { initial: Config }) {
  const { pending, error, done, run } = useAction();
  const [c, setC] = useState(initial);
  const [skOffsets, setSkOffsets] = useState(initial.skincare.reminderOffsetsHours.join(", "));
  const [mkOffsets, setMkOffsets] = useState(initial.makeup.reminderOffsetsHours.join(", "));

  const top = (k: "name" | "whatsappNumber" | "publicZone" | "privateAddress" | "notificationEmail") => ({
    value: c[k],
    onChange: (e: { target: { value: string } }) => setC({ ...c, [k]: e.target.value }),
  });
  const bank = (k: keyof Config["bankTransfer"]) => ({
    value: c.bankTransfer[k],
    onChange: (e: { target: { value: string } }) => setC({ ...c, bankTransfer: { ...c.bankTransfer, [k]: e.target.value } }),
  });
  const sk = (k: Exclude<keyof Config["skincare"], "reminderOffsetsHours" | "sameDayRequiresApproval">) => ({
    type: "number",
    inputMode: "numeric" as const,
    value: String(c.skincare[k]),
    onChange: (e: { target: { value: string } }) => setC({ ...c, skincare: { ...c.skincare, [k]: Number(e.target.value) } }),
  });
  const mk = (k: "depositPercent" | "receiptUploadHours") => ({
    type: "number",
    inputMode: "numeric" as const,
    value: String(c.makeup[k]),
    onChange: (e: { target: { value: string } }) => setC({ ...c, makeup: { ...c.makeup, [k]: Number(e.target.value) } }),
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const input: ConfigInput = {
          ...c,
          skincare: { ...c.skincare, reminderOffsetsHours: parseList(skOffsets) },
          makeup: { ...c.makeup, reminderOffsetsHours: parseList(mkOffsets) },
        };
        run(() => saveConfigAction(input), "Configuración guardada");
      }}
    >
      <Card className="space-y-3">
        <h2 className="font-medium">Datos para transferir la seña</h2>
        <Field label="Titular" htmlFor="c-holder">
          <Input id="c-holder" {...bank("holderName")} />
        </Field>
        <Field label="Alias" htmlFor="c-alias">
          <Input id="c-alias" {...bank("alias")} />
        </Field>
        <Field label="CVU / CBU" htmlFor="c-cvu">
          <Input id="c-cvu" inputMode="numeric" {...bank("cvu")} />
        </Field>
        <Field label="Banco o billetera" htmlFor="c-prov">
          <Input id="c-prov" {...bank("provider")} />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium">Datos del estudio</h2>
        <Field label="Nombre" htmlFor="c-name">
          <Input id="c-name" {...top("name")} />
        </Field>
        <Field label="WhatsApp" htmlFor="c-wa" hint="Formato +5491158470009">
          <Input id="c-wa" {...top("whatsappNumber")} />
        </Field>
        <Field label="Zona (se muestra en la web)" htmlFor="c-zone">
          <Input id="c-zone" {...top("publicZone")} />
        </Field>
        <Field label="Dirección exacta (solo en confirmaciones y recordatorios)" htmlFor="c-addr">
          <Input id="c-addr" {...top("privateAddress")} />
        </Field>
        <Field label="Email para tus avisos" htmlFor="c-mail">
          <Input id="c-mail" type="email" {...top("notificationEmail")} />
        </Field>
        <Field label="Re-avisarme de un comprobante sin verificar después de (min)" htmlFor="c-verif">
          <Input
            id="c-verif"
            type="number"
            inputMode="numeric"
            value={String(c.verificationReminderMinutes)}
            onChange={(e) => setC({ ...c, verificationReminderMinutes: Number(e.target.value) })}
          />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium">Skincare</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seña ($)" htmlFor="sk-dep">
            <Input id="sk-dep" {...sk("depositAmount")} />
          </Field>
          <Field label="Ventana de cancelación (hs)" htmlFor="sk-win">
            <Input id="sk-win" {...sk("cancellationWindowHours")} />
          </Field>
          <Field label="Plazo para el comprobante (min)" htmlFor="sk-up">
            <Input id="sk-up" {...sk("receiptUploadMinutes")} />
          </Field>
          <Field label="Reservas hasta (días)" htmlFor="sk-hor">
            <Input id="sk-hor" {...sk("bookingHorizonDays")} />
          </Field>
          <Field label="Plazo para aprobar las del día (min)" htmlFor="sk-sd">
            <Input id="sk-sd" {...sk("sameDayApprovalTimeoutMinutes")} />
          </Field>
          <Field label="Reprogramaciones online" htmlFor="sk-res">
            <Input id="sk-res" {...sk("maxSelfReschedules")} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={c.skincare.sameDayRequiresApproval}
            onChange={(e) => setC({ ...c, skincare: { ...c.skincare, sameDayRequiresApproval: e.target.checked } })}
          />
          Las reservas para el mismo día necesitan mi aprobación
        </label>
        <Field label="Recordatorios (horas antes, separadas por coma)" htmlFor="sk-rem">
          <Input id="sk-rem" value={skOffsets} onChange={(e) => setSkOffsets(e.target.value)} />
        </Field>
        <Field label="Política (texto visible)" htmlFor="sk-pol">
          <Textarea id="sk-pol" rows={5} value={c.policies.skincare} onChange={(e) => setC({ ...c, policies: { ...c.policies, skincare: e.target.value } })} />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium">Maquillaje</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seña (%)" htmlFor="mk-dep">
            <Input id="mk-dep" {...mk("depositPercent")} />
          </Field>
          <Field label="Plazo para el comprobante (hs)" htmlFor="mk-up">
            <Input id="mk-up" {...mk("receiptUploadHours")} />
          </Field>
        </div>
        <Field label="Recordatorios (horas antes, separadas por coma)" htmlFor="mk-rem">
          <Input id="mk-rem" value={mkOffsets} onChange={(e) => setMkOffsets(e.target.value)} />
        </Field>
        <Field label="Política (texto visible)" htmlFor="mk-pol">
          <Textarea id="mk-pol" rows={4} value={c.policies.makeup} onChange={(e) => setC({ ...c, policies: { ...c.policies, makeup: e.target.value } })} />
        </Field>
      </Card>

      <Feedback error={error} done={done} />
      <Button type="submit" className="sticky bottom-20 w-full md:bottom-4" disabled={pending}>
        {pending ? "Guardando…" : "Guardar configuración"}
      </Button>
    </form>
  );
}
