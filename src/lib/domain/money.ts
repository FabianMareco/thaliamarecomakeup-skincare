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

export function formatARS(amount: number): string {
  return "$" + Math.round(amount).toLocaleString("es-AR");
}
