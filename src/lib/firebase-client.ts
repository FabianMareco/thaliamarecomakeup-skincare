"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";

// Firebase Auth en el navegador: solo se usa para iniciar sesión en el panel.
// La sesión real es la cookie del servidor, así que no se persiste nada acá.

let auth: Auth | undefined;

export async function clientAuth(): Promise<Auth> {
  if (auth) return auth;
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
  auth = getAuth(app);
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulator) connectAuthEmulator(auth, `http://${emulator}`, { disableWarnings: true });
  await setPersistence(auth, inMemoryPersistence);
  return auth;
}
