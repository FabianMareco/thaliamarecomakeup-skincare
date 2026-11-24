import { NextResponse } from "next/server";
import { MAX_RECEIPT_BYTES } from "@/lib/domain/receipts";
import { toResult, UserError } from "@/server/errors";
import { uploadReceipt } from "@/server/flows/receipts";
import { clientIp, rateLimit, RateLimitError } from "@/server/rateLimit";

// Carga del comprobante (sección 10.1). El archivo pasa por el servidor, que
// valida su tipo real y lo guarda en el bucket privado.
export async function POST(req: Request) {
  const result = await toResult(async () => {
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_RECEIPT_BYTES + 64 * 1024) throw new UserError("El archivo supera los 5 MB.");
    const ip = await clientIp();
    await rateLimit(`receipt:${ip}`, 10, 3600);
    const form = await req.formData().catch(() => null);
    const token = form?.get("token");
    const payerName = form?.get("payerName");
    const file = form?.get("file");
    if (typeof token !== "string" || typeof payerName !== "string" || !(file instanceof Blob)) {
      throw new UserError("Faltan datos del comprobante.");
    }
    await rateLimit(`receipt-token:${token}`, 6, 3600);
    if (file.size > MAX_RECEIPT_BYTES) throw new UserError("El archivo supera los 5 MB.");
    await uploadReceipt(token, new Uint8Array(await file.arrayBuffer()), payerName);
    return undefined;
  });
  // 429 cuando se superó el límite de intentos, para que se distinga en los logs.
  const limited = !result.ok && result.error === new RateLimitError().message;
  return NextResponse.json(result, { status: result.ok ? 200 : limited ? 429 : 400 });
}
