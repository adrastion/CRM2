import { PlanCatalogService, type LimitKey, type PlanLimits } from '../services/planCatalogService';
import { SubscriptionService } from '../services/subscriptionService';
import { HttpError } from './httpError';
import { prisma } from '../lib/prisma';
import { EXTRA_STAFF_ROLES } from '../services/planCatalogService';

/** Русские названия ресурсов для сообщений о лимитах тарифа. */
export const RESOURCE_LABELS_RU: Record<LimitKey, string> = {
  trainers: 'тренеров',
  clients: 'клиентов',
  groups: 'групп',
  branches: 'филиалов',
  trainings: 'тренировок за месяц',
  extraStaff: 'доп. сотрудников',
};

export type PlanLimitPayload = {
  code: 'PLAN_LIMIT';
  resource: LimitKey;
  limit: number | 'unlimited';
  used: number;
  planType: string;
  planName: string;
};

export type PlanLimitDenial = {
  message: string;
  data: PlanLimitPayload;
};

export function formatPlanLimitMessage(params: {
  planName: string;
  resource: LimitKey;
  limit: number | 'unlimited';
  used: number;
}): string {
  const label = RESOURCE_LABELS_RU[params.resource] || params.resource;
  const limitText = params.limit === 'unlimited' ? 'безлимит' : String(params.limit);
  return `На тарифе «${params.planName}» лимит ${label}: ${limitText}. Сейчас занято ${params.used}. Чтобы добавить ещё — смените тариф.`;
}

async function countResourceUsage(tenantId: string, resource: LimitKey): Promise<number> {
  switch (resource) {
    case 'trainers':
      return prisma.trainer.count({ where: { tenantId, isActive: true } });
    case 'clients':
      return prisma.client.count({ where: { tenantId, isActive: true } });
    case 'groups':
      return prisma.group.count({ where: { tenantId, isActive: true } });
    case 'branches':
      return prisma.branch.count({ where: { tenantId, isActive: true } });
    case 'trainings': {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      return prisma.training.count({
        where: {
          tenantId,
          startTime: { gte: startOfMonth },
          isCancelled: false,
        },
      });
    }
    case 'extraStaff':
      return prisma.user.count({
        where: {
          tenantId,
          isActive: true,
          role: { in: [...EXTRA_STAFF_ROLES] },
        },
      });
    default:
      return 0;
  }
}

/** Собирает понятное сообщение и payload PLAN_LIMIT для ответа 403. */
export async function buildPlanLimitDenial(
  tenantId: string,
  resource: LimitKey
): Promise<PlanLimitDenial> {
  const subscription = await SubscriptionService.getSubscription(tenantId);
  const planType = subscription?.planType || 'UNKNOWN';
  const plan = await PlanCatalogService.findByCode(planType);
  const limits: PlanLimits = plan
    ? plan.limits
    : await PlanCatalogService.getLimits(planType);
  const limit = limits[resource];
  const used = await countResourceUsage(tenantId, resource);
  const planName = plan?.name || planType;

  const data: PlanLimitPayload = {
    code: 'PLAN_LIMIT',
    resource,
    limit,
    used,
    planType,
    planName,
  };

  return {
    message: formatPlanLimitMessage({ planName, resource, limit, used }),
    data,
  };
}

/** HttpError 403 с текстом и data.code = PLAN_LIMIT. */
export async function planLimitHttpError(tenantId: string, resource: LimitKey): Promise<HttpError> {
  const denial = await buildPlanLimitDenial(tenantId, resource);
  return new HttpError(403, denial.message, { details: denial.data });
}
