import type { ErrorEvent } from "@sentry/nextjs";

// Antes de mandar un evento a Sentry: nada de emails ni teléfonos de pacientes,
// ni cookies, cabeceras o IP de quien navega.

/**
 * Qué junta el SDK (en la v11 casi todo viene activado por defecto). Apagamos lo que
 * podría llevar datos de pacientes: usuario, cookies, cabeceras, cuerpos de pedidos,
 * parámetros de la URL, datos de consultas y los valores de las variables locales.
 */
export const privateDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 0,
};

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /\+?\d[\d\s-]{7,}\d/g;

export function scrubText(s: string): string {
  return s.replace(EMAIL, "[email]").replace(PHONE, "[teléfono]");
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.message) event.message = scrubText(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value);
  }
  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = scrubText(b.message);
    if (b.data) delete b.data;
  }
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    if (event.request.url) event.request.url = scrubText(event.request.url);
  }
  delete event.user;
  return event;
}
