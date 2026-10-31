import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';

export type SupportPromoAudience = 'school' | 'marketer' | 'client' | 'all';

const AUDIENCES = new Set(['school', 'marketer', 'client', 'all']);
const ACCOUNT_SCOPES = new Set(['ALL', 'NEW']);

export type SupportPromoPublic = {
  id: string;
  key: string | null;
  title: string;
  description: string;
  badgeLabel: string | null;
  buttonLabel: string;
  ticketKind: string;
  ticketSubject: string | null;
  defaultMessage: string | null;
  audience: string;
  accountScope: string;
  newAccountDays: number;
};

export type PromoAccountContext = {
  accountCreatedAt?: Date | null;
};

function envForcesQuickSetup(): boolean {
  const raw = String(process.env.SUPPORT_QUICK_SETUP_PROMO || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function toPublic(row: {
  id: string;
  key: string | null;
  title: string;
  description: string;
  badgeLabel: string | null;
  buttonLabel: string;
  ticketKind: string;
  ticketSubject: string | null;
  defaultMessage: string | null;
  audience: string;
  accountScope?: string;
  newAccountDays?: number;
}): SupportPromoPublic {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    badgeLabel: row.badgeLabel,
    buttonLabel: row.buttonLabel,
    ticketKind: row.ticketKind,
    ticketSubject: row.ticketSubject,
    defaultMessage: row.defaultMessage,
    audience: row.audience,
    accountScope: row.accountScope || 'ALL',
    newAccountDays: row.newAccountDays ?? 30,
  };
}

function matchesAccountScope(
  row: { accountScope?: string | null; newAccountDays?: number | null },
  ctx?: PromoAccountContext
): boolean {
  const scope = String(row.accountScope || 'ALL').toUpperCase();
  if (scope !== 'NEW') return true;
  const created = ctx?.accountCreatedAt ? new Date(ctx.accountCreatedAt) : null;
  if (!created || Number.isNaN(created.getTime())) return false;
  const days = Math.max(1, Number(row.newAccountDays) || 30);
  const ageMs = Date.now() - created.getTime();
  return ageMs <= days * 24 * 60 * 60 * 1000;
}

export class SupportPromoService {
  /** Активные промо для аудитории виджета (с фильтром новых аккаунтов). */
  static async listActiveForAudience(
    audience: SupportPromoAudience,
    ctx?: PromoAccountContext
  ): Promise<SupportPromoPublic[]> {
    const rows = await prisma.supportPromo.findMany({
      where: {
        isActive: true,
        OR: [{ audience }, { audience: 'all' }],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    // Env-флаг включает системную «Быструю настройку», даже если в БД выключена.
    if (envForcesQuickSetup() && audience === 'school') {
      const hasQuick = rows.some((r) => r.key === 'quick_setup' || r.ticketKind === 'QUICK_SETUP');
      if (!hasQuick) {
        const seeded = await prisma.supportPromo.findFirst({
          where: { OR: [{ key: 'quick_setup' }, { ticketKind: 'QUICK_SETUP' }] },
          orderBy: { sortOrder: 'asc' },
        });
        if (seeded) rows.unshift(seeded);
      }
    }

    return rows.filter((r) => matchesAccountScope(r, ctx)).map(toPublic);
  }

  static async isQuickSetupAvailable(ctx?: PromoAccountContext): Promise<boolean> {
    if (envForcesQuickSetup()) return true;
    const row = await prisma.supportPromo.findFirst({
      where: {
        isActive: true,
        OR: [{ key: 'quick_setup' }, { ticketKind: 'QUICK_SETUP' }],
      },
    });
    if (!row) return false;
    return matchesAccountScope(row, ctx);
  }

  static async getActiveById(id: string, ctx?: PromoAccountContext): Promise<SupportPromoPublic | null> {
    const row = await prisma.supportPromo.findUnique({ where: { id } });
    if (!row) return null;
    const forced =
      envForcesQuickSetup() && (row.key === 'quick_setup' || row.ticketKind === 'QUICK_SETUP');
    if (!row.isActive && !forced) return null;
    if (!matchesAccountScope(row, ctx)) return null;
    return toPublic(row);
  }

  static async listAdmin() {
    return prisma.supportPromo.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        autoReplyAttachments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
      },
    });
  }

  static async create(input: {
    title: string;
    description: string;
    badgeLabel?: string | null;
    buttonLabel: string;
    ticketKind?: string;
    ticketSubject?: string | null;
    defaultMessage?: string | null;
    audience?: string;
    accountScope?: string;
    newAccountDays?: number;
    autoReplyEnabled?: boolean;
    autoReplyBody?: string | null;
    isActive?: boolean;
    sortOrder?: number;
    key?: string | null;
  }) {
    const title = String(input.title || '').trim();
    const description = String(input.description || '').trim();
    const buttonLabel = String(input.buttonLabel || '').trim();
    if (!title) throw badRequest('Укажите заголовок', 'title');
    if (!description) throw badRequest('Укажите описание', 'description');
    if (!buttonLabel) throw badRequest('Укажите текст кнопки', 'buttonLabel');

    const audience = String(input.audience || 'school').toLowerCase();
    if (!AUDIENCES.has(audience)) throw badRequest('Некорректная аудитория', 'audience');

    const ticketKind = String(input.ticketKind || 'GENERAL').toUpperCase();
    if (!['GENERAL', 'QUICK_SETUP'].includes(ticketKind)) {
      throw badRequest('ticketKind: GENERAL или QUICK_SETUP', 'ticketKind');
    }

    const accountScope = String(input.accountScope || 'ALL').toUpperCase();
    if (!ACCOUNT_SCOPES.has(accountScope)) {
      throw badRequest('accountScope: ALL или NEW', 'accountScope');
    }

    const key = input.key != null ? String(input.key).trim() || null : null;
    const newAccountDays = Math.max(1, Math.min(365, Number(input.newAccountDays) || 30));

    return prisma.supportPromo.create({
      data: {
        key,
        title,
        description,
        badgeLabel: input.badgeLabel != null ? String(input.badgeLabel).trim() || null : null,
        buttonLabel,
        ticketKind,
        ticketSubject:
          input.ticketSubject != null ? String(input.ticketSubject).trim() || null : title,
        defaultMessage:
          input.defaultMessage != null ? String(input.defaultMessage).trim() || null : description,
        audience,
        accountScope,
        newAccountDays,
        autoReplyEnabled: Boolean(input.autoReplyEnabled),
        autoReplyBody:
          input.autoReplyBody != null ? String(input.autoReplyBody).trim() || null : null,
        isActive: Boolean(input.isActive),
        sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 100,
      },
    });
  }

  static async update(
    id: string,
    input: Partial<{
      title: string;
      description: string;
      badgeLabel: string | null;
      buttonLabel: string;
      ticketKind: string;
      ticketSubject: string | null;
      defaultMessage: string | null;
      audience: string;
      accountScope: string;
      newAccountDays: number;
      autoReplyEnabled: boolean;
      autoReplyBody: string | null;
      isActive: boolean;
      sortOrder: number;
    }>
  ) {
    const existing = await prisma.supportPromo.findUnique({ where: { id } });
    if (!existing) throw notFound('Промо не найдено');

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) {
      const title = String(input.title || '').trim();
      if (!title) throw badRequest('Укажите заголовок', 'title');
      data.title = title;
    }
    if (input.description !== undefined) {
      const description = String(input.description || '').trim();
      if (!description) throw badRequest('Укажите описание', 'description');
      data.description = description;
    }
    if (input.buttonLabel !== undefined) {
      const buttonLabel = String(input.buttonLabel || '').trim();
      if (!buttonLabel) throw badRequest('Укажите текст кнопки', 'buttonLabel');
      data.buttonLabel = buttonLabel;
    }
    if (input.badgeLabel !== undefined) {
      data.badgeLabel = input.badgeLabel != null ? String(input.badgeLabel).trim() || null : null;
    }
    if (input.ticketSubject !== undefined) {
      data.ticketSubject =
        input.ticketSubject != null ? String(input.ticketSubject).trim() || null : null;
    }
    if (input.defaultMessage !== undefined) {
      data.defaultMessage =
        input.defaultMessage != null ? String(input.defaultMessage).trim() || null : null;
    }
    if (input.audience !== undefined) {
      const audience = String(input.audience || '').toLowerCase();
      if (!AUDIENCES.has(audience)) throw badRequest('Некорректная аудитория', 'audience');
      data.audience = audience;
    }
    if (input.ticketKind !== undefined) {
      const ticketKind = String(input.ticketKind || '').toUpperCase();
      if (!['GENERAL', 'QUICK_SETUP'].includes(ticketKind)) {
        throw badRequest('ticketKind: GENERAL или QUICK_SETUP', 'ticketKind');
      }
      data.ticketKind = ticketKind;
    }
    if (input.accountScope !== undefined) {
      const accountScope = String(input.accountScope || '').toUpperCase();
      if (!ACCOUNT_SCOPES.has(accountScope)) {
        throw badRequest('accountScope: ALL или NEW', 'accountScope');
      }
      data.accountScope = accountScope;
    }
    if (input.newAccountDays !== undefined) {
      data.newAccountDays = Math.max(1, Math.min(365, Number(input.newAccountDays) || 30));
    }
    if (input.autoReplyEnabled !== undefined) data.autoReplyEnabled = Boolean(input.autoReplyEnabled);
    if (input.autoReplyBody !== undefined) {
      data.autoReplyBody =
        input.autoReplyBody != null ? String(input.autoReplyBody).trim() || null : null;
    }
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
    if (input.sortOrder !== undefined) data.sortOrder = Number(input.sortOrder) || 0;

    return prisma.supportPromo.update({ where: { id }, data: data as any });
  }

  static async remove(id: string) {
    const existing = await prisma.supportPromo.findUnique({ where: { id } });
    if (!existing) throw notFound('Промо не найдено');
    if (existing.key === 'quick_setup') {
      throw badRequest('Системную «Быструю настройку» нельзя удалить — только выключить');
    }
    await prisma.supportPromo.delete({ where: { id } });
    return { ok: true };
  }

  static async reorder(ids: string[]) {
    const list = (ids || []).map(String).filter(Boolean);
    if (!list.length) throw badRequest('Укажите ids');
    await prisma.$transaction(
      list.map((id, index) =>
        prisma.supportPromo.update({
          where: { id },
          data: { sortOrder: (index + 1) * 10 },
        })
      )
    );
    return { ok: true };
  }
}
