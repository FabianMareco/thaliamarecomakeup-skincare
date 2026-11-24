import * as Sentry from "@sentry/nextjs";

/**
 * Evento de seguridad (acceso rechazado al panel, límite superado). Queda en los logs
 * y, si Sentry está configurado, como aviso para poder ponerle una alerta.
 * Nunca incluir datos personales (IP, email, teléfono) en el texto.
 */
export function securityEvent(message: string): void {
  console.warn(`[seguridad] ${message}`);
  Sentry.captureMessage(message, "warning");
}
