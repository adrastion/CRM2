import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
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
    tenant: {
      id: string;
      subscription: { planType: string; status: string } | null;
    };
  }
) {
  const planType = row.tenant.subscription?.planType || 'FREE';
  const subStatus = row.tenant.subscription?.status || 'active';
  const billing: 'active' | 'free' =
    isPaidPlan(planType) && subStatus === 'active' ? 'active' : 'free';
  const linkedLead = await prisma.marketerLead.findFirst({
    where: { marketerId, convertedTenantId: row.tenantId },
    select: { id: true, displayCode: true },
  });
  return {
    id: row.tenantId,
    kind: 'school' as const,
    displayCode: schoolLabelFromId(row.tenantId),
    maskedName: null as string | null,
    maskedEmail: null as string | null,
    maskedPhone: null as string | null,
    status: billing,
    planType,
    subscriptionStatus: subStatus,
    linkedAt: row.createdAt,
    leadId: linkedLead?.id || null,
    leadDisplayCode: linkedLead?.displayCode || null,
  };
}

export class MarketerCabinetService {
  static async getDashboard(marketerId: string) {
    const [leads, schools, urgentTasks, publications, accruals, docs, marketer] =
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
      ]);

    let activeSchools = 0;
    let freeSchools = 0;
    for (const s of schools) {
      const plan = s.tenant.subscription?.planType || 'FREE';
      const st = s.tenant.subscription?.status || 'active';
      if (isPaidPlan(plan) && st === 'active') activeSchools += 1;
      else freeSchools += 1;
    }

    return {
      clients: {
        total: leads + schools.length,
        leads,
        schools: schools.length,
        active: activeSchools,
        free: freeSchools,
      },
      balance: Number(marketer?.balance || 0),
      commissionPercentage: Number(marketer?.commissionPercentage || 0),
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
    const [leads, schools] = await Promise.all([
      prisma.marketerLead.findMany({
        where: { marketerId },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.tenantMarketer.findMany({
        where: { marketerId },
        include: { tenant: { include: { subscription: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const schoolRows = await Promise.all(
      schools.map((s) => serializeSchoolClient(marketerId, s))
    );
    return {
      leads: leads.map(serializeLead),
      schools: schoolRows,
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
    return {
      client: await serializeSchoolClient(marketerId, link),
      tasks,
    };
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
    const [marketer, items] = await Promise.all([
      prisma.marketer.findUnique({
        where: { id: marketerId },
        select: { balance: true, commissionPercentage: true },
      }),
      prisma.marketerCommissionLedger.findMany({
        where: { marketerId },
        orderBy: { occurredAt: 'desc' },
        take: 200,
      }),
    ]);
    const accrued = items
      .filter((i) => i.kind === 'ACCRUAL')
      .reduce((s, i) => s + Number(i.amount), 0);
    const paidOut = items
      .filter((i) => i.kind === 'PAYOUT')
      .reduce((s, i) => s + Number(i.amount), 0);
    return {
      balance: Number(marketer?.balance || 0),
      commissionPercentage: Number(marketer?.commissionPercentage || 0),
      accrued,
      paidOut,
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
  }) {
    try {
      await prisma.marketerCommissionLedger.create({
        data: {
          marketerId: params.marketerId,
          tenantId: params.tenantId,
          kind: 'ACCRUAL',
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
