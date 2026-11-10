import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { env } from "./env";
import { UserError } from "./errors";
import { adminAuth } from "./firebase";

// Autenticación del panel: cookie de sesión de Firebase verificada en el
// servidor, y solo para los UIDs de ADMIN_UIDS.

export const SESSION_COOKIE = "__session";
const SESSION_DAYS = 5;

export type AdminUser = { uid: string; email?: string };

export function isAllowedUid(uid: string): boolean {
  return env.adminUids.includes(uid);
}

/** Cambia un ID token recién emitido por una cookie de sesión. */
export async function createSession(idToken: string): Promise<void> {
  const decoded = await adminAuth().verifyIdToken(idToken, true).catch(() => null);
  if (!decoded) throw new UserError("No se pudo verificar el inicio de sesión.");
  if (!isAllowedUid(decoded.uid)) throw new UserError("Esta cuenta no tiene acceso al panel.");
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) throw new UserError("Volvé a iniciar sesión.");
  const expiresIn = SESSION_DAYS * 24 * 3600 * 1000;
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn });
  (await cookies()).set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  jar.delete(SESSION_COOKIE);
  if (cookie) {
    const decoded = await adminAuth().verifySessionCookie(cookie).catch(() => null);
    if (decoded) await adminAuth().revokeRefreshTokens(decoded.sub).catch(() => undefined);
  }
}

export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  const decoded = await adminAuth().verifySessionCookie(cookie, true).catch(() => null);
  if (!decoded || !isAllowedUid(decoded.uid)) return null;
  return { uid: decoded.uid, email: decoded.email };
});

/** Para páginas del panel: redirige al login si no hay sesión válida. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/panel/login");
  return admin;
}

/** Para acciones del panel: falla si no hay sesión válida. */
export async function assertAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw new UserError("Tu sesión venció. Volvé a iniciar sesión.");
  return admin;
}
