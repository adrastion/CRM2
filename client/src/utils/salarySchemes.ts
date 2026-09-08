export const SALARY_SCHEME_OPTIONS = [
  {
    value: 'per_training_person',
    label: 'Фикс за тренировку с человека',
    rateLabel: 'Ставка с человека (₽)',
    hint: 'Начисляется за каждого отмеченного PRESENT (включая разовых).',
  },
  {
    value: 'fixed_per_student_month',
    label: 'Фикс с ученика в месяц',
    rateLabel: 'Сумма с ученика (₽)',
    hint: 'При оплате абонемента/месяца клиентом вашей группы.',
  },
  {
    value: 'percent_month',
    label: 'Фикс % в месяц',
    rateLabel: 'Процент (%)',
    hint: 'Процент от суммы оплаты абонемента клиентом вашей группы.',
  },
  {
    value: 'fixed_monthly',
    label: 'Фикс плата в месяц',
    rateLabel: 'Сумма в месяц (₽)',
    hint: 'Фиксированная зарплата (админ, уборщик, медик и т.д.).',
  },
] as const;

/** Схемы, настраиваемые на карточке группы (без фикс/мес сотрудника). */
export const GROUP_SALARY_SCHEME_OPTIONS = SALARY_SCHEME_OPTIONS.filter(
  (o) => o.value !== 'fixed_monthly'
);

export type SalarySchemeValue = (typeof SALARY_SCHEME_OPTIONS)[number]['value'];

const LEGACY_MAP: Record<string, SalarySchemeValue> = {
  percentage: 'percent_month',
  individual: 'percent_month',
  fixed: 'fixed_monthly',
  per_student: 'per_training_person',
  per_training: 'per_training_person',
  per_training_person: 'per_training_person',
  fixed_per_student_month: 'fixed_per_student_month',
  percent_month: 'percent_month',
  fixed_monthly: 'fixed_monthly',
};

export function normalizeSalaryScheme(value?: string | null): SalarySchemeValue {
  if (!value) return 'per_training_person';
  return LEGACY_MAP[value] || 'per_training_person';
}

export function salarySchemeLabel(value?: string | null): string {
  const scheme = normalizeSalaryScheme(value);
  return SALARY_SCHEME_OPTIONS.find((o) => o.value === scheme)?.label || scheme;
}

export function salaryRateFieldLabel(value?: string | null): string {
  const scheme = normalizeSalaryScheme(value);
  return SALARY_SCHEME_OPTIONS.find((o) => o.value === scheme)?.rateLabel || 'Ставка';
}

export function salarySchemeHint(value?: string | null): string {
  const scheme = normalizeSalaryScheme(value);
  return SALARY_SCHEME_OPTIONS.find((o) => o.value === scheme)?.hint || '';
}
