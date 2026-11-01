import { Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { tenantRef } from "./db";
import { db } from "./firebase";

// Copia de seguridad manual de todos los datos del tenant (configuración,
// servicios, horarios, reservas, clientas, avisos y comprobantes), sin
// depender del plan Blaze. Se usa desde scripts/backup.ts y scripts/restore.ts.

/** Colecciones que no vale la pena respaldar (datos efímeros). */
const SKIP = new Set(["rateLimits"]);

export type BackupDoc = { path: string; data: unknown };
export type BackupFile = { version: 1; tenantId: string; createdAt: string; docs: BackupDoc[] };

// Fechas y archivos no existen en JSON: se guardan marcados para poder restaurarlos.
function encode(v: unknown): unknown {
  if (v instanceof Timestamp) return { __ts: v.toDate().toISOString() };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __bytes: Buffer.from(v).toString("base64") };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]));
  return v;
}

function decode(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.__ts === "string" && Object.keys(o).length === 1) return Timestamp.fromDate(new Date(o.__ts));
    if (typeof o.__bytes === "string" && Object.keys(o).length === 1) return Buffer.from(o.__bytes, "base64");
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, decode(x)]));
  }
  return v;
}

async function collect(ref: DocumentReference, rootPath: string, out: BackupDoc[]): Promise<void> {
  const snap = await ref.get();
  if (snap.exists) out.push({ path: ref.path.slice(rootPath.length).replace(/^\//, ""), data: encode(snap.data()) });
  for (const col of await ref.listCollections()) {
    if (SKIP.has(col.id)) continue;
    for (const doc of await col.listDocuments()) await collect(doc, rootPath, out);
  }
}

export async function createBackup(tenantId: string): Promise<BackupFile> {
  const root = tenantRef();
  const docs: BackupDoc[] = [];
  await collect(root, root.path, docs);
  return { version: 1, tenantId, createdAt: new Date().toISOString(), docs };
}

/** ¿El tenant ya tiene datos? (para no pisar nada sin querer al restaurar) */
export async function tenantHasData(): Promise<boolean> {
  const root = tenantRef();
  if ((await root.get()).exists) return true;
  return (await root.listCollections()).length > 0;
}

/** Escribe todos los documentos de la copia en el tenant actual. */
export async function restoreBackup(backup: BackupFile): Promise<number> {
  if (backup.version !== 1 || !Array.isArray(backup.docs)) throw new Error("El archivo no es una copia de seguridad válida.");
  const root = tenantRef();
  let batch = db().batch();
  let pending = 0;
  let bytes = 0;
  for (const d of backup.docs) {
    const ref = d.path ? root.firestore.doc(`${root.path}/${d.path}`) : root;
    const data = decode(d.data) as Record<string, unknown>;
    const size = JSON.stringify(d.data).length;
    // Límites de Firestore por escritura en lote: 500 operaciones y ~10 MB.
    if (pending >= 400 || bytes + size > 8_000_000) {
      await batch.commit();
      batch = db().batch();
      pending = 0;
      bytes = 0;
    }
    batch.set(ref, data);
    pending++;
    bytes += size;
  }
  if (pending > 0) await batch.commit();
  return backup.docs.length;
}
