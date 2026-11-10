import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { env } from "./env";

// Firebase Admin SDK. Único punto de acceso a Firestore, Auth y Storage.

let app: App | undefined;

// Next puede cargar este módulo en más de un bundle del servidor; la instancia
// de Firestore (y su configuración, que solo se puede fijar una vez) se
// comparte por proceso.
const g = globalThis as typeof globalThis & { __thaliaFirestore?: Firestore };

function adminApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) return (app = existing);
  const projectId = env.firebaseProjectId;
  const clientEmail = env.firebaseClientEmail;
  const privateKey = env.firebasePrivateKey;
  app = initializeApp({
    ...(clientEmail && privateKey ? { credential: cert({ projectId, clientEmail, privateKey }) } : {}),
    projectId,
    storageBucket: env.storageBucket,
  });
  return app;
}

export function db(): Firestore {
  if (g.__thaliaFirestore) return g.__thaliaFirestore;
  const firestore = getFirestore(adminApp());
  firestore.settings({ ignoreUndefinedProperties: true });
  g.__thaliaFirestore = firestore;
  return firestore;
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function bucket() {
  return getStorage(adminApp()).bucket();
}
