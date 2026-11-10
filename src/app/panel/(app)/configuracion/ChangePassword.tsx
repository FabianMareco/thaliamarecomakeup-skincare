"use client";

import { signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { loginAction } from "../../actions";

const MIN_LENGTH = 8;

/** Mensaje en castellano para los errores de Firebase Auth más comunes. */
function authError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
    return "La contraseña actual no es correcta.";
  }
  if (code === "auth/weak-password") return `La contraseña nueva es muy débil: usá al menos ${MIN_LENGTH} caracteres.`;
  if (code === "auth/too-many-requests") return "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
  if (code === "auth/network-request-failed") return "No hay conexión. Revisá internet y probá de nuevo.";
  return "No se pudo cambiar la contraseña. Probá de nuevo.";
}

/**
 * Cambio de contraseña del panel. Firebase pide haber iniciado sesión hace
 * poco, así que primero se confirma la contraseña actual; después del cambio
 * se renueva la cookie de sesión para que Thalia siga adentro.
 */
export function ChangePassword({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = repeat.length > 0 && next !== repeat;
  const canSubmit = current && next.length >= MIN_LENGTH && next === repeat && next !== current;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setError(null);
        setDone(false);
        start(async () => {
          const auth = await clientAuth();
          try {
            const cred = await signInWithEmailAndPassword(auth, email, current);
            await updatePassword(cred.user, next);
            // Cambiar la contraseña invalida las sesiones anteriores: se crea una nueva.
            const r = await loginAction(await cred.user.getIdToken(true));
            if (!r.ok) throw Object.assign(new Error(r.error), { code: "session" });
            setDone(true);
            setCurrent("");
            setNext("");
            setRepeat("");
          } catch (err) {
            setError((err as { code?: string }).code === "session" ? "La contraseña cambió, pero tenés que volver a iniciar sesión." : authError(err));
          } finally {
            await signOut(auth).catch(() => undefined);
          }
        });
      }}
    >
      <p className="text-sm text-muted">
        Entrás al panel con <strong className="text-ink">{email}</strong>.
      </p>
      <Field label="Contraseña actual" htmlFor="pw-current">
        <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="Contraseña nueva" htmlFor="pw-new" hint={`Al menos ${MIN_LENGTH} caracteres.`} error={tooShort ? `Usá al menos ${MIN_LENGTH} caracteres.` : undefined}>
        <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="Repetí la contraseña nueva" htmlFor="pw-repeat" error={mismatch ? "No coincide con la contraseña nueva." : undefined}>
        <Input id="pw-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      {done && <Alert tone="ok">¡Listo! Tu contraseña se cambió. La próxima vez entrá con la nueva.</Alert>}
      <Button type="submit" className="w-full" disabled={pending || !canSubmit}>
        {pending ? "Cambiando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
