// Variables de entorno del servidor (sección 15). Se leen en cada acceso para
// que los tests puedan ajustarlas.

function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const env = {
  get tenantId() {
    return opt("TENANT_ID") ?? "thalia";
  },
  get baseUrl() {
    return (opt("BASE_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get adminUids(): string[] {
    return (opt("ADMIN_UIDS") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  get firebaseProjectId() {
    return opt("FIREBASE_PROJECT_ID");
  },
  get firebaseClientEmail() {
    return opt("FIREBASE_CLIENT_EMAIL");
  },
  get firebasePrivateKey() {
    return opt("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  },
  get storageBucket() {
    return opt("FIREBASE_STORAGE_BUCKET");
  },
  get resendApiKey() {
    return opt("RESEND_API_KEY");
  },
  get emailFrom() {
    return opt("EMAIL_FROM") ?? "turnos@thaliamarecomakeup.com.ar";
  },
  get whatsappMode(): "disabled" | "cloud_api" {
    return opt("WHATSAPP_MODE") === "cloud_api" ? "cloud_api" : "disabled";
  },
  get whatsappPhoneNumberId() {
    return opt("WHATSAPP_PHONE_NUMBER_ID");
  },
  get whatsappAccessToken() {
    return opt("WHATSAPP_ACCESS_TOKEN");
  },
  get cronSecret() {
    return opt("CRON_SECRET");
  },
  get usingEmulators() {
    return !!opt("FIRESTORE_EMULATOR_HOST");
  },
};
