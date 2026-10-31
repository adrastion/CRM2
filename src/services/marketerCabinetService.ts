import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import { randomBytes } from 'crypto';
import {
  makeLeadDisplayCode,
  maskEmail,
  maskName,
  maskPhone,
  schoolLabelFromId,
} from '../utils/marketerMask';

const LEAD_STATUSES = new Set(['NEW', 'IN_PROGRESS', 'CONVERTED', 'LOST']);
const TASK_STATUSES = new Set(['OPEN', 'DONE', 'CANCELLED']);
const TASK_KINDS = new Set(['TASK', 'CALL', 'OTHER']);
const CHAT_CHANNELS = new Set(['SUPPORT', 'ACCOUNTING']);
const PUB_TYPES = new Set(['NEWS', 'PROMO', 'BANNER', 'POSTER', 'UPDATE']);

function isPaidPlan(planType?: string | null): boolean {
  if (!planType) return false;
  return planType.toUpperCase() !== 'FREE';
}

function serializeLead(lead: {
  id: string;
  displayCode: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  notes: string | null;
  source: string;
  convertedTenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: lead.id,
    kind: 'lead' as const,
    displayCode: lead.displayCode,
    maskedName: maskName(lead.contactName),
    maskedEmail: maskEmail(lead.contactEmail),
    maskedPhone: maskPhone(lead.contactPhone),
    status: lead.status,
    notes: lead.notes,
    source: lead.source,
    convertedTenantId: lead.convertedTenantId,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

async function serializeSchoolClient(
  marketerId: string,
  row: {
    tenantId: string;
    createdAt: Date;
    firstPaidAt?: Date | null;
    commissionRightActive?: boolean;
    commissionRightLostAt?: Date | null;
    commissionRightLostReason?: string | null;
    tenant: {
      id: string;
      name?: string | null;
      subscription: { planType: string; status: string } | null;
    };
  },
  riskRank: number | null = null
) {
  const planType = row.tenant.subscription?.planType || 'FREE';
  const subStatus = row.tenant.subscription?.status || 'active';
  const billing: 'active' | 'free' =
    isPaidPlan(planType) && subStatus === 'active' ? 'active' : 'free';
  const linkedLead = await prisma.marketerLead.findFirst({
    where: { marketerId, convertedTenantId: row.tenantId },
    select: { id: true, displayCode: true },
  });
  const tenantName = row.tenant.name || schoolLabelFromId(row.tenantId);
  return {
    id: row.tenantId,
    kind: 'school' as const,
    displayCode: schoolLabelFromId(row.tenantId),
    tenantName,
    maskedName: null as string | null,
    maskedEmail: null as string | null,
    maskedPhone: null as string | null,
    status: billing,
    planType,
    subscriptionStatus: subStatus,
    linkedAt: row.createdAt,
    leadId: linkedLead?.id || null,
    leadDisplayCode: linkedLead?.displayCode || null,
    firstPaidAt: row.firstPaidAt || null,
    commissionRightActive: row.commissionRightActive !== false,
    commissionRightLostAt: row.commissionRightLostAt || null,
    commissionRightLostReason: row.commissionRightLostReason || null,
    riskRank,
  };
}

export class MarketerCabinetService {
  static async ensureAdvertisingLink(marketerId: string) {
    const existing = await prisma.referralLink.findFirst({
      where: { marketerId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    let code = randomBytes(8).toString('hex').toUpperCase();
    for (let i = 0; i < 5; i++) {
      const clash = await prisma.referralLink.findUnique({ where: { code } });
      if (!clash) break;
      code = randomBytes(8).toString('hex').toUpperCase();
    }

    return prisma.referralLink.create({
      data: {
        code,
        name: 'Рекламная ссылка',
        description: 'Автоматически созданная рекламная ссылка маркетолога',
        url: '/register',
        isActive: true,
        marketerId,
        tenantId: null,
      },
    });
  }

  static async getDashboard(marketerId: string) {
    await this.ensureAdvertisingLink(marketerId);

    const [leads, schools, urgentTasks, publications, accruals, docs, marketer, promoCodes, referralLinks, pendingClicks, pendingClicksCount] =
      await Promise.all([
        prisma.marketerLead.count({ where: { marketerId } }),
        prisma.tenantMarketer.findMany({
          where: { marketerId },
          include: {
            tenant: { include: { subscription: true } },
          },
        }),
        prisma.marketerTask.findMany({
          where: {
            marketerId,
            status: 'OPEN',
            OR: [
              { dueAt: { lte: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) } },
              { dueAt: null },
            ],
          },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
          take: 8,
        }),
        prisma.platformPublication.findMany({
          where: { isActive: true },
          orderBy: { publishedAt: 'desc' },
          take: 5,
        }),
        prisma.marketerCommissionLedger.findMany({
          where: { marketerId, kind: 'ACCRUAL' },
          orderBy: { occurredAt: 'desc' },
          take: 5,
        }),
        prisma.marketerClosingDoc.findMany({
          where: { OR: [{ marketerId }, { marketerId: null }] },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.marketer.findUnique({
          where: { id: marketerId },
          select: { balance: true, commissionPercentage: true },
        }),
        prisma.promoCode.findMany({
          where: { marketerId, isActive: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.referralLink.findMany({
          where: { marketerId, isActive: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.referralClick.findMany({
          where: {
            converted: false,
            referralLink: { marketerId, isActive: true },
          },
          orderBy: { clickedAt: 'desc' },
          take: 15,
          select: {
            id: true,
            clickedAt: true,
            referralLink: { select: { code: true, name: true } },
          },
        }),
        prisma.referralClick.count({
          where: {
            converted: false,
            referralLink: { marketerId, isActive: true },
          },
        }),
      ]);

    let activeSchools = 0;
    let freeSchools = 0;
    for (const s of schools) {
      const plan = s.tenant.subscription?.planType || 'FREE';
      const st = s.tenant.subscription?.status || 'active';
      if (isPaidPlan(plan) && st === 'active') activeSchools += 1;
      else freeSchools += 1;
    }

    let activity: any = null;
    try {
      const { MarketerActivityService } = await import('./marketerActivityService');
      activity = await MarketerActivityService.getCompactActivity(marketerId);
    } catch (e) {
      console.error('[MarketerActivity] dashboard compact failed:', e);
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const [accruedThisMonthAgg, accruedPrevMonthAgg, teamCount, referralEarnedAgg, openLeads, inviteToken] =
      await Promise.all([
        prisma.marketerCommissionLedger.aggregate({
          where: { marketerId, kind: 'ACCRUAL', occurredAt: { gte: monthStart } },
          _sum: { amount: true },
        }),
        prisma.marketerCommissionLedger.aggregate({
          where: {
            marketerId,
            kind: 'ACCRUAL',
            occurredAt: { gte: prevMonthStart, lt: monthStart },
          },
          _sum: { amount: true },
        }),
        prisma.marketer.count({ where: { invitedById: marketerId } }),
        prisma.marketerCommissionLedger.aggregate({
          where: { marketerId, kind: 'ACCRUAL', commissionType: 'REFERRAL' },
          _sum: { amount: true },
        }),
        prisma.marketerLead.findMany({
          where: { marketerId, status: { in: ['NEW', 'IN_PROGRESS'] } },
          orderBy: { updatedAt: 'desc' },
          take: 8,
        }),
        this.ensureInviteToken(marketerId),
      ]);

    const accruedThisMonth = Number(accruedThisMonthAgg._sum.amount || 0);
    const accruedPrevMonth = Number(accruedPrevMonthAgg._sum.amount || 0);
    const momDeltaPct =
      accruedPrevMonth > 0
        ? Math.round(((accruedThisMonth - accruedPrevMonth) / accruedPrevMonth) * 100)
        : accruedThisMonth > 0
          ? 100
          : 0;

    const schoolRecent = schools
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((s) => {
        const plan = s.tenant.subscription?.planType || 'FREE';
        const paid = isPaidPlan(plan) && (s.tenant.subscription?.status || 'active') === 'active';
        const name = s.tenant.name || schoolLabelFromId(s.tenantId);
        const initials = name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('')
          .slice(0, 2);
        return {
          id: s.tenantId,
          kind: 'school' as const,
          name,
          initials: initials || 'СК',
          subtitle: new Date(s.createdAt).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
          }),
          status: paid ? ('paid' as const) : ('test' as const),
          statusLabel: paid ? 'Оплачено' : 'Тестовый период',
          plan: paid ? plan : plan === 'FREE' ? 'Не выбран' : plan,
          lastAction: paid ? 'Подписка активна' : 'Уточнить решение',
          updatedAt: s.createdAt,
        };
      });

    const leadRecent = openLeads.map((l) => {
      const name = (l.notes || '').trim() || `Лид ${l.displayCode}`;
      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('')
        .slice(0, 2);
      return {
        id: l.id,
        kind: 'lead' as const,
        name,
        initials: initials || 'ЛД',
        subtitle: new Date(l.updatedAt).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
        }),
        status: 'work' as const,
        statusLabel: 'Переговоры',
        plan: 'Не выбран',
        lastAction: 'Связаться с клубом',
        updatedAt: l.updatedAt,
      };
    });

    const recentOrgs = [...schoolRecent, ...leadRecent]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 4)
      .map(({ updatedAt: _u, ...rest }) => rest);

    const inProgressOrgs = freeSchools + openLeads.length;

    return {
      clients: {
        total: leads + schools.length,
        leads,
        schools: schools.length,
        active: activeSchools,
        free: freeSchools,
      },
      home: {
        orgsInBase: leads + schools.length,
        orgsEarning: activeSchools,
        orgsInProgress: inProgressOrgs,
        balance: Number(marketer?.balance || 0),
        accruedThisMonth,
        momDeltaPct,
        teamCount,
        referralEarned: Number(referralEarnedAgg._sum.amount || 0),
        recentOrgs,
        invite: { path: `/join/${inviteToken}`, token: inviteToken },
        adLink: (() => {
          const primary = referralLinks.find((l) => l.isActive) || referralLinks[0];
          return primary ? { code: primary.code, path: `/ref/${primary.code}` } : null;
        })(),
      },
      activity,
      balance: Number(marketer?.balance || 0),
      commissionPercentage: Number(marketer?.commissionPercentage || 0),
      promoCodes: promoCodes.map((p) => ({
        id: p.id,
        code: p.code,
        description: p.description,
        discountType: p.discountType,
        discountValue: Number(p.discountValue),
        usedCount: p.usedCount,
        usageLimit: p.usageLimit,
        isActive: p.isActive,
        validFrom: p.validFrom,
        validUntil: p.validUntil,
      })),
      referralLinks: referralLinks.map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        description: l.description,
        url: l.url,
        isActive: l.isActive,
      })),
      pendingClicksCount,
      pendingClicks: pendingClicks.map((c) => ({
        id: c.id,
        clickedAt: c.clickedAt,
        linkCode: c.referralLink.code,
        linkName: c.referralLink.name,
      })),
      urgentTasks,
      publications,
      recentAccruals: accruals.map((a) => ({
        ...a,
        amount: Number(a.amount),
        schoolLabel: a.tenantId ? schoolLabelFromId(a.tenantId) : null,
      })),
      closingDocs: docs,
    };
  }

  static async listClients(marketerId: string) {
    const [leads, schools, adLinkRow] = await Promise.all([
      prisma.marketerLead.findMany({
        where: { marketerId },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.tenantMarketer.findMany({
        where: { marketerId },
        include: { tenant: { include: { subscription: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.ensureAdvertisingLink(marketerId),
    ]);

    const { MarketerActivityService } = await import('./marketerActivityService');
    const riskRanks = await MarketerActivityService.getRiskRanks(marketerId);

    const schoolRows = await Promise.all(
      schools.map((s) =>
        serializeSchoolClient(marketerId, s, riskRanks.get(s.tenantId) || null)
      )
    );
    return {
      leads: leads.map(serializeLead),
      schools: schoolRows,
      adLink: adLinkRow ? { code: adLinkRow.code, path: `/ref/${adLinkRow.code}` } : null,
    };
  }

  static async getClientCard(marketerId: string, id: string) {
    const lead = await prisma.marketerLead.findFirst({
      where: { id, marketerId },
    });
    if (lead) {
      const tasks = await prisma.marketerTask.findMany({
        where: { marketerId, leadId: lead.id },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      });
      return { client: serializeLead(lead), tasks };
    }

    const link = await prisma.tenantMarketer.findFirst({
      where: { marketerId, tenantId: id },
      include: { tenant: { include: { subscription: true } } },
    });
    if (!link) throw notFound('Клиент не найден');
    const tasks = await prisma.marketerTask.findMany({
      where: { marketerId, tenantId: id },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    });
    const { MarketerActivityService } = await import('./marketerActivityService');
    const riskRanks = await MarketerActivityService.getRiskRanks(marketerId);
    return {
      client: await serializeSchoolClient(
        marketerId,
        link,
        riskRanks.get(link.tenantId) || null
      ),
      tasks,
    };
  }

  static async getActivity(marketerId: string) {
    const { MarketerActivityService } = await import('./marketerActivityService');
    return MarketerActivityService.getActivity(marketerId);
  }

  static async createLead(
    marketerId: string,
    input: {
      displayCode?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      notes?: string;
      status?: string;
      source?: string;
    }
  ) {
    const displayCode = (input.displayCode || makeLeadDisplayCode()).trim().toUpperCase();
    if (!displayCode) throw badRequest('Укажите код', 'displayCode');
    const status = input.status || 'NEW';
    if (!LEAD_STATUSES.has(status)) throw badRequest('Некорректный статус', 'status');

    const existing = await prisma.marketerLead.findFirst({
      where: { marketerId, displayCode },
    });
    if (existing) throw badRequest('Код уже используется', 'displayCode');

    const lead = await prisma.marketerLead.create({
      data: {
        marketerId,
        displayCode,
        contactName: input.contactName?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        notes: input.notes?.trim() || null,
        status,
        source: input.source || 'MANUAL',
      },
    });
    return serializeLead(lead);
  }

  static async updateLead(
    marketerId: string,
    id: string,
    input: {
      contactName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      notes?: string | null;
      status?: string;
    }
  ) {
    const existing = await prisma.marketerLead.findFirst({ where: { id, marketerId } });
    if (!existing) throw notFound('Лид не найден');
    if (input.status && !LEAD_STATUSES.has(input.status)) {
      throw badRequest('Некорректный статус', 'status');
    }
    const lead = await prisma.marketerLead.update({
      where: { id },
      data: {
        ...(input.contactName !== undefined
          ? { contactName: input.contactName?.trim() || null }
          : {}),
        ...(input.contactEmail !== undefined
          ? { contactEmail: input.contactEmail?.trim() || null }
          : {}),
        ...(input.contactPhone !== undefined
          ? { contactPhone: input.contactPhone?.trim() || null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });
    return serializeLead(lead);
  }

  /** Закрепить школу по subdomain или коду реферальной ссылки маркетолога */
  static async claimClient(marketerId: string, code: string) {
    const raw = String(code || '').trim();
    if (!raw) throw badRequest('Укажите код', 'code');

    let tenantId: string | null = null;

    const bySub = await prisma.tenant.findFirst({
      where: { subdomain: { equals: raw, mode: 'insensitive' } },
      select: { id: true },
    });
    if (bySub) tenantId = bySub.id;

    if (!tenantId) {
      const ref = await prisma.referralLink.findFirst({
        where: { code: raw, marketerId, isActive: true },
      });
      if (ref) {
        const click = await prisma.referralClick.findFirst({
          where: { referralLinkId: ref.id, converted: true, tenantId: { not: null } },
          orderBy: { clickedAt: 'desc' },
        });
        if (click?.tenantId) tenantId = click.tenantId;
      }
    }

    if (!tenantId) throw badRequest('Школа по коду не найдена', 'code');

    const existing = await prisma.tenantMarketer.findUnique({ where: { tenantId } });
    if (existing && existing.marketerId !== marketerId) {
      throw badRequest('Школа уже закреплена за другим маркетологом', 'code');
    }
    if (existing) {
      const link = await prisma.tenantMarketer.findUnique({
        where: { tenantId },
        include: { tenant: { include: { subscription: true } } },
      });
      return serializeSchoolClient(marketerId, link!);
    }

    const marketer = await prisma.marketer.findUnique({ where: { id: marketerId } });
    if (!marketer) throw notFound('Маркетолог не найден');

    const link = await prisma.tenantMarketer.create({
      data: {
        tenantId,
        marketerId,
        commissionPercentage: marketer.commissionPercentage,
      },
      include: { tenant: { include: { subscription: true } } },
    });

    return serializeSchoolClient(marketerId, link);
  }

  static async listTasks(
    marketerId: string,
    filters: {
      leadId?: string;
      tenantId?: string;
      from?: Date;
      to?: Date;
      status?: string;
    } = {}
  ) {
    return prisma.marketerTask.findMany({
      where: {
        marketerId,
        ...(filters.leadId ? { leadId: filters.leadId } : {}),
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from || filters.to
          ? {
              dueAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        lead: { select: { id: true, displayCode: true } },
      },
    });
  }

  static async createTask(
    marketerId: string,
    input: {
      title: string;
      body?: string;
      dueAt?: string | Date | null;
      kind?: string;
      leadId?: string | null;
      tenantId?: string | null;
    }
  ) {
    const title = String(input.title || '').trim();
    if (!title) throw badRequest('Укажите заголовок', 'title');
    const kind = input.kind || 'TASK';
    if (!TASK_KINDS.has(kind)) throw badRequest('Некорректный тип', 'kind');

    if (input.leadId) {
      const lead = await prisma.marketerLead.findFirst({
        where: { id: input.leadId, marketerId },
      });
      if (!lead) throw badRequest('Лид не найден', 'leadId');
    }
    if (input.tenantId) {
      const link = await prisma.tenantMarketer.findFirst({
        where: { tenantId: input.tenantId, marketerId },
      });
      if (!link) throw badRequest('Школа не в вашей базе', 'tenantId');
    }

    let dueAt: Date | null = null;
    if (input.dueAt) {
      dueAt = new Date(input.dueAt);
      if (Number.isNaN(dueAt.getTime())) throw badRequest('Некорректная дата', 'dueAt');
    }

    return prisma.marketerTask.create({
      data: {
        marketerId,
        title,
        body: input.body?.trim() || null,
        dueAt,
        kind,
        leadId: input.leadId || null,
        tenantId: input.tenantId || null,
        status: 'OPEN',
      },
    });
  }

  static async updateTask(
    marketerId: string,
    id: string,
    input: {
      title?: string;
      body?: string | null;
      dueAt?: string | Date | null;
      status?: string;
      kind?: string;
    }
  ) {
    const existing = await prisma.marketerTask.findFirst({ where: { id, marketerId } });
    if (!existing) throw notFound('Задача не найдена');
    if (input.status && !TASK_STATUSES.has(input.status)) {
      throw badRequest('Некорректный статус', 'status');
    }
    if (input.kind && !TASK_KINDS.has(input.kind)) {
      throw badRequest('Некорректный тип', 'kind');
    }
    let dueAt: Date | null | undefined = undefined;
    if (input.dueAt !== undefined) {
      if (input.dueAt === null || input.dueAt === '') dueAt = null;
      else {
        dueAt = new Date(input.dueAt);
        if (Number.isNaN(dueAt.getTime())) throw badRequest('Некорректная дата', 'dueAt');
      }
    }
    return prisma.marketerTask.update({
      where: { id },
      data: {
        ...(input.title != null ? { title: String(input.title).trim() } : {}),
        ...(input.body !== undefined ? { body: input.body?.trim() || null } : {}),
        ...(dueAt !== undefined ? { dueAt } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
      },
    });
  }

  static async listChats(marketerId: string) {
    const threads = await prisma.marketerChatThread.findMany({
      where: { marketerId },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return threads.map((t) => ({
      id: t.id,
      channel: t.channel,
      status: t.status,
      updatedAt: t.updatedAt,
      lastMessage: t.messages[0] || null,
    }));
  }

  static async ensureChat(marketerId: string, channel: string) {
    if (!CHAT_CHANNELS.has(channel)) throw badRequest('Канал недоступен', 'channel');
    return prisma.marketerChatThread.upsert({
      where: { marketerId_channel: { marketerId, channel } },
      create: { marketerId, channel, status: 'OPEN' },
      update: {},
    });
  }

  static async listChatMessages(marketerId: string, threadId: string) {
    const thread = await prisma.marketerChatThread.findFirst({
      where: { id: threadId, marketerId },
    });
    if (!thread) throw notFound('Чат не найден');
    return prisma.marketerChatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
  }

  static async postChatMessage(marketerId: string, threadId: string, body: string) {
    const text = String(body || '').trim();
    if (!text) throw badRequest('Пустое сообщение', 'body');
    const thread = await prisma.marketerChatThread.findFirst({
      where: { id: threadId, marketerId },
    });
    if (!thread) throw notFound('Чат не найден');
    if (thread.status === 'CLOSED') throw badRequest('Чат закрыт');

    const [msg] = await prisma.$transaction([
      prisma.marketerChatMessage.create({
        data: {
          threadId,
          authorType: 'marketer',
          body: text,
          authorMarketerId: marketerId,
        },
      }),
      prisma.marketerChatThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date(), status: 'OPEN' },
      }),
    ]);
    return msg;
  }

  static async getFinance(marketerId: string) {
    const [marketer, items, payouts] = await Promise.all([
      prisma.marketer.findUnique({
        where: { id: marketerId },
        select: {
          balance: true,
          commissionPercentage: true,
          bankName: true,
          bankBik: true,
          bankAccount: true,
          bankRecipient: true,
        },
      }),
      prisma.marketerCommissionLedger.findMany({
        where: { marketerId },
        orderBy: { occurredAt: 'desc' },
        take: 200,
      }),
      prisma.marketerPayoutRequest.findMany({
        where: { marketerId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { document: true, npdReceipt: true },
      }),
    ]);
    const accrued = items
      .filter((i) => i.kind === 'ACCRUAL')
      .reduce((s, i) => s + Number(i.amount), 0);
    const paidOut = items
      .filter((i) => i.kind === 'PAYOUT')
      .reduce((s, i) => s + Number(i.amount), 0);
    const inProcess = payouts
      .filter((p) => p.status === 'PROCESSING' || p.status === 'AWAITING_SIGNATURE')
      .reduce((s, p) => s + Number(p.amount), 0);

    const { MarketerPayoutService } = await import('./marketerPayoutService');
    return {
      balance: Number(marketer?.balance || 0),
      commissionPercentage: Number(marketer?.commissionPercentage || 0),
      accrued,
      paidOut,
      inProcess,
      bank: marketer ? MarketerPayoutService.maskBank(marketer) : null,
      payouts: payouts.map((p) => MarketerPayoutService.serializePayout(p)),
      items: items.map((i) => ({
        ...i,
        amount: Number(i.amount),
        schoolLabel: i.tenantId ? schoolLabelFromId(i.tenantId) : null,
      })),
    };
  }

  static async listPublications() {
    return prisma.platformPublication.findMany({
      where: { isActive: true },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    });
  }

  static async listClosingDocs(marketerId: string) {
    return prisma.marketerClosingDoc.findMany({
      where: { OR: [{ marketerId }, { marketerId: null }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async recordCommissionAccrual(params: {
    marketerId: string;
    tenantId: string;
    amount: number;
    notes?: string;
    externalKey: string;
    occurredAt?: Date;
    commissionType?: 'PERSONAL' | 'REFERRAL';
  }) {
    try {
      await prisma.marketerCommissionLedger.create({
        data: {
          marketerId: params.marketerId,
          tenantId: params.tenantId,
          kind: 'ACCRUAL',
          commissionType: params.commissionType || 'PERSONAL',
          amount: params.amount,
          notes: params.notes || null,
          externalKey: params.externalKey,
          occurredAt: params.occurredAt || new Date(),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') return; // idempotent
      throw e;
    }
  }

  static generateInviteToken(): string {
    return `MKT-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  static async ensureInviteToken(marketerId: string): Promise<string> {
    const existing = await prisma.marketer.findUnique({
      where: { id: marketerId },
      select: { inviteToken: true },
    });
    if (existing?.inviteToken) return existing.inviteToken;

    for (let i = 0; i < 5; i++) {
      const token = this.generateInviteToken();
      try {
        await prisma.marketer.update({
          where: { id: marketerId },
          data: { inviteToken: token },
        });
        return token;
      } catch (e: any) {
        if (e?.code === 'P2002') continue;
        throw e;
      }
    }
    throw badRequest('Не удалось создать токен приглашения');
  }

  static async resolveInviteToken(token: string) {
    const t = String(token || '').trim();
    if (!t) throw badRequest('Укажите токен приглашения');
    const inviter = await prisma.marketer.findFirst({
      where: { inviteToken: t, isActive: true },
      select: { id: true, name: true, inviteToken: true },
    });
    if (!inviter) throw notFound('Приглашение не найдено или недействительно');
    return {
      token: inviter.inviteToken,
      inviterName: inviter.name,
      rule: '5% от первой оплаченной подписки каждой школы приглашённого маркетолога (1 уровень)',
    };
  }

  static async getInviteInfo(marketerId: string) {
    const token = await this.ensureInviteToken(marketerId);
    return {
      token,
      path: `/join/${token}`,
      rulePercent: 5,
      levels: 1,
    };
  }

  static async getTeam(marketerId: string) {
    const token = await this.ensureInviteToken(marketerId);
    const invitees = await prisma.marketer.findMany({
      where: { invitedById: marketerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        isActive: true,
        referredTenants: {
          select: {
            tenantId: true,
            tenant: { select: { id: true, name: true, subdomain: true } },
          },
        },
      },
    });

    const inviteeIds = invitees.map((i) => i.id);
    const referralAccruals = inviteeIds.length
      ? await prisma.marketerCommissionLedger.findMany({
          where: {
            marketerId,
            kind: 'ACCRUAL',
            commissionType: 'REFERRAL',
          },
          orderBy: { occurredAt: 'desc' },
          take: 50,
        })
      : [];

    const paidTenantKeys = new Set(
      referralAccruals
        .map((a) => a.externalKey || '')
        .filter((k) => k.startsWith('referral5:'))
        .map((k) => {
          // referral5:${inviteeId}:${tenantId}
          const parts = k.split(':');
          return parts.length >= 3 ? `${parts[1]}:${parts[2]}` : '';
        })
        .filter(Boolean)
    );

    const members = invitees.map((m) => {
      const clubs = m.referredTenants.length;
      const paidClubs = m.referredTenants.filter((rt) =>
        paidTenantKeys.has(`${m.id}:${rt.tenantId}`)
      ).length;
      const earned = referralAccruals
        .filter((a) => (a.externalKey || '').startsWith(`referral5:${m.id}:`))
        .reduce((s, a) => s + Number(a.amount), 0);
      return {
        id: m.id,
        name: m.name,
        joinedAt: m.createdAt,
        isActive: m.isActive,
        status: clubs === 0 ? 'new' : 'active',
        clubsTotal: clubs,
        clubsPaid: paidClubs,
        earnedReferral: earned,
        clubs: m.referredTenants.map((rt) => ({
          id: rt.tenantId,
          label: rt.tenant?.name || schoolLabelFromId(rt.tenantId),
          paid: paidTenantKeys.has(`${m.id}:${rt.tenantId}`),
        })),
      };
    });

    const stats = {
      marketersInTeam: members.length,
      clubsTotal: members.reduce((s, m) => s + m.clubsTotal, 0),
      clubsPaid: members.reduce((s, m) => s + m.clubsPaid, 0),
      referralEarnedLifetime: referralAccruals.reduce((s, a) => s + Number(a.amount), 0),
    };

    return {
      invite: { token, path: `/join/${token}` },
      stats,
      members,
      recentAccruals: referralAccruals.slice(0, 20).map((a) => ({
        id: a.id,
        amount: Number(a.amount),
        notes: a.notes,
        tenantId: a.tenantId,
        schoolLabel: a.tenantId ? schoolLabelFromId(a.tenantId) : null,
        occurredAt: a.occurredAt,
        externalKey: a.externalKey,
      })),
    };
  }

  static async recordCommissionPayout(params: {
    marketerId: string;
    amount: number;
    notes?: string;
    externalKey: string;
    occurredAt?: Date;
  }) {
    try {
      await prisma.marketerCommissionLedger.create({
        data: {
          marketerId: params.marketerId,
          kind: 'PAYOUT',
          amount: params.amount,
          notes: params.notes || null,
          externalKey: params.externalKey,
          occurredAt: params.occurredAt || new Date(),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') return;
      throw e;
    }
  }

  /** SA: create publication */
  static async createPublication(
    superAdminId: string,
    input: {
      type: string;
      title: string;
      body: string;
      imageUrl?: string;
      fileUrl?: string;
      isActive?: boolean;
    }
  ) {
    if (!PUB_TYPES.has(input.type)) throw badRequest('Некорректный тип', 'type');
    const title = String(input.title || '').trim();
    const body = String(input.body || '').trim();
    if (!title || !body) throw badRequest('Заголовок и текст обязательны');
    return prisma.platformPublication.create({
      data: {
        type: input.type,
        title,
        body,
        imageUrl: input.imageUrl || null,
        fileUrl: input.fileUrl || null,
        isActive: input.isActive !== false,
        createdBySuperAdminId: superAdminId,
      },
    });
  }

  static async createClosingDoc(
    superAdminId: string,
    input: {
      title: string;
      fileUrl: string;
      periodLabel?: string;
      marketerId?: string | null;
    }
  ) {
    const title = String(input.title || '').trim();
    const fileUrl = String(input.fileUrl || '').trim();
    if (!title || !fileUrl) throw badRequest('Заголовок и файл обязательны');
    return prisma.marketerClosingDoc.create({
      data: {
        title,
        fileUrl,
        periodLabel: input.periodLabel || null,
        marketerId: input.marketerId || null,
        uploadedBySuperAdminId: superAdminId,
      },
    });
  }
}
