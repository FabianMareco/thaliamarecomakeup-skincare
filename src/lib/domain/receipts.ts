// Validación de comprobantes: tipo real por "magic bytes", no por extensión.

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export type ReceiptKind = { contentType: string; ext: string };

export function sniffReceiptType(bytes: Uint8Array): ReceiptKind | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { contentType: "image/jpeg", ext: "jpg" };
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  )
    return { contentType: "image/png", ext: "png" };
  if (
    b.length >= 12 &&
    ascii(b, 0, 4) === "RIFF" &&
    ascii(b, 8, 12) === "WEBP"
  )
    return { contentType: "image/webp", ext: "webp" };
  if (b.length >= 5 && ascii(b, 0, 5) === "%PDF-") return { contentType: "application/pdf", ext: "pdf" };
  return null;
}

function ascii(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.subarray(from, to));
}

export type ReceiptValidation = { ok: true; kind: ReceiptKind } | { ok: false; error: string };

export function validateReceipt(bytes: Uint8Array): ReceiptValidation {
  if (bytes.length === 0) return { ok: false, error: "El archivo está vacío." };
  if (bytes.length > MAX_RECEIPT_BYTES) return { ok: false, error: "El archivo supera los 5 MB." };
  const kind = sniffReceiptType(bytes);
  if (!kind) return { ok: false, error: "El comprobante tiene que ser una imagen (JPG, PNG o WEBP) o un PDF." };
  return { ok: true, kind };
}
