import { env } from "./env";
import { cols } from "./db";
import { bucket, db } from "./firebase";

// Dónde se guardan los archivos de los comprobantes. Hay dos opciones,
// elegidas con RECEIPT_STORAGE para los archivos nuevos:
//  - "firestore" (por defecto): el archivo se guarda en Firestore, partido en
//    pedazos de menos de 1 MB. Funciona en el plan gratis (Spark).
//  - "storage": Firebase Storage (requiere plan Blaze).
// Cada comprobante guarda una referencia que indica dónde está, así que al
// cambiar de opción los comprobantes anteriores se siguen pudiendo ver.

const FIRESTORE_PREFIX = "firestore:";
const CHUNK_BYTES = 900_000; // límite de un documento de Firestore: 1 MiB

type SaveInput = { bookingId: string; bytes: Uint8Array; contentType: string; ext: string; now: Date };

interface ReceiptStore {
  save(input: SaveInput): Promise<string>;
  read(ref: string): Promise<Uint8Array>;
  delete(ref: string): Promise<void>;
  /** URL temporal para ver el archivo, si este medio la ofrece. */
  signedUrl(ref: string): Promise<string | null>;
}

const firestoreStore: ReceiptStore = {
  async save({ bookingId, bytes, contentType, now }) {
    const fileRef = cols.receiptFiles().doc();
    const chunks = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
    const batch = db().batch();
    batch.set(fileRef, { bookingId, contentType, size: bytes.length, chunks, createdAt: now });
    for (let i = 0; i < chunks; i++) {
      const part = bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
      batch.set(fileRef.collection("chunks").doc(String(i)), { data: Buffer.from(part) });
    }
    await batch.commit();
    return `${FIRESTORE_PREFIX}${fileRef.id}`;
  },
  async read(ref) {
    const fileRef = cols.receiptFiles().doc(ref.slice(FIRESTORE_PREFIX.length));
    const meta = await fileRef.get();
    if (!meta.exists) throw new Error(`Comprobante inexistente: ${ref}`);
    const n = meta.get("chunks") as number;
    const parts = await Promise.all(
      Array.from({ length: n }, (_, i) => fileRef.collection("chunks").doc(String(i)).get()),
    );
    return new Uint8Array(Buffer.concat(parts.map((p) => p.get("data") as Buffer)));
  },
  async delete(ref) {
    const fileRef = cols.receiptFiles().doc(ref.slice(FIRESTORE_PREFIX.length));
    const chunks = await fileRef.collection("chunks").listDocuments();
    const batch = db().batch();
    for (const c of chunks) batch.delete(c);
    batch.delete(fileRef);
    await batch.commit();
  },
  async signedUrl() {
    return null;
  },
};

const storageStore: ReceiptStore = {
  async save({ bookingId, bytes, contentType, ext, now }) {
    const path = `receipts/${env.tenantId}/${bookingId}/${now.getTime()}.${ext}`;
    await bucket().file(path).save(Buffer.from(bytes), {
      contentType,
      resumable: false,
      metadata: { cacheControl: "private, no-store" },
    });
    return path;
  },
  async read(ref) {
    const [bytes] = await bucket().file(ref).download();
    return new Uint8Array(bytes);
  },
  async delete(ref) {
    await bucket().file(ref).delete({ ignoreNotFound: true });
  },
  async signedUrl(ref) {
    if (env.usingEmulators) return null; // el emulador no firma URLs
    try {
      const [url] = await bucket().file(ref).getSignedUrl({ action: "read", expires: Date.now() + 5 * 60_000, version: "v4" });
      return url;
    } catch (e) {
      console.error("[receipts] no se pudo firmar la URL", e);
      return null;
    }
  },
};

function storeFor(ref: string): ReceiptStore {
  return ref.startsWith(FIRESTORE_PREFIX) ? firestoreStore : storageStore;
}

export function saveReceipt(input: SaveInput): Promise<string> {
  return (env.receiptStorage === "storage" ? storageStore : firestoreStore).save(input);
}

export const readReceipt = (ref: string) => storeFor(ref).read(ref);
export const deleteReceipt = (ref: string) => storeFor(ref).delete(ref);
export const receiptSignedUrl = (ref: string) => storeFor(ref).signedUrl(ref);
