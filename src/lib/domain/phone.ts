/**
 * Normaliza un teléfono a E.164. Pensado para celulares argentinos
 * ("11 5847-0009", "011 15 5847-0009", "+54 9 11 5847 0009" → "+5491158470009").
 * Números de otros países se aceptan si vienen con "+" y código de país.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const international = raw.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (international && !digits.startsWith("54")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  let national = digits.startsWith("54") && digits.length > 10 ? digits.slice(2) : digits;
  if (national.startsWith("9") && national.length === 11) national = national.slice(1);
  if (national.startsWith("0")) national = national.slice(1);

  if (national.length === 12) {
    // Formato con "15" después del código de área (2, 3 o 4 dígitos).
    for (const areaLen of [2, 3, 4]) {
      if (national.slice(areaLen, areaLen + 2) === "15") {
        national = national.slice(0, areaLen) + national.slice(areaLen + 2);
        break;
      }
    }
  }
  if (national.length !== 10) return null;
  return `+549${national}`;
}

/** Número para links wa.me (solo dígitos). */
export function waDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}

export function waLink(e164: string, text?: string): string {
  return `https://wa.me/${waDigits(e164)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
