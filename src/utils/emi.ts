/**
 * Independent EMI calculation used as the test oracle. It is deliberately written separately from
 * app/app.js so that a bug in the app cannot hide itself in the expected values.
 * E = P * r * (1+r)^n / ((1+r)^n - 1), r = annualRate / 12 / 100, n = years * 12
 */
export interface EmiResult {
  emi: number;
  totalInterest: number;
  totalPayment: number;
}

export function calculateEmi(principal: number, annualRatePercent: number, years: number): EmiResult {
  const n = years * 12;
  const r = annualRatePercent / 12 / 100;
  const factor = Math.pow(1 + r, n);
  const emi = r === 0 ? principal / n : (principal * r * factor) / (factor - 1);
  const totalPayment = emi * n;
  return { emi, totalInterest: totalPayment - principal, totalPayment };
}

/** Parses a displayed amount such as "₹33,037.68" into 33037.68. */
export function parseMoney(text: string): number {
  const cleaned = text.replace(/[^0-9.\-]/g, '');
  const value = Number(cleaned);
  if (Number.isNaN(value)) {
    throw new Error(`Cannot parse a number from "${text}"`);
  }
  return value;
}
