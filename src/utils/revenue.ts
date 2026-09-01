/**
 * Финансовые расчёты панели супер-админа.
 *
 * Ключевые правила, заданные требованиями:
 * 1. Тарифы, выданные вручную супер-админом (`Subscription.isGranted`), НЕ учитываются
 *    в доходах, MRR/ARR, прогнозе и конверсии — деньги за них не поступали.
 * 2. Доход считается по фактически полученным суммам (`SubscriptionPayment.amount`),
 *    а размер скидки по промокоду показывается отдельной метрикой.
 * 3. История не пересчитывается: цена и скидка берутся из снимка платежа
 *    (`planCode`/`listPrice`/`discountAmount`), поэтому изменение цены в каталоге
 *    не меняет прошлую выручку.
 */

/** Платёж в том виде, в котором он нужен расчётам. */
export interface PaymentLike {
  amount: unknown;
  listPrice?: unknown;
  discountAmount?: unknown;
  planCode?: string | null;
  paymentMethod?: string | null;
  subscription?: { planType?: string | null } | null;
  promoCodeUsage?: { discountAmount?: unknown } | null;
}

/** Разложенная сумма платежа. */
export interface PaymentBreakdown {
  /** Фактически полученная сумма. */
  netAmount: number;
  /** Цена тарифа до скидки на момент оплаты. */
  listPrice: number;
  /** Размер предоставленной скидки. */
  discountAmount: number;
  /** Код тарифа на момент оплаты. */
  planCode: string | null;
  /** Была ли применена скидка. */
  hasDiscount: boolean;
}

function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Разбирает платёж на «получено» и «скидка», опираясь на снимок,
 * сохранённый в момент оплаты.
 *
 * Для платежей, созданных до появления снимка, скидка берётся из
 * `promoCodeUsage`, а цена до скидки восстанавливается как сумма + скидка.
 */
export function breakdownPayment(payment: PaymentLike): PaymentBreakdown {
  const netAmount = num(payment.amount);

  const snapshotDiscount =
    payment.discountAmount !== null && payment.discountAmount !== undefined
      ? num(payment.discountAmount)
      : null;
  const discountAmount =
    snapshotDiscount !== null ? snapshotDiscount : num(payment.promoCodeUsage?.discountAmount);

  const snapshotListPrice =
    payment.listPrice !== null && payment.listPrice !== undefined ? num(payment.listPrice) : null;
  const listPrice = snapshotListPrice !== null ? snapshotListPrice : netAmount + discountAmount;

  return {
    netAmount,
    listPrice,
    discountAmount,
    planCode: payment.planCode || payment.subscription?.planType || null,
    hasDiscount: discountAmount > 0,
  };
}

/** Итоги по набору платежей. */
export interface RevenueTotals {
  /** Фактически полученные деньги. */
  netRevenue: number;
  /** Сумма по прайсу без скидок. */
  grossRevenue: number;
  /** Сколько отдано скидками. */
  discountsGiven: number;
  /** Количество платежей. */
  count: number;
  /** Количество платежей со скидкой. */
  discountedCount: number;
}

export function sumPayments(payments: PaymentLike[]): RevenueTotals {
  return payments.reduce<RevenueTotals>(
    (acc, payment) => {
      const b = breakdownPayment(payment);
      acc.netRevenue += b.netAmount;
      acc.grossRevenue += b.listPrice;
      acc.discountsGiven += b.discountAmount;
      acc.count += 1;
      if (b.hasDiscount) acc.discountedCount += 1;
      return acc;
    },
    { netRevenue: 0, grossRevenue: 0, discountsGiven: 0, count: 0, discountedCount: 0 }
  );
}

/** Подписка в том виде, в котором она нужна расчётам. */
export interface SubscriptionLike {
  planType: string;
  status: string;
  endDate?: Date | null;
  isGranted?: boolean | null;
}

/**
 * Учитывается ли подписка в денежных метриках.
 *
 * Выданные вручную и бесплатные подписки исключаются: платежей по ним нет,
 * иначе MRR и прогноз показывали бы деньги, которые никто не платил.
 */
export function isBillable(
  subscription: SubscriptionLike,
  priceOf: (planCode: string) => number | null
): boolean {
  if (subscription.isGranted) return false;
  if (subscription.status !== 'active') return false;

  const price = priceOf(subscription.planType);
  // null — «цена договорная»: сумму мы не знаем, в MRR не включаем.
  return price !== null && price > 0;
}

/**
 * MRR: сумма цен активных оплачиваемых подписок.
 * Выданные тарифы и тарифы с договорной ценой не участвуют.
 */
export function calculateMrr(
  subscriptions: SubscriptionLike[],
  priceOf: (planCode: string) => number | null
): { mrr: number; billableCount: number; grantedCount: number; negotiableCount: number } {
  let mrr = 0;
  let billableCount = 0;
  let grantedCount = 0;
  let negotiableCount = 0;

  for (const sub of subscriptions) {
    if (sub.isGranted) {
      grantedCount += 1;
      continue;
    }
    if (sub.status !== 'active') continue;

    const price = priceOf(sub.planType);
    if (price === null) {
      negotiableCount += 1;
      continue;
    }
    if (price > 0) {
      mrr += price;
      billableCount += 1;
    }
  }

  return { mrr, billableCount, grantedCount, negotiableCount };
}