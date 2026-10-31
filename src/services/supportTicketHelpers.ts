import path from 'path';
import { prisma } from '../lib/prisma';
import { decodeUploadOriginalName, ensureUploadDir, uniqueUploadFilename } from '../utils/fileStorage';

const PLATFORM_INTERNAL_SUBDOMAIN = '__platform_internal__';

/** Тенант для обращений платформенных маркетологов без привязки к школе. */
export async function resolvePlatformInternalTenantId(): Promise<string> {
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

export const SUPPORT_TICKET_KINDS = ['GENERAL', 'QUICK_SETUP'] as const;
export type SupportTicketKind = (typeof SUPPORT_TICKET_KINDS)[number];

const STAFF_AUTHOR_TYPES = new Set(['platform_staff', 'super_admin']);

const ALLOWED_ATTACHMENT_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

export const SUPPORT_ATTACHMENT_MAX_FILES = 10;
export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** @deprecated Используйте SupportPromoService.isQuickSetupAvailable() */
export function isQuickSetupPromoEnabled(): boolean {
  const raw = String(process.env.SUPPORT_QUICK_SETUP_PROMO || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function parseSupportTicketKind(raw?: string | null): SupportTicketKind {
  const k = String(raw || 'GENERAL').trim().toUpperCase();
  if (k === 'QUICK_SETUP') return 'QUICK_SETUP';
  return 'GENERAL';
}

export function supportStatusLabel(
  status: string,
  opts?: { hasStaffReply?: boolean }
): string {
  const s = String(status || '').toUpperCase();
  if (s === 'CLOSED') return 'Решено';
  if (s === 'ASSIGNED') return 'В работе';
  if (s === 'WAITING') {
    return opts?.hasStaffReply ? 'Ожидает ответа' : 'Новое обращение';
  }
  if (s === 'OPEN') return 'Новое обращение';
  return 'В работе';
}

export function isStaffAuthorType(authorType: string): boolean {
  return STAFF_AUTHOR_TYPES.has(String(authorType || '').toLowerCase());
}

export function isAllowedSupportAttachmentMime(mime: string): boolean {
  return ALLOWED_ATTACHMENT_MIME.has(String(mime || '').toLowerCase());
}

export function prepareSupportAttachmentFile(file: Express.Multer.File): {
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
} {
  const originalName = decodeUploadOriginalName(file.originalname);
  const mimeType = file.mimetype || 'application/octet-stream';
  const rel = `support-attachments/${path.basename(file.filename)}`;
  return {
    originalName,
    mimeType,
    size: file.size,
    storagePath: rel.replace(/\\/g, '/'),
  };
}

export function ensureSupportAttachmentUploadDir(): string {
  return ensureUploadDir('support-attachments');
}

export function supportAttachmentFilename(originalName: string): string {
  return uniqueUploadFilename(originalName);
}

export function serializeAttachment(a: {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}) {
  return {
    id: a.id,
    originalName: a.originalName,
    mimeType: a.mimeType,
    size: a.size,
    createdAt: a.createdAt,
  };
}

export function computeUnreadCount(params: {
  requesterLastReadAt: Date | null | undefined;
  messages: Array<{ authorType: string; createdAt: Date }>;
}): number {
  const since = params.requesterLastReadAt ? new Date(params.requesterLastReadAt).getTime() : 0;
  return params.messages.filter(
    (m) => isStaffAuthorType(m.authorType) && new Date(m.createdAt).getTime() > since
  ).length;
}

/** Непрочитанные для SA/SUPPORT: сообщения от requester после staffLastReadAt. */
export function computeStaffUnreadCount(params: {
  staffLastReadAt: Date | null | undefined;
  messages: Array<{ authorType: string; createdAt: Date }>;
}): number {
  const since = params.staffLastReadAt ? new Date(params.staffLastReadAt).getTime() : 0;
  return params.messages.filter(
    (m) => !isStaffAuthorType(m.authorType) && new Date(m.createdAt).getTime() > since
  ).length;
}

export function isAutoReplyMessage(m: {
  authorType: string;
  authorStaffId?: string | null;
  authorSuperAdminId?: string | null;
}): boolean {
  return (
    String(m.authorType || '').toLowerCase() === 'platform_staff' &&
    !m.authorStaffId &&
    !m.authorSuperAdminId
  );
}

export function waitingMinutesSince(from: Date | string | null | undefined): number {
  if (!from) return 0;
  const t = new Date(from).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60_000));
}

export function serializeSupportMessage(m: {
  id: string;
  ticketId: string;
  authorType: string;
  body: string;
  authorClientId?: string | null;
  authorParentId?: string | null;
  authorStaffId?: string | null;
  authorSuperAdminId?: string | null;
  createdAt: Date;
  attachments?: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    createdAt: Date;
  }>;
}) {
  return {
    id: m.id,
    ticketId: m.ticketId,
    authorType: m.authorType,
    body: m.body,
    authorClientId: m.authorClientId ?? null,
    authorParentId: m.authorParentId ?? null,
    authorStaffId: m.authorStaffId ?? null,
    authorSuperAdminId: m.authorSuperAdminId ?? null,
    createdAt: m.createdAt,
    isAutoReply: isAutoReplyMessage(m),
    attachments: (m.attachments || []).map(serializeAttachment),
  };
}
