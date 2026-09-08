/**
 * Личная скидка клиента на ежемесячный платёж группы.
 * percent — процент от базы; fixed — фиксированная сумма в ₽.
 */
export type PersonalDiscountType = 'percent' | 'fixed';

export function applyPersonalDiscount(
  baseAmount: number,
  discountType?: string | null,
  discountValue?: number | string | null
): { amount: number; originalAmount: number } {
  const base = Number(baseAmount);
  const originalAmount = Number.isFinite(base) && base > 0 ? base : 0;
  if (originalAmount <= 0) {
    return { amount: 0, originalAmount: 0 };
  }

  const value = Number(discountValue);
  if (!discountType || !Number.isFinite(value) || value <= 0) {
    return { amount: originalAmount, originalAmount };
  }

  if (discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, value));
    const amount = Math.round(originalAmount * (1 - pct / 100) * 100) / 100;
    return { amount: Math.max(0, amount), originalAmount };
  }

  if (discountType === 'fixed') {
    const amount = Math.round(Math.max(0, originalAmount - value) * 100) / 100;
    return { amount, originalAmount };
  }

  return { amount: originalAmount, originalAmount };
}
