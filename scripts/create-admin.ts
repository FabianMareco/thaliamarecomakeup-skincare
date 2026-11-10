// Crea (o actualiza la contraseña de) una usuaria del panel y muestra su UID,
// que hay que agregar a ADMIN_UIDS.
//   npm run create-admin -- thalia@ejemplo.com 'contraseña-segura'
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.error("Uso: npm run create-admin -- <email> <contraseña de 8+ caracteres>");
    process.exit(1);
  }
  const { adminAuth } = await import("../src/server/firebase");
  const auth = adminAuth();
  const existing = await auth.getUserByEmail(email).catch(() => null);
  const user = existing
    ? await auth.updateUser(existing.uid, { password })
    : await auth.createUser({ email, password, emailVerified: true });
  console.log(`${existing ? "Actualizada" : "Creada"}: ${user.email}\nUID: ${user.uid}\nAgregalo a ADMIN_UIDS.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
