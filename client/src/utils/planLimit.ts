/** Payload 403 PLAN_LIMIT с бэкенда. */
export type PlanLimitPayload = {
  code: 'PLAN_LIMIT';
  resource: string;
  limit: number | 'unlimited';
  used: number;
  planType: string;
  planName: string;
};

const PLAN_LIMIT_HINT = 'Чтобы добавить ещё — смените тариф';

export function isPlanLimitPayload(data: unknown): data is PlanLimitPayload {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as PlanLimitPayload).code === 'PLAN_LIMIT'
  );
}

/** Достаёт PLAN_LIMIT из ответа axios / ApiResponse. */
export function getPlanLimitFromError(err: unknown): PlanLimitPayload | null {
  const data = (err as any)?.response?.data?.data;
  if (isPlanLimitPayload(data)) return data;
  return null;
}

/** Сообщение об ошибке + опциональный PLAN_LIMIT. */
export function parsePlanLimitError(
  err: unknown,
  fallback = 'Произошла ошибка'
): { message: string; planLimit: PlanLimitPayload | null } {
  const responseData = (err as any)?.response?.data;
  const planLimit = isPlanLimitPayload(responseData?.data) ? responseData.data : null;
  const message = responseData?.error || (err as any)?.message || fallback;
  return { message, planLimit };
}

/** true, если текст уже содержит унифицированное сообщение о лимите. */
export function looksLikePlanLimitMessage(message: string | null | undefined): boolean {
  return typeof message === 'string' && message.includes(PLAN_LIMIT_HINT);
}
