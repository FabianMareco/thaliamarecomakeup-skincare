import * as Sentry from "@sentry/nextjs";
import { privateDataCollection, scrubEvent } from "@/lib/sentry-scrub";

// Monitoreo de errores en el navegador. Los eventos viajan por el propio dominio
// (tunnel), así la CSP no necesita permitir dominios de Sentry.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    tunnel: true,
    dataCollection: privateDataCollection,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
