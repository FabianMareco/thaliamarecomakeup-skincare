"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";

const MAX_BYTES = 5 * 1024 * 1024;
// Límite práctico del cuerpo de una request en el hosting (Vercel: 4,5 MB).
const UPLOAD_TARGET = 4 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** Achica una imagen grande (por ejemplo, una foto del celular) antes de subirla. */
async function shrinkImage(file: File): Promise<Blob> {
  if (file.size <= UPLOAD_TARGET || !file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
}

export function ReceiptForm({ token }: { token: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [payerName, setPayerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4 rounded-2xl border border-line bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!file) return setError("Elegí el archivo del comprobante.");
        if (file.size > MAX_BYTES && !file.type.startsWith("image/")) return setError("El archivo supera los 5 MB.");
        start(async () => {
          try {
            const body = new FormData();
            body.set("token", token);
            body.set("payerName", payerName);
            const blob = await shrinkImage(file);
            body.set("file", blob, file.name);
            const res = await fetch("/api/turnos/comprobante", { method: "POST", body });
            const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
            if (!res.ok || !json.ok) {
              setError(json.error ?? (res.status === 413 ? "El archivo es demasiado grande." : "No se pudo subir el comprobante. Probá de nuevo."));
              return;
            }
            router.refresh();
          } catch {
            setError("No se pudo subir el comprobante. Revisá tu conexión y probá de nuevo.");
          }
        });
      }}
    >
      <h2 className="font-display text-xl">Subí el comprobante</h2>
      <Field label="Comprobante (JPG, PNG, WEBP o PDF, hasta 5 MB)" htmlFor="file">
        <input
          id="file"
          type="file"
          accept={ACCEPT}
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-accent"
        />
      </Field>
      <Field
        label="Nombre del titular de la cuenta desde la que transferiste"
        htmlFor="payerName"
        hint="Ayuda a Thalia a encontrar tu transferencia."
      >
        <Input id="payerName" required value={payerName} onChange={(e) => setPayerName(e.target.value)} autoComplete="name" />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Subiendo…" : "Enviar comprobante"}
      </Button>
    </form>
  );
}
