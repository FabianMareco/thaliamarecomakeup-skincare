import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubEvent, scrubText } from "./sentry-scrub";

describe("limpieza de eventos de Sentry", () => {
  it("enmascara emails y teléfonos", () => {
    expect(scrubText("falló el envío a lucia@gmail.com (+54 9 11 6123-4567)")).toBe("falló el envío a [email] ([teléfono])");
  });
  it("no toca horarios ni códigos de reserva", () => {
    expect(scrubText("TM-4821 el 12/11 a las 09:00")).toBe("TM-4821 el 12/11 a las 09:00");
  });
  it("quita usuario, cookies y cabeceras", () => {
    const e = scrubEvent({
      type: undefined,
      message: "x",
      user: { ip_address: "1.2.3.4" },
      request: { url: "https://x/turnos", cookies: { __session: "s" }, headers: { cookie: "c" } },
      exception: { values: [{ value: "Error con 1155558888" }] },
    } as ErrorEvent)!;
    expect(e.user).toBeUndefined();
    expect(e.request?.cookies).toBeUndefined();
    expect(e.request?.headers).toBeUndefined();
    expect(e.exception?.values?.[0].value).toBe("Error con [teléfono]");
  });
});
