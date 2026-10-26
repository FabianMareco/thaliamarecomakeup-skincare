import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { env } from "./env";

// Firebase Admin SDK. Único punto de acceso a Firestore, Auth y Storage.

let app: App | undefined;
let firestore: Firestore | undefined;

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
  if (firestore) return firestore;
  firestore = getFirestore(adminApp());
  firestore.settings({ ignoreUndefinedProperties: true });
  return firestore;
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function bucket() {
  return getStorage(adminApp()).bucket();
}
