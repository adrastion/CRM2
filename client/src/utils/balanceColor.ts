import { colors } from '../theme/tokens';

/** Цвет суммы баланса: долг красный, ноль — основной текст, плюс — зелёный. */
export function balanceAmountColor(amount: number): string {
  if (amount < 0) return colors.danger;
  if (amount > 0) return colors.success;
  return colors.text;
}
