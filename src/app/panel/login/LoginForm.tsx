"use client";

import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { loginAction } from "../actions";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          try {
            const auth = await clientAuth();
            const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
            const r = await loginAction(await cred.user.getIdToken());
            await signOut(auth);
            if (!r.ok) return setError(r.error);
            router.replace("/panel");
            router.refresh();
          } catch {
            setError("Email o contraseña incorrectos.");
          }
        });
      }}
    >
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
