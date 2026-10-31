import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { fanoutNotification, resolveSchoolManagers } from './notificationFanout';
import {
  absoluteUploadPath,
  decodeUploadOriginalName,
  ensureUploadDir,
  uniqueUploadFilename,
} from '../utils/fileStorage';
import { isAllowedSupportAttachmentMime } from './supportTicketHelpers';

const DEFAULT_ONLINE_MINUTES = 10;

export type AutoReplyTemplateFile = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
};

export type AutoReplyPayload = {
  body: string;
  attachments: AutoReplyTemplateFile[];
};

async function getSupportOnlineMinutes(): Promise<number> {
  const s = await prisma.superAdminSettings.findFirst({
    select: { supportOnlineMinutes: true },
  });
  const n = Number(s?.supportOnlineMinutes);
  return Number.isFinite(n) && n > 0 ? Math.min(120, Math.round(n)) : DEFAULT_ONLINE_MINUTES;
}

/** Есть ли активный SUPPORT-сотрудник с недавним heartbeat. */
export async function isSupportStaffOnline(): Promise<boolean> {
  const minutes = await getSupportOnlineMinutes();
  const since = new Date(Date.now() - minutes * 60 * 1000);
  const n = await prisma.platformStaffUser.count({
    where: {
      role: 'SUPPORT',
      isActive: true,
      lastSeenAt: { gte: since },
    },
  });
  return n > 0;
}

export async function touchPlatformStaffSeen(staffId: string): Promise<void> {
  if (!staffId) return;
  try {
    await prisma.platformStaffUser.update({
      where: { id: staffId },
      data: { lastSeenAt: new Date() },
    });
  } catch {
    /* ignore */
  }
}

/** Уведомить всех активных SA (колокольчик SA). */
export async function notifyAllSuperAdmins(input: {
  type: string;
  title: string;
  body: string;
  link?: string;
}): Promise<void> {
  const admins = await prisma.superAdmin.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  if (!admins.length) return;
  await prisma.superAdminNotification.createMany({
    data: admins.map((a) => ({
      recipientId: a.id,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link || '/admin/support-hub',
    })),
  });
}

/**
 * Если поддержка офлайн — алерт SA о новом обращении.
 * Вызывать после создания SUPPORT-тикета.
 */
export async function escalateNewTicketIfSupportOffline(ticket: {
  id: string;
  tenantId: string;
  subject?: string | null;
  kind?: string | null;
  channel?: string | null;
}): Promise<void> {
  if (ticket.channel && ticket.channel !== 'SUPPORT') return;
  const online = await isSupportStaffOnline();
  if (online) return;

  const tenant = await prisma.tenant.findUnique({
    where: { id: ticket.tenantId },
    select: { name: true },
  });
  const subject = ticket.subject || (ticket.kind === 'QUICK_SETUP' ? 'Быстрая настройка' : 'Обращение');
  await notifyAllSuperAdmins({
    type: 'support_no_staff_online',
    title: 'Новое обращение — поддержка офлайн',
    body: `${tenant?.name || 'Школа'}: «${subject}». Сотрудников техподдержки сейчас нет в сети.`,
    link: '/admin/support-hub',
  });
}

/** Кому слать bell при ответе поддержки. */
export async function notifyRequesterOfStaffReply(ticket: {
  id: string;
  tenantId: string;
  clientId?: string | null;
  parentId?: string | null;
  marketerId?: string | null;
  subject?: string | null;
  channel?: string | null;
}): Promise<void> {
  if (ticket.channel && ticket.channel !== 'SUPPORT') return;

  const title = 'Ответ техподдержки';
  const body = ticket.subject
    ? `Новое сообщение по обращению «${ticket.subject}»`
    : 'Новое сообщение по вашему обращению';
  const data = {
    url: undefined as string | undefined,
    ticketId: ticket.id,
    openSupport: true,
  };

  if (ticket.clientId) {
    await fanoutNotification({
      tenantId: ticket.tenantId,
      category: 'system',
      type: 'support_reply',
      title,
      body,
      data: { ...data, url: '/client' },
      eventType: 'chat_message',
      recipients: [{ actorType: 'CLIENT', actorId: ticket.clientId }],
    });
    return;
  }
  if (ticket.parentId) {
    await fanoutNotification({
      tenantId: ticket.tenantId,
      category: 'system',
      type: 'support_reply',
      title,
      body,
      data: { ...data, url: '/client' },
      eventType: 'chat_message',
      recipients: [{ actorType: 'PARENT', actorId: ticket.parentId }],
    });
    return;
  }
  if (ticket.marketerId) {
    return;
  }

  const managers = await resolveSchoolManagers(ticket.tenantId, { roles: ['OWNER', 'ADMIN'] });
  if (!managers.length) return;
  await fanoutNotification({
    tenantId: ticket.tenantId,
    category: 'system',
    type: 'support_reply',
    title,
    body,
    data: { ...data, url: '/' },
    eventType: 'chat_message',
    recipients: managers,
  });
}

function serializeTemplateFile(row: {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
}): AutoReplyTemplateFile {
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    storagePath: row.storagePath,
  };
}

/** Первый автоответ: текст + файлы акции или глобальный шаблон. */
export async function resolveAutoReply(promoId?: string | null): Promise<AutoReplyPayload | null> {
  if (promoId) {
    const promo = await prisma.supportPromo.findUnique({
      where: { id: promoId },
      include: { autoReplyAttachments: { orderBy: { createdAt: 'asc' } } },
    });
    if (promo?.autoReplyEnabled) {
      const body = String(promo.autoReplyBody || '').trim();
      const attachments = (promo.autoReplyAttachments || []).map(serializeTemplateFile);
      if (body || attachments.length) {
        return { body, attachments };
      }
    }
  }

  const settings = await prisma.superAdminSettings.findFirst({
    select: { supportAutoReplyEnabled: true, supportAutoReplyBody: true },
  });
  if (!settings?.supportAutoReplyEnabled) return null;

  const globalFiles = await prisma.supportAutoReplyAttachment.findMany({
    where: { promoId: null },
    orderBy: { createdAt: 'asc' },
  });
  const body = String(settings.supportAutoReplyBody || '').trim();
  const attachments = globalFiles.map(serializeTemplateFile);
  if (!body && !attachments.length) return null;
  return { body, attachments };
}

/** @deprecated используйте resolveAutoReply */
export async function resolveAutoReplyBody(promoId?: string | null): Promise<string | null> {
  const payload = await resolveAutoReply(promoId);
  return payload?.body || null;
}

export async function postSupportAutoReply(
  ticketId: string,
  payload: AutoReplyPayload | string
): Promise<void> {
  const data: AutoReplyPayload =
    typeof payload === 'string'
      ? { body: String(payload || '').trim(), attachments: [] }
      : {
          body: String(payload.body || '').trim(),
          attachments: payload.attachments || [],
        };
  if (!data.body && !data.attachments.length) return;

  const msg = await prisma.supportTicketMessage.create({
    data: {
      ticketId,
      authorType: 'platform_staff',
      body: data.body || 'Вложение',
    },
  });

  const destDir = ensureUploadDir('support-attachments');
  for (const file of data.attachments) {
    try {
      const src = absoluteUploadPath(file.storagePath);
      if (!fs.existsSync(src)) continue;
      const destName = uniqueUploadFilename(file.originalName || 'file');
      const destAbs = path.join(destDir, destName);
      fs.copyFileSync(src, destAbs);
      const storagePath = `support-attachments/${destName}`;
      await prisma.supportTicketMessageAttachment.create({
        data: {
          messageId: msg.id,
          originalName: file.originalName,
          mimeType: file.mimeType || 'application/octet-stream',
          size: file.size || fs.statSync(destAbs).size,
          storagePath,
        },
      });
    } catch (e) {
      console.error('[support] auto-reply copy attachment failed', file.id, e);
    }
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date(), status: 'ASSIGNED' },
  });
}

export async function listAutoReplyAttachments(promoId: string | null) {
  return prisma.supportAutoReplyAttachment.findMany({
    where: { promoId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function addAutoReplyAttachment(
  promoId: string | null,
  file: Express.Multer.File
) {
  if (!file?.path || !fs.existsSync(file.path)) {
    throw Object.assign(new Error('Файл не загружен'), { statusCode: 400 });
  }
  if (!isAllowedSupportAttachmentMime(file.mimetype)) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error('Тип файла не поддерживается'), { statusCode: 400 });
  }
  if (promoId) {
    const promo = await prisma.supportPromo.findUnique({ where: { id: promoId } });
    if (!promo) throw Object.assign(new Error('Акция не найдена'), { statusCode: 404 });
  }

  const dir = ensureUploadDir('support-auto-reply');
  const destName = uniqueUploadFilename(file.originalname || 'file');
  const destAbs = path.join(dir, destName);
  fs.renameSync(file.path, destAbs);
  const storagePath = `support-auto-reply/${destName}`;

  return prisma.supportAutoReplyAttachment.create({
    data: {
      promoId,
      originalName: decodeUploadOriginalName(file.originalname || destName),
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      storagePath,
    },
  });
}

export async function removeAutoReplyAttachment(id: string) {
  const row = await prisma.supportAutoReplyAttachment.findUnique({ where: { id } });
  if (!row) throw Object.assign(new Error('Файл не найден'), { statusCode: 404 });
  try {
    const abs = absoluteUploadPath(row.storagePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* ignore */
  }
  await prisma.supportAutoReplyAttachment.delete({ where: { id } });
  return { ok: true };
}

export async function getAutoReplyAttachmentFile(id: string) {
  const row = await prisma.supportAutoReplyAttachment.findUnique({ where: { id } });
  if (!row) throw Object.assign(new Error('Файл не найден'), { statusCode: 404 });
  const abs = absoluteUploadPath(row.storagePath);
  if (!fs.existsSync(abs)) {
    throw Object.assign(new Error('Файл отсутствует на диске'), { statusCode: 404 });
  }
  return row;
}
