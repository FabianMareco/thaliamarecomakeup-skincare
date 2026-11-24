import * as Sentry from "@sentry/nextjs";
import { privateDataCollection, scrubEvent } from "@/lib/sentry-scrub";

// Monitoreo de errores del servidor con Sentry. Sin NEXT_PUBLIC_SENTRY_DSN no se activa.
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    dataCollection: privateDataCollection,
    tracesSampleRate: 0,
    // Recibe en el propio dominio los avisos del navegador (tunnel: true) y los reenvía a Sentry.
    integrations: [Sentry.serveTunnelIntegration()],
    beforeSend: scrubEvent,
  });
}

export const onRequestError = Sentry.captureRequestError;
