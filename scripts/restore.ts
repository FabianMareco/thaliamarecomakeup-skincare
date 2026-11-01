// Restaura una copia hecha con `npm run backup`.
//   npm run restore -- backups/backup-thalia-2026-11-01_1530.json
// Si la base ya tiene datos, no hace nada salvo que agregues --force: en ese
// caso pisa los documentos que están en la copia (los demás quedan como están).
import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const force = args.includes("--force");
  if (!file) {
    console.error("Uso: npm run restore -- <archivo de backup> [--force]");
    process.exit(1);
  }
  const { restoreBackup, tenantHasData } = await import("../src/server/backup");
  const backup = JSON.parse(readFileSync(file, "utf8"));
  const tenantId = process.env.TENANT_ID || "thalia";
  if (backup.tenantId !== tenantId) {
    console.error(`La copia es del tenant "${backup.tenantId}" y TENANT_ID es "${tenantId}". No se restauró nada.`);
    process.exit(1);
  }
  if ((await tenantHasData()) && !force) {
    console.error(
      `La base del proyecto "${process.env.FIREBASE_PROJECT_ID}" ya tiene datos de "${tenantId}". No se restauró nada.\n` +
        `Si estás segura/o de querer pisarlos con la copia del ${backup.createdAt}, repetí el comando agregando --force.`,
    );
    process.exit(1);
  }
  const n = await restoreBackup(backup);
  console.log(`Listo: se restauraron ${n} documentos de la copia del ${backup.createdAt}.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
