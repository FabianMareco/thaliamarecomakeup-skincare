import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
