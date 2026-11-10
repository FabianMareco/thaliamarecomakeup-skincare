// Carga la configuración inicial del tenant y el catálogo de servicios.
//   npm run seed                 → crea lo que falte
//   npm run seed -- --overwrite  → pisa configuración y servicios con los valores por defecto
// Lee las variables de .env.local (o del entorno).
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { seed } = await import("../src/server/seed");
  const overwrite = process.argv.includes("--overwrite");
  const result = await seed({
    overwrite,
    tenant: {
      ...(process.env.SEED_PRIVATE_ADDRESS ? { privateAddress: process.env.SEED_PRIVATE_ADDRESS } : {}),
      ...(process.env.SEED_NOTIFICATION_EMAIL ? { notificationEmail: process.env.SEED_NOTIFICATION_EMAIL } : {}),
    },
  });
  console.log(
    `Tenant "${process.env.TENANT_ID ?? "thalia"}": ${result.tenantWritten ? "configuración cargada" : "configuración existente (sin cambios)"}. ` +
      `Servicios creados: ${result.servicesCreated} de ${result.servicesTotal}.`,
  );
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
