import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Firebase Auth en el navegador (solo el login del panel): habla con las APIs de
// Google y carga un iframe del authDomain. En local puede usar el emulador.
// Se limpia el valor (comillas, <>, espacios) y solo se usa si es un dominio válido:
// un error de tipeo en la variable de Vercel no debe romper la cabecera.
const rawAuthDomain = (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "").replace(/[<>"'\s]/g, "");
const authDomain = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(rawAuthDomain) ? rawAuthDomain : undefined;
const authEmulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST?.trim();
const firebaseConnect = [
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://www.googleapis.com",
  ...(authEmulator ? [`http://${authEmulator}`] : []),
];

// Política según la guía de CSP de Next.js ("Without Nonces"). Estuvo en
// report-only y se confirmó en producción que el login no genera avisos (24/11/2026).
// Los avisos de Sentry del navegador van por el propio dominio (tunnel), así que
// alcanza con connect-src 'self'.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://apis.google.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${firebaseConnect.join(" ")}`,
  `frame-src 'self'${authDomain ? ` https://${authDomain}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["firebase-admin"],
  // Las imágenes del panel leen las fuentes desde assets/fonts en tiempo de ejecución.
  outputFileTracingIncludes: {
    "/api/panel/imagen/*": ["./assets/fonts/*.woff"],
  },
};

// Sentry: sin subir source maps (no hay token) y sin generarlos públicos.
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
});
