import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Firebase Auth en el navegador (solo el login del panel): habla con las APIs de
// Google y carga un iframe del authDomain. En local puede usar el emulador.
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
const authEmulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST?.trim();
const firebaseConnect = [
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://www.googleapis.com",
  ...(authEmulator ? [`http://${authEmulator}`] : []),
];

// Política completa, según la guía de CSP de Next.js ("Without Nonces").
// Va primero en modo report-only: avisa en la consola del navegador sin bloquear,
// para confirmar en producción que el login no se rompe antes de hacerla obligatoria.
const fullCsp = [
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

// Lo que no puede romper nada se aplica ya: sin iframes de terceros que nos
// enmarquen, sin plugins, sin <base> ajeno y formularios solo hacia el propio sitio.
const enforcedCsp = ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: enforcedCsp },
  { key: "Content-Security-Policy-Report-Only", value: fullCsp },
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

export default nextConfig;
