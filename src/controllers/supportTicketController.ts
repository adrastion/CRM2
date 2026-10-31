import { prisma } from '../lib/prisma';
import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { ClientRequest } from '../middleware/clientAuth';
import {
  absoluteUploadPath,
  contentDispositionAttachment,
  contentDispositionInline,
  safeUnlink,
} from '../utils/fileStorage';
import type { SupportRequester } from '../middleware/supportRequesterAuth';
import {
  computeStaffUnreadCount,
  computeUnreadCount,
  isAllowedSupportAttachmentMime,
  isStaffAuthorType,
  parseSupportTicketKind,
  prepareSupportAttachmentFile,
  serializeAttachment,
  serializeSupportMessage,
  supportStatusLabel,
  waitingMinutesSince,
  SUPPORT_ATTACHMENT_MAX_FILES,
} from '../services/supportTicketHelpers';
import { SupportPromoService } from '../services/supportPromoService';
import type { SupportPromoAudience } from '../services/supportPromoService';
import {
  escalateNewTicketIfSupportOffline,
  isSupportStaffOnline,
  notifyRequesterOfStaffReply,
  postSupportAutoReply,
  resolveAutoReply,
  addAutoReplyAttachment,
  removeAutoReplyAttachment,
  getAutoReplyAttachmentFile,
  listAutoReplyAttachments,
} from '../services/supportNotifyService';

const KNOWLEDGE_AUDIENCES = new Set(['school', 'marketer', 'client', 'all']);
const KNOWLEDGE_ICON_KEYS = new Set([
  'business',
  'groups',
  'wallet',
  'build',
  'settings',
  'event',
  'membership',
  'person',
]);

function serializeKnowledgeArticle(a: {
  id: string;
  title: string;
  body: string;
  category: string | null;
  audience: string;
  hint: string | null;
  topic: string | null;
  iconKey: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    category: a.category,
    audience: a.audience,
    hint: a.hint,
    topic: a.topic,
    iconKey: a.iconKey,
    sortOrder: a.sortOrder,
    isActive: a.isActive,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function serializeCannedReply(r: {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function saveMessageAttachments(messageId: string, files: Express.Multer.File[] | undefined) {
  const list = (files || []).slice(0, SUPPORT_ATTACHMENT_MAX_FILES);
  const created = [];
  for (const file of list) {
    if (!isAllowedSupportAttachmentMime(file.mimetype)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
      continue;
    }
    const meta = prepareSupportAttachmentFile(file);
    const row = await prisma.supportTicketMessageAttachment.create({
      data: {
        messageId,
        originalName: meta.originalName,
        mimeType: meta.mimeType,
        size: meta.size,
        storagePath: meta.storagePath,
      },
    });
    created.push(serializeAttachment(row));
  }
  return created;
}

function multerFilesFromReq(req: any): Express.Multer.File[] {
  if (Array.isArray(req.files)) return req.files as Express.Multer.File[];
  if (req.files?.files && Array.isArray(req.files.files)) return req.files.files;
  if (req.file) return [req.file as Express.Multer.File];
  return [];
}

function sendSupportAttachmentFile(
  res: Response,
  att: { storagePath: string; mimeType: string; originalName: string }
): void {
  const abs = absoluteUploadPath(att.storagePath);
  if (!fs.existsSync(abs)) {
    res.status(404).json({ success: false, error: 'Файл не найден на диске' });
    return;
  }
  const mime = att.mimeType || 'application/octet-stream';
  const inline = mime.startsWith('image/') || mime === 'application/pdf';
  res.setHeader('Content-Type', mime);
  res.setHeader(
    'Content-Disposition',
    inline
      ? contentDispositionInline(att.originalName || 'file')
      : contentDispositionAttachment(att.originalName || 'file')
  );
  fs.createReadStream(abs).pipe(res);
}

function audienceFromRequester(req: any): SupportPromoAudience {
  const requester = req.supportRequester as SupportRequester | undefined;
  if (requester?.kind === 'MARKETER') return 'marketer';
  const clientReq = req as ClientRequest;
  if (clientReq.client?.id || clientReq.parent?.id) return 'client';
  return 'school';
}

async function resolveAccountCreatedAt(req: any): Promise<Date | null> {
  const requester = req.supportRequester as SupportRequester | undefined;
  if (requester?.kind === 'MARKETER' && requester.marketerId) {
    const m = await prisma.marketer.findUnique({
      where: { id: requester.marketerId },
      select: { createdAt: true },
    });
    return m?.createdAt || null;
  }
  const clientReq = req as ClientRequest;
  if (clientReq.client?.id) {
    const c = await prisma.client.findUnique({
      where: { id: clientReq.client.id },
      select: { createdAt: true },
    });
    return c?.createdAt || null;
  }
  if (clientReq.parent?.id) {
    const p = await prisma.parent.findUnique({
      where: { id: clientReq.parent.id },
      select: { createdAt: true },
    });
    return p?.createdAt || null;
  }
  const tenantId = requester?.tenantId || clientReq.client?.tenantId || clientReq.parent?.tenantId;
  if (tenantId) {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { createdAt: true },
    });
    return t?.createdAt || null;
  }
  return null;
}

export const getSupportConfig = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const audience = audienceFromRequester(req);
  const accountCreatedAt = await resolveAccountCreatedAt(req);
  const ctx = { accountCreatedAt };
  const [promos, quickSetupPromoEnabled, faqArticles] = await Promise.all([
    SupportPromoService.listActiveForAudience(audience, ctx),
    SupportPromoService.isQuickSetupAvailable(ctx),
    prisma.supportKnowledgeArticle.findMany({
      where: {
        isActive: true,
        OR: [{ audience: 'all' }, { audience }],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        hint: true,
        topic: true,
        iconKey: true,
        sortOrder: true,
      },
    }),
  ]);
  res.json({
    success: true,
    data: {
      quickSetupPromoEnabled,
      promos,
      faq: faqArticles,
      maxAttachmentFiles: SUPPORT_ATTACHMENT_MAX_FILES,
      maxAttachmentBytes: 10 * 1024 * 1024,
    },
  });
});

/** Сумма непрочитанных ответов поддержки (для красного флажка на кнопке). */
export const requesterSupportUnreadSummary = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const requester = req.supportRequester as SupportRequester | undefined;
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const isMarketer = requester.kind === 'MARKETER';
  const tickets = await prisma.supportTicket.findMany({
    where: {
      tenantId: requester.tenantId,
      channel: 'SUPPORT',
      ...(isMarketer
        ? { marketerId: requester.marketerId }
        : { marketerId: null, clientId: null, parentId: null }),
    },
    select: {
      requesterLastReadAt: true,
      messages: { select: { authorType: true, createdAt: true } },
    },
  });
  let unreadTotal = 0;
  for (const t of tickets) {
    unreadTotal += computeUnreadCount({
      requesterLastReadAt: t.requesterLastReadAt,
      messages: t.messages,
    });
  }
  res.json({ success: true, data: { unreadTotal } });
});

export const clientSupportUnreadSummary = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const tenantId = req.client?.tenantId ?? req.parent?.tenantId;
  const clientId = req.client?.id;
  const parentId = req.parent?.id;
  if (!tenantId || (!clientId && !parentId)) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const tickets = await prisma.supportTicket.findMany({
    where: {
      tenantId,
      channel: 'SUPPORT',
      OR: [
        ...(clientId ? [{ clientId }] : []),
        ...(parentId ? [{ parentId }] : []),
      ],
    },
    select: {
      requesterLastReadAt: true,
      messages: { select: { authorType: true, createdAt: true } },
    },
  });
  let unreadTotal = 0;
  for (const t of tickets) {
    unreadTotal += computeUnreadCount({
      requesterLastReadAt: t.requesterLastReadAt,
      messages: t.messages,
    });
  }
  res.json({ success: true, data: { unreadTotal } });
});

async function resolvePromoTicketFields(
  input: {
    promoId?: string;
    kindRaw?: string;
    subject?: string;
    message?: string;
  },
  ctx?: { accountCreatedAt?: Date | null }
): Promise<{ kind: 'GENERAL' | 'QUICK_SETUP'; subject: string | null; message: string }> {
  if (input.promoId) {
    const promo = await SupportPromoService.getActiveById(String(input.promoId), ctx);
    if (!promo) {
      throw Object.assign(new Error('Акция сейчас недоступна'), { statusCode: 400 });
    }
    const kind = parseSupportTicketKind(promo.ticketKind);
    return {
      kind,
      subject: (input.subject?.trim() || promo.ticketSubject || promo.title || null) as string | null,
      message:
        input.message?.trim() ||
        promo.defaultMessage ||
        promo.description ||
        promo.title,
    };
  }
  const kind = parseSupportTicketKind(input.kindRaw);
  if (kind === 'QUICK_SETUP') {
    const ok = await SupportPromoService.isQuickSetupAvailable(ctx);
    if (!ok) {
      throw Object.assign(new Error('Акция «Быстрая настройка» сейчас недоступна'), {
        statusCode: 400,
      });
    }
  }
  return {
    kind,
    subject:
      input.subject?.trim() || (kind === 'QUICK_SETUP' ? 'Быстрая настройка' : null),
    message: input.message?.trim() || '',
  };
}

async function afterSupportTicketCreated(opts: {
  ticket: {
    id: string;
    tenantId: string;
    subject?: string | null;
    kind?: string | null;
    channel: string;
  };
  promoId?: string | null;
}) {
  if (opts.ticket.channel !== 'SUPPORT') return;
  try {
    const autoReply = await resolveAutoReply(opts.promoId);
    if (autoReply) await postSupportAutoReply(opts.ticket.id, autoReply);
  } catch (e) {
    console.error('[support] auto-reply failed', e);
  }
  try {
    await escalateNewTicketIfSupportOffline(opts.ticket);
  } catch (e) {
    console.error('[support] offline escalate failed', e);
  }
}

/** Горячая линия: техподдержка; дизайн — только OWNER школы. */
const CLIENT_TICKET_CHANNELS = ['SUPPORT', 'DESIGNER'] as const;
type ClientTicketChannel = (typeof CLIENT_TICKET_CHANNELS)[number];

function canContactDesigners(requester: SupportRequester | undefined): boolean {
  return requester?.kind === 'TENANT_USER' && requester.role === 'OWNER';
}

/** Внутренний чат дизайнера платформы с супер-админами (не горячая линия). */
export const DESIGNER_SUPERADMIN_CHANNEL = 'DESIGNER_SUPERADMIN';

const PLATFORM_INTERNAL_SUBDOMAIN = '__platform_internal__';

function isClientChannel(s: string): s is ClientTicketChannel {
  return (CLIENT_TICKET_CHANNELS as readonly string[]).includes(s);
}

/** Фильтр в админке / SECURITY: все каналы обращений. */
function isListableChannel(s: string): boolean {
  return isClientChannel(s) || s === DESIGNER_SUPERADMIN_CHANNEL;
}

async function getPlatformInternalTenantId(): Promise<string> {
  const existing = await prisma.tenant.findUnique({
    where: { subdomain: PLATFORM_INTERNAL_SUBDOMAIN },
  });
  if (existing) return existing.id;
  try {
    const created = await prisma.tenant.create({
      data: {
        name: 'Платформа (служебный тенант)',
        subdomain: PLATFORM_INTERNAL_SUBDOMAIN,
        email: 'platform-internal-system@crm.local',
      },
    });
    return created.id;
  } catch {
    const again = await prisma.tenant.findUnique({
      where: { subdomain: PLATFORM_INTERNAL_SUBDOMAIN },
    });
    if (again) return again.id;
    throw new Error('Не удалось создать внутреннюю организацию платформы');
  }
}

/** Постоянный чат дизайнера с командой супер-админов; виден и доступен на запись всем SuperAdmin. */
export async function ensureDesignerSuperAdminLiaisonTicket(staffId: string) {
  const found = await prisma.supportTicket.findFirst({
    where: { channel: DESIGNER_SUPERADMIN_CHANNEL, assignedStaffId: staffId },
  });
  if (found) return found;

  const tenantId = await getPlatformInternalTenantId();
  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId,
        channel: DESIGNER_SUPERADMIN_CHANNEL,
        status: 'ASSIGNED',
        assignedStaffId: staffId,
        subject: 'Супер-администраторы платформы',
      },
    });
    await prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorType: 'super_admin',
        body:
          'Общий чат дизайнера с супер-администраторами. Сообщения читают и пишут все супер-админы; это не клиентская горячая линия.',
        authorSuperAdminId: null,
      },
    });
    return ticket;
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'P2002') {
      const again = await prisma.supportTicket.findFirst({
        where: { channel: DESIGNER_SUPERADMIN_CHANNEL, assignedStaffId: staffId },
      });
      if (again) return again;
    }
    throw e;
  }
}

export function designerCanAccessTicket(
  staff: { id: string; role: string },
  ticket: { channel: string; assignedStaffId: string | null }
): boolean {
  if (staff.role === 'SECURITY') return true;
  if (staff.role !== 'DESIGNER') return false;
  if (ticket.channel === DESIGNER_SUPERADMIN_CHANNEL) {
    return ticket.assignedStaffId === staff.id;
  }
  return ticket.channel === 'DESIGNER';
}

// --- Authenticated non-client users (tenant staff / marketers / promo admins) ---

function requesterTicketWhere(
  requester: SupportRequester,
  ticketId: string,
  channel?: ClientTicketChannel
) {
  const isMarketer = requester.kind === 'MARKETER';
  return {
    id: ticketId,
    tenantId: requester.tenantId,
    clientId: null,
    parentId: null,
    marketerId: isMarketer ? requester.marketerId : null,
    ...(channel ? { channel } : { channel: { in: ['SUPPORT', 'DESIGNER'] } }),
  };
}

export const requesterCreateSupportTicket = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const requester = req.supportRequester as SupportRequester | undefined;
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const { subject, message, channel, kind: kindRaw, promoId } = req.body as {
    subject?: string;
    message?: string;
    channel?: string;
    kind?: string;
    promoId?: string;
  };
  const accountCreatedAt = await resolveAccountCreatedAt(req);
  let resolved: Awaited<ReturnType<typeof resolvePromoTicketFields>>;
  try {
    resolved = await resolvePromoTicketFields(
      {
        promoId,
        kindRaw,
        subject,
        message,
      },
      { accountCreatedAt }
    );
  } catch (e: any) {
    res.status(e?.statusCode || 400).json({ success: false, error: e?.message || 'Ошибка' });
    return;
  }
  if (!resolved.message) {
    res.status(400).json({ success: false, error: 'Укажите сообщение' });
    return;
  }
  const { kind } = resolved;
  // Школьный кабинет создаёт только SUPPORT; DESIGNER оставляем для совместимости API.
  const ch: ClientTicketChannel =
    channel && isClientChannel(channel) ? channel : 'SUPPORT';
  if (ch === 'DESIGNER' && !canContactDesigners(requester)) {
    res.status(403).json({ success: false, error: 'Связь с дизайнерами доступна только владельцу школы' });
    return;
  }
  const now = new Date();
  const isMarketer = requester.kind === 'MARKETER';
  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId: requester.tenantId,
      channel: ch,
      kind,
      status: 'WAITING',
      subject: resolved.subject,
      requesterLastReadAt: now,
      marketerId: isMarketer ? requester.marketerId : null,
    },
  });
  const msg = await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      authorType: requester.kind?.toLowerCase() || 'tenant_user',
      body: resolved.message,
    },
  });
  const files = multerFilesFromReq(req);
  const attachments = await saveMessageAttachments(msg.id, files);
  await afterSupportTicketCreated({ ticket, promoId: promoId || null });
  res.status(201).json({
    success: true,
    data: {
      ticket: {
        ...ticket,
        statusLabel: supportStatusLabel(ticket.status, { hasStaffReply: false }),
        kind,
      },
      message: { ...msg, attachments },
    },
  });
});

export const requesterListSupportTickets = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const requester = req.supportRequester as SupportRequester | undefined;
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const isMarketer = requester.kind === 'MARKETER';
  // Единый канал SUPPORT: школа — без marketerId; маркетолог — свои тикеты.
  const tickets = await prisma.supportTicket.findMany({
    where: {
      tenantId: requester.tenantId,
      clientId: null,
      parentId: null,
      channel: 'SUPPORT',
      marketerId: isMarketer ? requester.marketerId : null,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, createdAt: true, authorType: true },
      },
    },
  });

  const withMeta = await Promise.all(
    tickets.map(async (t) => {
      const allMsgs = await prisma.supportTicketMessage.findMany({
        where: { ticketId: t.id },
        select: { authorType: true, createdAt: true },
      });
      const hasStaffReply = allMsgs.some((m) => isStaffAuthorType(m.authorType));
      const unreadCount = computeUnreadCount({
        requesterLastReadAt: t.requesterLastReadAt,
        messages: allMsgs,
      });
      const last = t.messages[0];
      return {
        id: t.id,
        channel: t.channel,
        kind: t.kind,
        status: t.status,
        statusLabel: supportStatusLabel(t.status, { hasStaffReply }),
        subject: t.subject,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        messageCount: t._count.messages,
        lastMessagePreview: last?.body?.slice(0, 120) || '',
        lastMessageAt: last?.createdAt || t.updatedAt,
        unreadCount,
      };
    })
  );

  res.json({ success: true, data: { tickets: withMeta } });
});

export const requesterGetSupportMessages = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const requester = req.supportRequester as SupportRequester | undefined;
  const { ticketId } = req.params;
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const ticket = await prisma.supportTicket.findFirst({
    where: requesterTicketWhere(requester, ticketId, 'SUPPORT'),
  });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Обращение не найдено' });
    return;
  }
  const messages = await prisma.supportTicketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    include: { attachments: true },
  });
  const hasStaffReply = messages.some((m) => isStaffAuthorType(m.authorType));
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { requesterLastReadAt: new Date() },
  });
  res.json({
    success: true,
    data: {
      ticket: {
        ...ticket,
        statusLabel: supportStatusLabel(ticket.status, { hasStaffReply }),
        kind: ticket.kind,
      },
      messages: messages.map((m) => ({
        ...m,
        attachments: (m.attachments || []).map(serializeAttachment),
      })),
      callRecordings: [],
      },
    });
});

export const requesterPostSupportMessage = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const requester = req.supportRequester as SupportRequester | undefined;
  const { ticketId } = req.params;
  const { message } = req.body as { message?: string };
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const bodyText = String(message || '').trim();
  const files = multerFilesFromReq(req);
  if (!bodyText && files.length === 0) {
    res.status(400).json({ success: false, error: 'Укажите сообщение или приложите файл' });
    return;
  }
  const ticket = await prisma.supportTicket.findFirst({
    where: requesterTicketWhere(requester, ticketId, 'SUPPORT'),
  });
  if (!ticket || ticket.status === 'CLOSED') {
    res.status(404).json({ success: false, error: 'Обращение не найдено или закрыто' });
    return;
  }
  const msg = await prisma.supportTicketMessage.create({
    data: {
      ticketId,
      authorType: requester.kind?.toLowerCase() || 'tenant_user',
      body: bodyText || 'Вложение',
    },
  });
  const attachments = await saveMessageAttachments(msg.id, files);
  const now = new Date();
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      updatedAt: now,
      status: ticket.assignedStaffId ? 'ASSIGNED' : 'WAITING',
      requesterLastReadAt: now,
    },
  });
  res.status(201).json({ success: true, data: { message: { ...msg, attachments } } });
});

export const requesterGetSupportAttachment = asyncHandler(async (req: any, res: Response) => {
  const requester = req.supportRequester as SupportRequester | undefined;
  const { attachmentId } = req.params;
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const att = await prisma.supportTicketMessageAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      message: {
        include: { ticket: true },
      },
    },
  });
  const t = att?.message.ticket;
  const marketerOk =
    requester.kind === 'MARKETER'
      ? t?.marketerId === requester.marketerId
      : !t?.marketerId;
  if (
    !att ||
    !t ||
    t.tenantId !== requester.tenantId ||
    t.clientId ||
    t.parentId ||
    t.channel !== 'SUPPORT' ||
    !marketerOk
  ) {
    res.status(404).json({ success: false, error: 'Файл не найден' });
    return;
  }
  sendSupportAttachmentFile(res, att);
});

export const requesterUploadDesignerCallRecording = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const requester = req.supportRequester as SupportRequester | undefined;
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  if (!canContactDesigners(requester)) {
    res.status(403).json({ success: false, error: 'Связь с дизайнерами доступна только владельцу школы' });
    return;
  }
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ success: false, error: 'Требуется файл' });
    return;
  }
  const { ticketId } = req.params;
  const { startedAt, endedAt, durationSec } = req.body as {
    startedAt?: string;
    endedAt?: string;
    durationSec?: string;
  };
  const ticket = await prisma.supportTicket.findFirst({
    where: requesterTicketWhere(requester, ticketId, 'DESIGNER'),
  });
  if (!ticket || ticket.status === 'CLOSED') {
    fs.unlinkSync(file.path);
    res.status(404).json({ success: false, error: 'Заявка дизайнера не найдена или закрыта' });
    return;
  }
  const relPath = `call-recordings/${file.filename}`;
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const rec = await prisma.designerCallRecording.create({
    data: {
      ticketId,
      storagePath: relPath,
      mimeType: file.mimetype || 'application/octet-stream',
      durationSec: durationSec ? parseInt(durationSec, 10) : null,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      endedAt: endedAt ? new Date(endedAt) : null,
      expiresAt,
      recordedByStaffId: null,
      uploadedByRequesterKind: requester.kind,
      uploadedByRequesterId: requester.id,
    },
  });
  res.status(201).json({ success: true, data: { recording: rec } });
});

// --- Client / parent (client-auth) ---

export const clientCreateSupportTicket = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const tenantId = req.client?.tenantId ?? req.parent?.tenantId;
  const clientId = req.client?.id;
  const parentId = req.parent?.id;
  if (!tenantId || (!clientId && !parentId)) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const { channel, subject, message, kind: kindRaw, promoId } = req.body as {
    channel?: string;
    subject?: string;
    message?: string;
    kind?: string;
    promoId?: string;
  };
  if (channel === 'DESIGNER') {
    res.status(403).json({ success: false, error: 'Связь с дизайнерами недоступна' });
    return;
  }
  if (channel && channel !== 'SUPPORT') {
    res.status(400).json({ success: false, error: 'channel должен быть SUPPORT' });
    return;
  }
  const accountCreatedAt = await resolveAccountCreatedAt(req);
  let resolved: Awaited<ReturnType<typeof resolvePromoTicketFields>>;
  try {
    resolved = await resolvePromoTicketFields(
      {
        promoId,
        kindRaw,
        subject,
        message,
      },
      { accountCreatedAt }
    );
  } catch (e: any) {
    res.status(e?.statusCode || 400).json({ success: false, error: e?.message || 'Ошибка' });
    return;
  }
  if (!resolved.message) {
    res.status(400).json({ success: false, error: 'Укажите сообщение' });
    return;
  }
  const { kind } = resolved;
  const now = new Date();
  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId,
      channel: 'SUPPORT',
      kind,
      status: 'WAITING',
      clientId: clientId ?? null,
      parentId: parentId ?? null,
      subject: resolved.subject,
      requesterLastReadAt: now,
    },
  });
  const msg = await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      authorType: clientId ? 'client' : 'parent',
      body: resolved.message,
      authorClientId: clientId ?? null,
      authorParentId: parentId ?? null,
    },
  });
  const attachments = await saveMessageAttachments(msg.id, multerFilesFromReq(req));
  await afterSupportTicketCreated({ ticket, promoId: promoId || null });
  res.status(201).json({
    success: true,
    data: {
      ticket: { ...ticket, statusLabel: supportStatusLabel(ticket.status, { hasStaffReply: false }) },
      message: { ...msg, attachments },
    },
  });
});

export const clientListSupportTickets = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const tenantId = req.client?.tenantId ?? req.parent?.tenantId;
  const clientId = req.client?.id;
  const parentId = req.parent?.id;
  if (!tenantId || (!clientId && !parentId)) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const tickets = await prisma.supportTicket.findMany({
    where: {
      tenantId,
      channel: 'SUPPORT',
      OR: [{ clientId: clientId ?? undefined }, { parentId: parentId ?? undefined }],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, createdAt: true, authorType: true },
      },
    },
  });
  const withMeta = await Promise.all(
    tickets.map(async (t) => {
      const allMsgs = await prisma.supportTicketMessage.findMany({
        where: { ticketId: t.id },
        select: { authorType: true, createdAt: true },
      });
      const hasStaffReply = allMsgs.some((m) => isStaffAuthorType(m.authorType));
      return {
        id: t.id,
        channel: t.channel,
        kind: t.kind,
        status: t.status,
        statusLabel: supportStatusLabel(t.status, { hasStaffReply }),
        subject: t.subject,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        messageCount: t._count.messages,
        lastMessagePreview: t.messages[0]?.body?.slice(0, 120) || '',
        lastMessageAt: t.messages[0]?.createdAt || t.updatedAt,
        unreadCount: computeUnreadCount({
          requesterLastReadAt: t.requesterLastReadAt,
          messages: allMsgs,
        }),
      };
    })
  );
  res.json({ success: true, data: { tickets: withMeta } });
});

export const clientGetSupportMessages = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const tenantId = req.client?.tenantId ?? req.parent?.tenantId;
  const clientId = req.client?.id;
  const parentId = req.parent?.id;
  const { ticketId } = req.params;
  if (!tenantId || (!clientId && !parentId)) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      tenantId,
      channel: 'SUPPORT',
      OR: [{ clientId: clientId ?? undefined }, { parentId: parentId ?? undefined }],
    },
  });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Обращение не найдено' });
    return;
  }
  const messages = await prisma.supportTicketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    include: { attachments: true },
  });
  const hasStaffReply = messages.some((m) => isStaffAuthorType(m.authorType));
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { requesterLastReadAt: new Date() },
  });
  res.json({
    success: true,
    data: {
      ticket: {
        ...ticket,
        statusLabel: supportStatusLabel(ticket.status, { hasStaffReply }),
      },
      messages: messages.map((m) => ({
        ...m,
        attachments: (m.attachments || []).map(serializeAttachment),
      })),
    },
  });
});

export const clientPostSupportMessage = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const tenantId = req.client?.tenantId ?? req.parent?.tenantId;
  const clientId = req.client?.id;
  const parentId = req.parent?.id;
  const { ticketId } = req.params;
  const { message } = req.body as { message?: string };
  if (!tenantId || (!clientId && !parentId)) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const bodyText = String(message || '').trim();
  const files = multerFilesFromReq(req);
  if (!bodyText && files.length === 0) {
    res.status(400).json({ success: false, error: 'Укажите сообщение или приложите файл' });
    return;
  }
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      tenantId,
      channel: 'SUPPORT',
      OR: [{ clientId: clientId ?? undefined }, { parentId: parentId ?? undefined }],
    },
  });
  if (!ticket || ticket.status === 'CLOSED') {
    res.status(404).json({ success: false, error: 'Обращение не найдено или закрыто' });
    return;
  }
  const msg = await prisma.supportTicketMessage.create({
    data: {
      ticketId,
      authorType: clientId ? 'client' : 'parent',
      body: bodyText || 'Вложение',
      authorClientId: clientId ?? null,
      authorParentId: parentId ?? null,
    },
  });
  const attachments = await saveMessageAttachments(msg.id, files);
  const now = new Date();
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      updatedAt: now,
      status: ticket.assignedStaffId ? 'ASSIGNED' : 'WAITING',
      requesterLastReadAt: now,
    },
  });
  res.status(201).json({ success: true, data: { message: { ...msg, attachments } } });
});

export const clientGetSupportAttachment = asyncHandler(async (req: ClientRequest, res: Response) => {
  const tenantId = req.client?.tenantId ?? req.parent?.tenantId;
  const clientId = req.client?.id;
  const parentId = req.parent?.id;
  const { attachmentId } = req.params;
  if (!tenantId || (!clientId && !parentId)) {
    res.status(401).json({ success: false, error: 'Не авторизован' });
    return;
  }
  const att = await prisma.supportTicketMessageAttachment.findUnique({
    where: { id: attachmentId },
    include: { message: { include: { ticket: true } } },
  });
  const t = att?.message.ticket;
  const owns =
    t &&
    t.tenantId === tenantId &&
    t.channel === 'SUPPORT' &&
    ((clientId && t.clientId === clientId) || (parentId && t.parentId === parentId));
  if (!att || !owns) {
    res.status(404).json({ success: false, error: 'Файл не найден' });
    return;
  }
  sendSupportAttachmentFile(res, att);
});

// --- Platform staff ---

export const staffListTickets = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const staff = req.platformStaff;
  if (staff.role === 'SECURITY') {
    const channel = req.query.channel as string | undefined;
    const tickets = await prisma.supportTicket.findMany({
      where: channel && isListableChannel(channel) ? { channel } : {},
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        parent: { select: { id: true, fullName: true, email: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
    res.json({ success: true, data: { tickets } });
    return;
  }
  if (staff.role === 'DESIGNER') {
    const status = req.query.status as string | undefined;
    const liaison = await ensureDesignerSuperAdminLiaisonTicket(staff.id);
    const clientDesignerTickets = await prisma.supportTicket.findMany({
      where: {
        channel: 'DESIGNER',
        ...(status ? { status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        parent: { select: { id: true, fullName: true, email: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const liaisonFull = await prisma.supportTicket.findUnique({
      where: { id: liaison.id },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        parent: { select: { id: true, fullName: true, email: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const tickets = liaisonFull
      ? [liaisonFull, ...clientDesignerTickets.filter((t) => t.id !== liaisonFull.id)]
      : clientDesignerTickets;
    res.json({ success: true, data: { tickets } });
    return;
  }
  const myChannel: ClientTicketChannel = 'SUPPORT';
  const status = req.query.status as string | undefined;
  const waitingReply =
    req.query.waitingReply === '1' ||
    req.query.waitingReply === 'true' ||
    req.query.waitingReply === true;
  const tickets = await prisma.supportTicket.findMany({
    where: {
      channel: myChannel,
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      tenant: { select: { id: true, name: true, subdomain: true } },
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      parent: { select: { id: true, fullName: true, email: true } },
      marketer: { select: { id: true, name: true, email: true, firstName: true, lastName: true } },
      assignedStaff: { select: { id: true, firstName: true, lastName: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { authorType: true, createdAt: true, body: true },
      },
    },
  });
  let rows = tickets.map((t) => {
    const msgs = t.messages || [];
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    const hasStaffReply = msgs.some((m) => isStaffAuthorType(m.authorType));
    const needsReply = !!last && !isStaffAuthorType(last.authorType) && t.status !== 'CLOSED';
    const { messages: _m, ...rest } = t;
    return {
      ...rest,
      statusLabel: supportStatusLabel(t.status, { hasStaffReply }),
      lastMessage: last
        ? { body: last.body, authorType: last.authorType, createdAt: last.createdAt }
        : null,
      needsReply,
      unreadCount: computeStaffUnreadCount({
        staffLastReadAt: t.staffLastReadAt,
        messages: msgs,
      }),
    };
  });
  if (waitingReply) rows = rows.filter((t) => t.needsReply);
  res.json({ success: true, data: { tickets: rows } });
});

export const staffClaimTicket = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const staff = req.platformStaff;
  if (staff.role === 'SECURITY') {
    res.status(403).json({ success: false, error: 'Роль только для чтения' });
    return;
  }
  const { ticketId } = req.params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Не найдено' });
    return;
  }
  if (ticket.channel === DESIGNER_SUPERADMIN_CHANNEL) {
    res.status(400).json({
      success: false,
      error: 'Это постоянный чат с супер-админами, взять в работу не требуется',
    });
    return;
  }
  const needChannel: ClientTicketChannel = staff.role === 'DESIGNER' ? 'DESIGNER' : 'SUPPORT';
  if (ticket.channel !== needChannel) {
    res.status(403).json({ success: false, error: 'Неверный канал для вашей роли' });
    return;
  }
  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { assignedStaffId: staff.id, status: 'ASSIGNED', updatedAt: new Date() },
  });
  res.json({ success: true, data: { ticket: updated } });
});

export const staffGetTicketMessages = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const staff = req.platformStaff;
  const { ticketId } = req.params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Не найдено' });
    return;
  }
  if (staff.role !== 'SECURITY') {
    if (staff.role === 'SUPPORT') {
      if (ticket.channel !== 'SUPPORT') {
        res.status(403).json({ success: false, error: 'Доступ запрещён' });
        return;
      }
    } else if (!designerCanAccessTicket(staff, ticket)) {
      res.status(403).json({ success: false, error: 'Доступ запрещён' });
      return;
    }
  }
  const messages = await prisma.supportTicketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    include: { attachments: true },
  });
  if (staff.role !== 'SECURITY') {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { staffLastReadAt: new Date() },
    });
  }
  res.json({
    success: true,
    data: {
      ticket,
      messages: messages.map((m) => serializeSupportMessage(m)),
    },
  });
});

export const staffCloseTicket = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const staff = req.platformStaff;
  if (staff.role === 'SECURITY') {
    res.status(403).json({ success: false, error: 'Роль только для чтения' });
    return;
  }
  const { ticketId } = req.params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Не найдено' });
    return;
  }
  if (ticket.channel === DESIGNER_SUPERADMIN_CHANNEL) {
    res.status(400).json({ success: false, error: 'Внутренний чат нельзя закрыть' });
    return;
  }
  if (staff.role === 'SUPPORT' && ticket.channel !== 'SUPPORT') {
    res.status(403).json({ success: false, error: 'Доступ запрещён' });
    return;
  }
  if (staff.role === 'DESIGNER' && ticket.channel !== 'DESIGNER') {
    res.status(403).json({ success: false, error: 'Доступ запрещён' });
    return;
  }
  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: 'CLOSED', closedAt: new Date(), updatedAt: new Date() },
  });
  res.json({ success: true, data: { ticket: updated } });
});

export const staffGetSupportAttachment = asyncHandler(async (req: any, res: Response) => {
  const staff = req.platformStaff;
  const { attachmentId } = req.params;
  const att = await prisma.supportTicketMessageAttachment.findUnique({
    where: { id: attachmentId },
    include: { message: { include: { ticket: true } } },
  });
  const ticket = att?.message?.ticket;
  if (!att || !ticket) {
    res.status(404).json({ success: false, error: 'Файл не найден' });
    return;
  }
  if (staff.role !== 'SECURITY') {
    if (staff.role === 'SUPPORT' && ticket.channel !== 'SUPPORT') {
      res.status(403).json({ success: false, error: 'Доступ запрещён' });
      return;
    }
    if (staff.role === 'DESIGNER' && !designerCanAccessTicket(staff, ticket)) {
      res.status(403).json({ success: false, error: 'Доступ запрещён' });
      return;
    }
  }
  sendSupportAttachmentFile(res, att);
});

export const staffPostTicketMessage = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const staff = req.platformStaff;
  if (staff.role === 'SECURITY') {
    res.status(403).json({ success: false, error: 'Роль только для чтения' });
    return;
  }
  const { ticketId } = req.params;
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json({ success: false, error: 'Укажите сообщение' });
    return;
  }
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.status === 'CLOSED') {
    res.status(404).json({ success: false, error: 'Не найдено или закрыто' });
    return;
  }
  if (staff.role === 'SUPPORT') {
    if (ticket.channel !== 'SUPPORT') {
      res.status(403).json({ success: false, error: 'Доступ запрещён' });
      return;
    }
  } else if (!designerCanAccessTicket(staff, ticket)) {
    res.status(403).json({ success: false, error: 'Доступ запрещён' });
    return;
  }
  const msg = await prisma.supportTicketMessage.create({
    data: {
      ticketId,
      authorType: 'platform_staff',
      body: message.trim(),
      authorStaffId: staff.id,
    },
  });
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date(), status: 'ASSIGNED' },
  });
  void notifyRequesterOfStaffReply(ticket).catch((e) =>
    console.error('[support] notify requester failed', e)
  );
  res.status(201).json({ success: true, data: { message: msg } });
});

export const staffListKnowledge = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const staff = req.platformStaff;
  if (staff.role === 'DESIGNER') {
    res.json({ success: true, data: { articles: [] } });
    return;
  }
  const articles = await prisma.supportKnowledgeArticle.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ success: true, data: { articles } });
});

export const staffRegisterCallRecording = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const staff = req.platformStaff;
  if (staff.role !== 'DESIGNER') {
    res.status(403).json({ success: false, error: 'Записи звонков загружают только дизайнеры' });
    return;
  }
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ success: false, error: 'Требуется файл' });
    return;
  }
  const { ticketId, startedAt, endedAt, durationSec } = req.body as {
    ticketId?: string;
    startedAt?: string;
    endedAt?: string;
    durationSec?: string;
  };
  if (!ticketId) {
    fs.unlinkSync(file.path);
    res.status(400).json({ success: false, error: 'Требуется ticketId' });
    return;
  }
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.channel !== 'DESIGNER') {
    fs.unlinkSync(file.path);
    res.status(400).json({ success: false, error: 'Некорректная заявка дизайнера' });
    return;
  }
  const relPath = `call-recordings/${file.filename}`;
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const rec = await prisma.designerCallRecording.create({
    data: {
      ticketId,
      storagePath: relPath,
      mimeType: file.mimetype || 'application/octet-stream',
      durationSec: durationSec ? parseInt(durationSec, 10) : null,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      endedAt: endedAt ? new Date(endedAt) : null,
      expiresAt,
      recordedByStaffId: staff.id,
    },
  });
  res.status(201).json({ success: true, data: { recording: rec } });
});

// --- Super admin ---

function enrichAdminTicketRow(t: {
  id: string;
  tenantId: string;
  channel: string;
  kind: string;
  status: string;
  subject: string | null;
  marketerId: string | null;
  assignedStaffId: string | null;
  staffLastReadAt: Date | null;
  requesterLastReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  tenant: { id: string; name: string; subdomain: string; createdAt?: Date };
  client: { id: string; firstName: string; lastName: string; email: string | null } | null;
  parent: { id: string; fullName: string; email: string | null } | null;
  marketer: {
    id: string;
    name: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  assignedStaff: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    email: string;
  } | null;
  messages: Array<{
    id: string;
    body: string;
    authorType: string;
    createdAt: Date;
    authorStaffId: string | null;
    authorSuperAdminId: string | null;
  }>;
  _count: { messages: number; callRecordings: number };
}) {
  const msgs = t.messages || [];
  const last = msgs.length ? msgs[msgs.length - 1] : null;
  const hasStaffReply = msgs.some((m) => isStaffAuthorType(m.authorType));
  const needsReply = !!last && !isStaffAuthorType(last.authorType) && t.status !== 'CLOSED';
  const unreadCount = computeStaffUnreadCount({
    staffLastReadAt: t.staffLastReadAt,
    messages: msgs,
  });
  const waitFrom = needsReply ? last!.createdAt : null;
  return {
    id: t.id,
    tenantId: t.tenantId,
    channel: t.channel,
    kind: t.kind,
    status: t.status,
    statusLabel: supportStatusLabel(t.status, { hasStaffReply }),
    subject: t.subject,
    marketerId: t.marketerId,
    assignedStaffId: t.assignedStaffId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    closedAt: t.closedAt,
    tenant: t.tenant,
    client: t.client,
    parent: t.parent,
    marketer: t.marketer,
    assignedStaff: t.assignedStaff,
    _count: t._count,
    lastMessage: last
      ? {
          body: last.body,
          authorType: last.authorType,
          createdAt: last.createdAt,
        }
      : null,
    needsReply,
    waitingMinutes: waitingMinutesSince(waitFrom),
    unreadCount,
  };
}

export const superAdminListSupportTickets = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const channel = req.query.channel as string | undefined;
  const tenantId = req.query.tenantId as string | undefined;
  const status = req.query.status as string | undefined;
  const kind = req.query.kind as string | undefined;
  const q = String(req.query.q || '').trim();
  const waitingReply =
    req.query.waitingReply === '1' ||
    req.query.waitingReply === 'true' ||
    req.query.waitingReply === true;

  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(channel && isListableChannel(channel) ? { channel } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(status ? { status: String(status).toUpperCase() } : {}),
      ...(kind ? { kind: parseSupportTicketKind(kind) } : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: 'insensitive' } },
              { tenant: { name: { contains: q, mode: 'insensitive' } } },
              { tenant: { subdomain: { contains: q, mode: 'insensitive' } } },
              { marketer: { email: { contains: q, mode: 'insensitive' } } },
              { marketer: { name: { contains: q, mode: 'insensitive' } } },
              { client: { email: { contains: q, mode: 'insensitive' } } },
              { parent: { email: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 300,
    include: {
      tenant: { select: { id: true, name: true, subdomain: true, createdAt: true } },
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      parent: { select: { id: true, fullName: true, email: true } },
      marketer: { select: { id: true, name: true, email: true, firstName: true, lastName: true } },
      assignedStaff: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          body: true,
          authorType: true,
          createdAt: true,
          authorStaffId: true,
          authorSuperAdminId: true,
        },
      },
      _count: { select: { messages: true, callRecordings: true } },
    },
  });

  let rows = tickets.map((t) => enrichAdminTicketRow(t as any));
  if (waitingReply) {
    rows = rows.filter((t) => t.needsReply);
  }

  const supportOnline = await isSupportStaffOnline();
  res.json({ success: true, data: { tickets: rows, supportOnline } });
});

export const superAdminSupportUnreadTotal = asyncHandler(async (_req: any, res: Response<ApiResponse>) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { status: { not: 'CLOSED' } },
    select: {
      staffLastReadAt: true,
      messages: { select: { authorType: true, createdAt: true } },
    },
    take: 500,
    orderBy: { updatedAt: 'desc' },
  });
  let unreadTotal = 0;
  let waitingReply = 0;
  for (const t of tickets) {
    const n = computeStaffUnreadCount({
      staffLastReadAt: t.staffLastReadAt,
      messages: t.messages,
    });
    unreadTotal += n;
    const last = t.messages.length ? t.messages[t.messages.length - 1] : null;
    if (last && !isStaffAuthorType(last.authorType)) waitingReply += 1;
  }
  const supportOnline = await isSupportStaffOnline();
  res.json({
    success: true,
    data: { unreadTotal, waitingReply, supportOnline },
  });
});

export const superAdminGetSupportMessages = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const { ticketId } = req.params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      tenant: { select: { id: true, name: true, subdomain: true, createdAt: true } },
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      parent: { select: { id: true, fullName: true, email: true } },
      marketer: { select: { id: true, name: true, email: true, firstName: true, lastName: true } },
      assignedStaff: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { attachments: true },
      },
      callRecordings: { orderBy: { startedAt: 'desc' } },
    },
  });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Не найдено' });
    return;
  }
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { staffLastReadAt: new Date() },
  });
  const hasStaffReply = ticket.messages.some((m) => isStaffAuthorType(m.authorType));
  const last = ticket.messages.length ? ticket.messages[ticket.messages.length - 1] : null;
  const needsReply = !!last && !isStaffAuthorType(last.authorType) && ticket.status !== 'CLOSED';
  res.json({
    success: true,
    data: {
      ...ticket,
      statusLabel: supportStatusLabel(ticket.status, { hasStaffReply }),
      needsReply,
      waitingMinutes: waitingMinutesSince(needsReply && last ? last.createdAt : null),
      messages: ticket.messages.map((m) => serializeSupportMessage(m)),
    },
  });
});

export const superAdminCloseSupportTicket = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const { ticketId } = req.params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Не найдено' });
    return;
  }
  if (ticket.channel === DESIGNER_SUPERADMIN_CHANNEL) {
    res.status(400).json({ success: false, error: 'Внутренний чат нельзя закрыть' });
    return;
  }
  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: 'CLOSED', closedAt: new Date(), updatedAt: new Date() },
  });
  res.json({ success: true, data: { ticket: updated } });
});

export const superAdminReopenSupportTicket = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const { ticketId } = req.params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Не найдено' });
    return;
  }
  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: ticket.assignedStaffId ? 'ASSIGNED' : 'WAITING',
      closedAt: null,
      updatedAt: new Date(),
    },
  });
  res.json({ success: true, data: { ticket: updated } });
});

export const superAdminPostSupportMessage = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const superAdmin = req.superAdmin;
  const { ticketId } = req.params;
  const { message } = req.body as { message?: string };
  const files = multerFilesFromReq(req);
  const bodyText = String(message || '').trim();
  if (!bodyText && files.length === 0) {
    res.status(400).json({ success: false, error: 'Укажите сообщение или приложите файл' });
    return;
  }
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.status === 'CLOSED') {
    res.status(404).json({ success: false, error: 'Не найдено или закрыто' });
    return;
  }
  const msg = await prisma.supportTicketMessage.create({
    data: {
      ticketId,
      authorType: 'super_admin',
      body: bodyText || 'Вложение',
      authorSuperAdminId: superAdmin.id,
    },
  });
  const attachments = await saveMessageAttachments(msg.id, files);
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date(), status: ticket.channel === 'SUPPORT' ? 'ASSIGNED' : ticket.status },
  });
  void notifyRequesterOfStaffReply(ticket).catch((e) =>
    console.error('[support] notify requester failed', e)
  );
  res.status(201).json({ success: true, data: { message: { ...msg, attachments } } });
});

export const superAdminGetSupportAttachment = asyncHandler(async (req: any, res: Response) => {
  const { attachmentId } = req.params;
  const att = await prisma.supportTicketMessageAttachment.findUnique({
    where: { id: attachmentId },
    include: { message: { include: { ticket: true } } },
  });
  if (!att?.message?.ticket) {
    res.status(404).json({ success: false, error: 'Файл не найден' });
    return;
  }
  sendSupportAttachmentFile(res, att);
});

export const superAdminListCallRecordings = asyncHandler(async (_req: any, res: Response<ApiResponse>) => {
  const recordings = await prisma.designerCallRecording.findMany({
    orderBy: { startedAt: 'desc' },
    take: 200,
    include: {
      ticket: {
        select: {
          id: true,
          channel: true,
          tenantId: true,
          clientId: true,
          parentId: true,
          tenant: { select: { name: true, subdomain: true } },
        },
      },
      recordedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  // Не отдаём storagePath клиенту — скачивание только через auth endpoint.
  const data = recordings.map(({ storagePath: _sp, ...rest }) => rest);
  res.json({ success: true, data: { recordings: data } });
});

/**
 * GET /super-admin/support/recordings/:id/download — только SA JWT.
 */
export const superAdminDownloadCallRecording = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const rec = await prisma.designerCallRecording.findUnique({ where: { id } });
  if (!rec) {
    res.status(404).json({ success: false, error: 'Не найдено' });
    return;
  }
  if (rec.expiresAt && rec.expiresAt.getTime() < Date.now()) {
    res.status(410).json({ success: false, error: 'Запись истекла' });
    return;
  }

  let abs: string;
  try {
    abs = absoluteUploadPath(rec.storagePath);
  } catch {
    res.status(400).json({ success: false, error: 'Некорректный путь' });
    return;
  }
  if (!fs.existsSync(abs)) {
    res.status(404).json({ success: false, error: 'Файл отсутствует на диске' });
    return;
  }

  const baseName = path.basename(rec.storagePath) || `recording-${rec.id}.webm`;
  res.setHeader('Content-Type', rec.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', contentDispositionAttachment(baseName));
  fs.createReadStream(abs).pipe(res);
});

export const superAdminListKnowledgeArticles = asyncHandler(async (_req: any, res: Response<ApiResponse>) => {
  const articles = await prisma.supportKnowledgeArticle.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({
    success: true,
    data: { articles: articles.map(serializeKnowledgeArticle) },
  });
});

export const superAdminCreateKnowledgeArticle = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const { title, body, category, sortOrder, audience, hint, topic, iconKey, isActive } = req.body as {
    title?: string;
    body?: string;
    category?: string;
    sortOrder?: number;
    audience?: string;
    hint?: string | null;
    topic?: string | null;
    iconKey?: string | null;
    isActive?: boolean;
  };
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ success: false, error: 'Укажите заголовок и текст' });
    return;
  }
  const aud = String(audience || 'all').toLowerCase();
  if (!KNOWLEDGE_AUDIENCES.has(aud)) {
    res.status(400).json({ success: false, error: 'audience: school|marketer|client|all' });
    return;
  }
  const icon = iconKey != null && String(iconKey).trim() ? String(iconKey).trim() : null;
  if (icon && !KNOWLEDGE_ICON_KEYS.has(icon)) {
    res.status(400).json({ success: false, error: 'Некорректный iconKey' });
    return;
  }
  const article = await prisma.supportKnowledgeArticle.create({
    data: {
      title: title.trim(),
      body: body.trim(),
      category: category?.trim() || null,
      audience: aud,
      hint: hint != null ? String(hint).trim() || null : null,
      topic: topic != null ? String(topic).trim() || null : null,
      iconKey: icon,
      sortOrder: sortOrder ?? 0,
      isActive: isActive !== false,
    },
  });
  res.status(201).json({ success: true, data: { article: serializeKnowledgeArticle(article) } });
});

export const superAdminUpdateKnowledgeArticle = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const id = String(req.params.id);
  const existing = await prisma.supportKnowledgeArticle.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Статья не найдена' });
    return;
  }
  const body = req.body || {};
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) {
      res.status(400).json({ success: false, error: 'Укажите заголовок' });
      return;
    }
    data.title = title;
  }
  if (body.body !== undefined) {
    const text = String(body.body || '').trim();
    if (!text) {
      res.status(400).json({ success: false, error: 'Укажите текст' });
      return;
    }
    data.body = text;
  }
  if (body.category !== undefined) {
    data.category = body.category != null ? String(body.category).trim() || null : null;
  }
  if (body.audience !== undefined) {
    const aud = String(body.audience || '').toLowerCase();
    if (!KNOWLEDGE_AUDIENCES.has(aud)) {
      res.status(400).json({ success: false, error: 'audience: school|marketer|client|all' });
      return;
    }
    data.audience = aud;
  }
  if (body.hint !== undefined) {
    data.hint = body.hint != null ? String(body.hint).trim() || null : null;
  }
  if (body.topic !== undefined) {
    data.topic = body.topic != null ? String(body.topic).trim() || null : null;
  }
  if (body.iconKey !== undefined) {
    const icon = body.iconKey != null && String(body.iconKey).trim() ? String(body.iconKey).trim() : null;
    if (icon && !KNOWLEDGE_ICON_KEYS.has(icon)) {
      res.status(400).json({ success: false, error: 'Некорректный iconKey' });
      return;
    }
    data.iconKey = icon;
  }
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

  const article = await prisma.supportKnowledgeArticle.update({
    where: { id },
    data: data as any,
  });
  res.json({ success: true, data: { article: serializeKnowledgeArticle(article) } });
});

export const superAdminDeleteKnowledgeArticle = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const id = String(req.params.id);
  const existing = await prisma.supportKnowledgeArticle.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Статья не найдена' });
    return;
  }
  await prisma.supportKnowledgeArticle.delete({ where: { id } });
  res.json({ success: true, data: {} });
});

export const superAdminListCannedReplies = asyncHandler(async (_req: any, res: Response<ApiResponse>) => {
  const replies = await prisma.supportCannedReply.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ success: true, data: { replies: replies.map(serializeCannedReply) } });
});

export const superAdminCreateCannedReply = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const { title, body, sortOrder, isActive } = req.body as {
    title?: string;
    body?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ success: false, error: 'Укажите название и текст' });
    return;
  }
  const reply = await prisma.supportCannedReply.create({
    data: {
      title: title.trim(),
      body: body.trim(),
      sortOrder: sortOrder ?? 0,
      isActive: isActive !== false,
    },
  });
  res.status(201).json({ success: true, data: { reply: serializeCannedReply(reply) } });
});

export const superAdminUpdateCannedReply = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const id = String(req.params.id);
  const existing = await prisma.supportCannedReply.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Шаблон не найден' });
    return;
  }
  const body = req.body || {};
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) {
      res.status(400).json({ success: false, error: 'Укажите название' });
      return;
    }
    data.title = title;
  }
  if (body.body !== undefined) {
    const text = String(body.body || '').trim();
    if (!text) {
      res.status(400).json({ success: false, error: 'Укажите текст' });
      return;
    }
    data.body = text;
  }
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
  const reply = await prisma.supportCannedReply.update({ where: { id }, data: data as any });
  res.json({ success: true, data: { reply: serializeCannedReply(reply) } });
});

export const superAdminDeleteCannedReply = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const id = String(req.params.id);
  const existing = await prisma.supportCannedReply.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Шаблон не найден' });
    return;
  }
  await prisma.supportCannedReply.delete({ where: { id } });
  res.json({ success: true, data: {} });
});

export const superAdminListSupportPromos = asyncHandler(async (_req: any, res: Response<ApiResponse>) => {
  const promos = await SupportPromoService.listAdmin();
  res.json({ success: true, data: { promos } });
});

export const superAdminReorderSupportPromos = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    await SupportPromoService.reorder(ids);
    const promos = await SupportPromoService.listAdmin();
    res.json({ success: true, data: { promos } });
  } catch (e: any) {
    res.status(e?.statusCode || 400).json({ success: false, error: e?.message || 'Не удалось сохранить порядок' });
  }
});

export const superAdminCreateSupportPromo = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  try {
    const promo = await SupportPromoService.create(req.body || {});
    res.status(201).json({ success: true, data: { promo } });
  } catch (e: any) {
    res.status(e?.statusCode || 400).json({ success: false, error: e?.message || 'Не удалось создать' });
  }
});

export const superAdminUpdateSupportPromo = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  try {
    const promo = await SupportPromoService.update(String(req.params.id), req.body || {});
    res.json({ success: true, data: { promo } });
  } catch (e: any) {
    res.status(e?.statusCode || 400).json({ success: false, error: e?.message || 'Не удалось сохранить' });
  }
});

export const superAdminDeleteSupportPromo = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  try {
    await SupportPromoService.remove(String(req.params.id));
    res.json({ success: true, data: {} });
  } catch (e: any) {
    res.status(e?.statusCode || 400).json({ success: false, error: e?.message || 'Не удалось удалить' });
  }
});

export const superAdminGetSupportAutoReplySettings = asyncHandler(
  async (_req: any, res: Response<ApiResponse>) => {
    let settings = await prisma.superAdminSettings.findFirst();
    if (!settings) {
      settings = await prisma.superAdminSettings.create({ data: {} });
    }
    const attachments = await listAutoReplyAttachments(null);
    res.json({
      success: true,
      data: {
        supportAutoReplyEnabled: settings.supportAutoReplyEnabled,
        supportAutoReplyBody: settings.supportAutoReplyBody,
        supportOnlineMinutes: settings.supportOnlineMinutes,
        attachments: attachments.map((a) => ({
          id: a.id,
          originalName: a.originalName,
          mimeType: a.mimeType,
          size: a.size,
          createdAt: a.createdAt,
        })),
      },
    });
  }
);

export const superAdminUpdateSupportAutoReplySettings = asyncHandler(
  async (req: any, res: Response<ApiResponse>) => {
    let settings = await prisma.superAdminSettings.findFirst();
    if (!settings) {
      settings = await prisma.superAdminSettings.create({ data: {} });
    }
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    if (typeof body.supportAutoReplyEnabled === 'boolean') {
      data.supportAutoReplyEnabled = body.supportAutoReplyEnabled;
    }
    if ('supportAutoReplyBody' in body) {
      data.supportAutoReplyBody =
        body.supportAutoReplyBody != null
          ? String(body.supportAutoReplyBody).trim() || null
          : null;
    }
    if (body.supportOnlineMinutes !== undefined) {
      const n = Number(body.supportOnlineMinutes);
      if (!Number.isFinite(n) || n < 1 || n > 120) {
        res.status(400).json({ success: false, error: 'supportOnlineMinutes: 1–120' });
        return;
      }
      data.supportOnlineMinutes = Math.round(n);
    }
    const updated = await prisma.superAdminSettings.update({
      where: { id: settings.id },
      data: data as any,
    });
    const attachments = await listAutoReplyAttachments(null);
    res.json({
      success: true,
      data: {
        supportAutoReplyEnabled: updated.supportAutoReplyEnabled,
        supportAutoReplyBody: updated.supportAutoReplyBody,
        supportOnlineMinutes: updated.supportOnlineMinutes,
        attachments: attachments.map((a) => ({
          id: a.id,
          originalName: a.originalName,
          mimeType: a.mimeType,
          size: a.size,
          createdAt: a.createdAt,
        })),
      },
    });
  }
);

export const superAdminUploadAutoReplyAttachment = asyncHandler(
  async (req: any, res: Response<ApiResponse>) => {
    const promoIdRaw = req.body?.promoId ?? req.query?.promoId;
    const promoId =
      promoIdRaw != null && String(promoIdRaw).trim() ? String(promoIdRaw).trim() : null;
    const uploaded = (req as any).file as Express.Multer.File | undefined;
    if (!uploaded) {
      res.status(400).json({ success: false, error: 'Прикрепите файл' });
      return;
    }
    try {
      const attachment = await addAutoReplyAttachment(promoId, uploaded);
      res.status(201).json({
        success: true,
        data: {
          attachment: {
            id: attachment.id,
            originalName: attachment.originalName,
            mimeType: attachment.mimeType,
            size: attachment.size,
            createdAt: attachment.createdAt,
            promoId: attachment.promoId,
          },
        },
      });
    } catch (e: any) {
      res.status(e?.statusCode || 400).json({ success: false, error: e?.message || 'Не удалось загрузить' });
    }
  }
);

export const superAdminDeleteAutoReplyAttachment = asyncHandler(
  async (req: any, res: Response<ApiResponse>) => {
    try {
      await removeAutoReplyAttachment(String(req.params.id));
      res.json({ success: true, data: {} });
    } catch (e: any) {
      res.status(e?.statusCode || 400).json({ success: false, error: e?.message || 'Не удалось удалить' });
    }
  }
);

export const superAdminGetAutoReplyAttachment = asyncHandler(async (req: any, res: Response) => {
  try {
    const att = await getAutoReplyAttachmentFile(String(req.params.id));
    const abs = absoluteUploadPath(att.storagePath);
    const mime = att.mimeType || 'application/octet-stream';
    const inline = mime.startsWith('image/') || mime === 'application/pdf';
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      inline ? contentDispositionInline(att.originalName) : contentDispositionAttachment(att.originalName)
    );
    fs.createReadStream(abs).pipe(res);
  } catch (e: any) {
    res.status(e?.statusCode || 404).json({ success: false, error: e?.message || 'Файл не найден' });
  }
});

export const superAdminDeleteCallRecording = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const rec = await prisma.designerCallRecording.findUnique({ where: { id } });
  if (!rec) {
    res.status(404).json({ success: false, error: 'Не найдено' });
    return;
  }
  safeUnlink(rec.storagePath);
  await prisma.designerCallRecording.delete({ where: { id } });
  res.json({ success: true, data: {} });
});

export async function cleanupExpiredDesignerRecordings(): Promise<number> {
  const now = new Date();
  const expired = await prisma.designerCallRecording.findMany({
    where: { expiresAt: { lt: now } },
  });
  let n = 0;
  for (const rec of expired) {
    safeUnlink(rec.storagePath);
    await prisma.designerCallRecording.delete({ where: { id: rec.id } });
    n += 1;
  }
  return n;
}
