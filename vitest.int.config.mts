import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests de integración: corren contra los emuladores de Firebase
// (npm run test:int los levanta con `firebase emulators:exec`).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    env: {
      TENANT_ID: "test",
      FIREBASE_PROJECT_ID: "demo-thalia",
      FIREBASE_STORAGE_BUCKET: "demo-thalia.appspot.com",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
      BASE_URL: "http://localhost:3000",
      ADMIN_UIDS: "admin-1",
      CRON_SECRET: "test-secret",
      WHATSAPP_MODE: "disabled",
    },
  },
});
