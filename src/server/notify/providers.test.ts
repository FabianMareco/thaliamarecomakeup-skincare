import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone } from "./providers";

describe("enmascarado para logs", () => {
  it("no deja el email completo", () => {
    expect(maskEmail("lucia.fernandez@gmail.com")).toBe("l***@gmail.com");
    expect(maskEmail("sin-arroba")).toBe("***");
  });
  it("deja solo los últimos 4 dígitos del teléfono", () => {
    expect(maskPhone("+54 9 11 6123-4567")).toBe("***4567");
    expect(maskPhone("123")).toBe("***");
  });
});
