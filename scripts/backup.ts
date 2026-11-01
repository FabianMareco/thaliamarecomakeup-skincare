// Descarga una copia de seguridad de todos los datos a la carpeta backups/.
//   npm run backup
// Guardá el archivo generado en un lugar seguro (Google Drive, disco externo).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { createBackup } = await import("../src/server/backup");
  const { arDateStr, arTimeStr } = await import("../src/lib/domain/time");
  const tenantId = process.env.TENANT_ID || "thalia";
  const backup = await createBackup(tenantId);
  const created = new Date(backup.createdAt);
  const stamp = `${arDateStr(created)}_${arTimeStr(created).replace(":", "")}`; // hora argentina
  mkdirSync("backups", { recursive: true });
  const file = join("backups", `backup-${tenantId}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(backup));
  const count = (prefix: string) => backup.docs.filter((d) => d.path.startsWith(prefix + "/")).length;
  console.log(
    `Copia guardada en ${file}\n` +
      `  reservas: ${count("bookings")} · clientas: ${count("clients")} · horarios: ${count("slots")} · ` +
      `servicios: ${count("services")} · comprobantes: ${backup.docs.filter((d) => /^receiptFiles\/[^/]+$/.test(d.path)).length}\n` +
      `Contiene datos personales de las clientas: guardala en un lugar privado.`,
  );
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
