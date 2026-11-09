// Montos siempre en pesos argentinos enteros.

export type DepositBreakdown = { deposit: number; balance: number };

/** Skincare: seña fija, nunca mayor al precio. */
export function skincareDeposit(price: number, depositAmount: number): DepositBreakdown {
  const deposit = Math.max(0, Math.min(depositAmount, price));
  return { deposit, balance: price - deposit };
}

/**
 * Makeup: seña = porcentaje del precio del servicio. El viático no entra en la
 * seña; se cobra con el saldo el día del evento.
 */
export function makeupDeposit(
  finalPrice: number,
  depositPercent: number,
  travelFee = 0,
): DepositBreakdown {
  const deposit = Math.round((finalPrice * depositPercent) / 100);
  return { deposit, balance: finalPrice - deposit + travelFee };
}

export type Extra = { serviceId?: string; name: string; price: number };

/** Precio de lista: tratamiento principal más los extras. */
export function listPrice(servicePrice: number, extras: Extra[] = []): number {
  return servicePrice + extras.reduce((sum, e) => sum + e.price, 0);
}

/** Total a cobrar: el precio de combo que fijó Thalia o, si no hay, el de lista. */
export function bookingTotal(b: { service: { price: number }; extras?: Extra[]; totalPrice?: number }): number {
  return b.totalPrice ?? listPrice(b.service.price, b.extras);
}

/** Saldo cuando cambia el total de una reserva ya hecha: la seña no cambia. */
export function balanceFor(total: number, depositAmount: number): number {
  return Math.max(0, total - depositAmount);
}

/** Nombre del tratamiento con sus extras, ej. "Limpieza profunda Clásica + Diseño + perfilado de cejas". */
export function serviceLabel(b: { service: { name: string }; extras?: Extra[] }): string {
  return [b.service.name, ...(b.extras ?? []).map((e) => e.name)].join(" + ");
}

export function formatARS(amount: number): string {
  return "$" + Math.round(amount).toLocaleString("es-AR");
}
