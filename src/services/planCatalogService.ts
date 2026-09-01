import { PrismaClient } from '@prisma/client';
import { badRequest, notFound } from '../utils/httpError';

const prisma = new PrismaClient();

/** Ключи лимитов, которыми оперирует система. */
export type LimitKey = 'trainers' | 'clients' | 'groups' | 'branches' | 'trainings';

/** Лимит: число или 'unlimited' (в БД — NULL). */
export type LimitValue = number | 'unlimited';

export interface PlanLimits {
  trainers: LimitValue;
  clients: LimitValue;
  groups: LimitValue;
  branches: LimitValue;
  trainings: LimitValue;
}

/** Тариф в том виде, в котором его используют сервисы и отдаёт API. */
export interface PlanCatalogItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** null — «Цена договорная». */
  price: number | null;
  /** true, если цена согласуется индивидуально. */
  isNegotiable: boolean;
  limits: PlanLimits;
  isPublic: boolean;
  isActive: boolean;
  sortOrder: number;
  supportLevel: string | null;
}

/** Соответствие ключа лимита и колонки в БД. */
const LIMIT_COLUMNS: Record<LimitKey, 'maxTrainers' | 'maxClients' | 'maxGroups' | 'maxBranches' | 'maxTrainings'> = {
  trainers: 'maxTrainers',
  clients: 'maxClients',
  groups: 'maxGroups',
  branches: 'maxBranches',
  trainings: 'maxTrainings',
};

export const LIMIT_KEYS = Object.keys(LIMIT_COLUMNS) as LimitKey[];

/** Код тарифа: латиница в верхнем регистре, цифры и подчёркивание. */
const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,29}$/;

function toLimit(value: number | null): LimitValue {
  return value === null ? 'unlimited' : value;
}

function fromLimit(value: unknown, field: string): number | null {
  if (value === 'unlimited' || value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw badRequest(`Лимит «${field}» должен быть целым числом ≥ 0 или «unlimited»`, field);
  }
  return n;
}

function mapPlan(row: any): PlanCatalogItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    price: row.price === null ? null : Number(row.price),
    isNegotiable: row.price === null,
    limits: {
      trainers: toLimit(row.maxTrainers),
      clients: toLimit(row.maxClients),
      groups: toLimit(row.maxGroups),
      branches: toLimit(row.maxBranches),
      trainings: toLimit(row.maxTrainings),
    },
    isPublic: row.isPublic,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    supportLevel: row.supportLevel,
  };
}

/**
 * Каталог тарифов.
 *
 * Тарифы хранятся в таблице `subscription_plans`. Код тарифа (`code`) неизменяем
 * и служит ключом во всех связях, поэтому переименование тарифа не затрагивает
 * историю подписок, платежей и журналов выдачи.
 */
export class PlanCatalogService {
  /** Все тарифы, включая архивные и индивидуальные. Для панели супер-админа. */
  static async listAll(): Promise<PlanCatalogItem[]> {
    const rows = await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map(mapPlan);
  }

  /** Тарифы для публичной страницы /pricing: активные и не индивидуальные. */
  static async listPublic(): Promise<PlanCatalogItem[]> {
    const rows = await prisma.subscriptionPlan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(mapPlan);
  }

  /** Тарифы, доступные для выдачи вручную: активные, включая индивидуальные. */
  static async listGrantable(): Promise<PlanCatalogItem[]> {
    const rows = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(mapPlan);
  }

  /** Тариф по коду. Возвращает null, если тарифа нет. */
  static async findByCode(code: string): Promise<PlanCatalogItem | null> {
    if (!code) return null;
    const row = await prisma.subscriptionPlan.findUnique({ where: { code } });
    return row ? mapPlan(row) : null;
  }

  /** Тариф по коду или ошибка 404. */
  static async requireByCode(code: string): Promise<PlanCatalogItem> {
    const plan = await this.findByCode(code);
    if (!plan) {
      throw notFound(`Тариф «${code}» не найден`, 'planCode');
    }
    return plan;
  }

  /**
   * Лимиты тарифа. Если тариф удалён из каталога, а подписка на него осталась,
   * возвращаем нулевые лимиты — это безопаснее, чем открыть безлимит.
   */
  static async getLimits(code: string): Promise<PlanLimits> {
    const plan = await this.findByCode(code);
    if (plan) return plan.limits;

    console.warn(`[planCatalog] Тариф «${code}» отсутствует в каталоге, применяю нулевые лимиты`);
    return { trainers: 0, clients: 0, groups: 0, branches: 0, trainings: 0 };
  }

  /** Цена тарифа; null — «Цена договорная». */
  static async getPrice(code: string): Promise<number | null> {
    const plan = await this.findByCode(code);
    return plan ? plan.price : null;
  }

  /**
   * Позиция тарифа в иерархии. Сравнение «выше/ниже» идёт по sortOrder,
   * а не по цене: у договорных тарифов цены нет, и сравнивать их численно нельзя.
   */
  static async getSortOrder(code: string): Promise<number> {
    const plan = await this.findByCode(code);
    return plan ? plan.sortOrder : 0;
  }

  /** Создание тарифа. Код проверяется на формат и уникальность. */
  static async create(input: {
    code: string;
    name: string;
    description?: string | null;
    price?: number | null;
    limits?: Partial<Record<LimitKey, unknown>>;
    isPublic?: boolean;
    sortOrder?: number;
    supportLevel?: string | null;
  }): Promise<PlanCatalogItem> {
    const code = (input.code || '').trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      throw badRequest(
        'Код тарифа: латинские заглавные буквы, цифры и «_», от 2 до 30 символов, начиная с буквы',
        'code'
      );
    }

    const existing = await prisma.subscriptionPlan.findUnique({ where: { code } });
    if (existing) {
      throw badRequest(`Тариф с кодом «${code}» уже существует`, 'code');
    }

    const name = (input.name || '').trim();
    if (name.length < 2) {
      throw badRequest('Название тарифа должно содержать минимум 2 символа', 'name');
    }

    const price = this.normalizePrice(input.price);
    const limits = input.limits || {};

    const row = await prisma.subscriptionPlan.create({
      data: {
        code,
        name,
        description: input.description?.trim() || null,
        price,
        maxTrainers: fromLimit(limits.trainers, 'trainers'),
        maxClients: fromLimit(limits.clients, 'clients'),
        maxGroups: fromLimit(limits.groups, 'groups'),
        maxBranches: fromLimit(limits.branches, 'branches'),
        maxTrainings: fromLimit(limits.trainings, 'trainings'),
        isPublic: input.isPublic ?? true,
        sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
        supportLevel: input.supportLevel?.trim() || null,
      },
    });

    return mapPlan(row);
  }

  /**
   * Изменение тарифа. Код изменить нельзя — он связывает тариф с историей.
   */
  static async update(
    code: string,
    input: {
      name?: string;
      description?: string | null;
      price?: number | null;
      limits?: Partial<Record<LimitKey, unknown>>;
      isPublic?: boolean;
      isActive?: boolean;
      sortOrder?: number;
      supportLevel?: string | null;
    }
  ): Promise<{ plan: PlanCatalogItem; before: PlanCatalogItem }> {
    const before = await this.requireByCode(code);

    const data: Record<string, unknown> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length < 2) {
        throw badRequest('Название тарифа должно содержать минимум 2 символа', 'name');
      }
      data.name = name;
    }

    if (input.description !== undefined) {
      data.description = input.description?.trim() || null;
    }

    if (input.price !== undefined) {
      data.price = this.normalizePrice(input.price);
    }

    if (input.limits) {
      // Обновляем только переданные лимиты, остальные не трогаем.
      for (const key of LIMIT_KEYS) {
        if (key in input.limits) {
          data[LIMIT_COLUMNS[key]] = fromLimit(input.limits[key], key);
        }
      }
    }

    if (input.isPublic !== undefined) data.isPublic = Boolean(input.isPublic);
    if (input.supportLevel !== undefined) data.supportLevel = input.supportLevel?.trim() || null;
    if (input.sortOrder !== undefined && Number.isFinite(Number(input.sortOrder))) {
      data.sortOrder = Number(input.sortOrder);
    }

    if (input.isActive !== undefined) {
      const isActive = Boolean(input.isActive);
      if (!isActive) {
        await this.assertArchivable(code);
      }
      data.isActive = isActive;
    }

    const row = await prisma.subscriptionPlan.update({ where: { code }, data });
    return { plan: mapPlan(row), before };
  }

  /**
   * Архивация тарифа (soft-delete). История сохраняется, выдать тариф больше нельзя.
   * Физическое удаление не поддерживается намеренно: на тариф ссылаются
   * подписки, платежи и журналы выдачи.
   */
  static async archive(code: string): Promise<PlanCatalogItem> {
    await this.assertArchivable(code);
    const row = await prisma.subscriptionPlan.update({
      where: { code },
      data: { isActive: false },
    });
    return mapPlan(row);
  }

  /** Восстановление архивного тарифа. */
  static async restore(code: string): Promise<PlanCatalogItem> {
    await this.requireByCode(code);
    const row = await prisma.subscriptionPlan.update({
      where: { code },
      data: { isActive: true },
    });
    return mapPlan(row);
  }

  /** Сколько активных подписок используют тариф. */
  static async countActiveSubscriptions(code: string): Promise<number> {
    return prisma.subscription.count({
      where: { OR: [{ planType: code }, { nextPlanType: code }] },
    });
  }

  /**
   * Тариф нельзя архивировать, если он базовый (FREE) или используется подписками:
   * иначе аккаунты остались бы без действующих лимитов.
   */
  private static async assertArchivable(code: string): Promise<void> {
    if (code === 'FREE') {
      throw badRequest('Базовый тариф FREE нельзя архивировать', 'code');
    }

    const inUse = await this.countActiveSubscriptions(code);
    if (inUse > 0) {
      throw badRequest(
        `Тариф используется ${inUse} аккаунт(ами). Переведите их на другой тариф перед архивацией.`,
        'code'
      );
    }
  }

  /** Цена: число ≥ 0 либо null («Цена договорная»). */
  private static normalizePrice(value: unknown): number | null {
    if (value === null || value === undefined || value === '' || value === 'negotiable') {
      return null;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw badRequest('Цена должна быть числом ≥ 0 либо не указана (цена договорная)', 'price');
    }
    return Math.round(n * 100) / 100;
  }
}
