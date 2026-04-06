import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { ClientRequest } from '../middleware/clientAuth';

const prisma = new PrismaClient();

/** Клиенты / родители: техподдержка или дизайн (горячая линия). */
const CLIENT_TICKET_CHANNELS = ['SUPPORT', 'DESIGNER'] as const;
type ClientTicketChannel = (typeof CLIENT_TICKET_CHANNELS)[number];

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
    throw new Error('Could not create platform internal tenant');
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
  requesterTenantId: string,
  ticketId: string,
  channel?: ClientTicketChannel
) {
  return {
    id: ticketId,
    tenantId: requesterTenantId,
    clientId: null,
    parentId: null,
    ...(channel ? { channel } : { channel: { in: ['SUPPORT', 'DESIGNER'] } }),
  };
}

export const requesterCreateSupportTicket = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const requester = req.supportRequester as { kind: string; id: string; tenantId: string } | undefined;
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const { subject, message, channel } = req.body as { subject?: string; message?: string; channel?: string };
  if (!message?.trim()) {
    res.status(400).json({ success: false, error: 'message is required' });
    return;
  }
  const ch: ClientTicketChannel =
    channel && isClientChannel(channel) ? channel : 'SUPPORT';
  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId: requester.tenantId,
      channel: ch,
      status: 'WAITING',
      subject: subject?.trim() || null,
    },
  });
  await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      authorType: requester.kind?.toLowerCase() || 'tenant_user',
      body: message.trim(),
    },
  });
  res.status(201).json({ success: true, data: { ticket } });
});

export const requesterListSupportTickets = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const requester = req.supportRequester as { tenantId: string } | undefined;
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const q = req.query.channel as string | undefined;
  const channelWhere =
    q && isClientChannel(q) ? { channel: q as ClientTicketChannel } : { channel: { in: ['SUPPORT', 'DESIGNER'] } };
  const tickets = await prisma.supportTicket.findMany({
    where: {
      tenantId: requester.tenantId,
      clientId: null,
      parentId: null,
      ...channelWhere,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: { _count: { select: { messages: true } } },
  });
  res.json({ success: true, data: { tickets } });
});

export const requesterGetSupportMessages = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const requester = req.supportRequester as { tenantId: string } | undefined;
  const { ticketId } = req.params;
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const ticket = await prisma.supportTicket.findFirst({
    where: requesterTicketWhere(requester.tenantId, ticketId),
  });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  const messages = await prisma.supportTicketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
  });
  let callRecordings: Array<{
    id: string;
    mimeType: string;
    durationSec: number | null;
    startedAt: Date;
    endedAt: Date | null;
    expiresAt: Date;
  }> = [];
  if (ticket.channel === 'DESIGNER') {
    callRecordings = await prisma.designerCallRecording.findMany({
      where: { ticketId },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        mimeType: true,
        durationSec: true,
        startedAt: true,
        endedAt: true,
        expiresAt: true,
      },
    });
  }
  res.json({ success: true, data: { ticket, messages, callRecordings } });
});

export const requesterPostSupportMessage = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const requester = req.supportRequester as { kind: string; tenantId: string } | undefined;
  const { ticketId } = req.params;
  const { message } = req.body as { message?: string };
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  if (!message?.trim()) {
    res.status(400).json({ success: false, error: 'message is required' });
    return;
  }
  const ticket = await prisma.supportTicket.findFirst({
    where: requesterTicketWhere(requester.tenantId, ticketId),
  });
  if (!ticket || ticket.status === 'CLOSED') {
    res.status(404).json({ success: false, error: 'Ticket not found or closed' });
    return;
  }
  const msg = await prisma.supportTicketMessage.create({
    data: {
      ticketId,
      authorType: requester.kind?.toLowerCase() || 'tenant_user',
      body: message.trim(),
    },
  });
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date(), status: ticket.assignedStaffId ? 'ASSIGNED' : 'WAITING' },
  });
  res.status(201).json({ success: true, data: { message: msg } });
});

export const requesterUploadDesignerCallRecording = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const requester = req.supportRequester as { kind: string; id: string; tenantId: string } | undefined;
  if (!requester?.tenantId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ success: false, error: 'File required' });
    return;
  }
  const { ticketId } = req.params;
  const { startedAt, endedAt, durationSec } = req.body as {
    startedAt?: string;
    endedAt?: string;
    durationSec?: string;
  };
  const ticket = await prisma.supportTicket.findFirst({
    where: requesterTicketWhere(requester.tenantId, ticketId, 'DESIGNER'),
  });
  if (!ticket || ticket.status === 'CLOSED') {
    fs.unlinkSync(file.path);
    res.status(404).json({ success: false, error: 'Designer ticket not found or closed' });
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
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const { channel, subject, message } = req.body as { channel?: string; subject?: string; message?: string };
  if (!channel || !isClientChannel(channel)) {
    res.status(400).json({ success: false, error: 'channel must be SUPPORT or DESIGNER' });
    return;
  }
  if (!message?.trim()) {
    res.status(400).json({ success: false, error: 'message is required' });
    return;
  }
  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId,
      channel,
      status: 'WAITING',
      clientId: clientId ?? null,
      parentId: parentId ?? null,
      subject: subject?.trim() || null,
    },
  });
  await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      authorType: clientId ? 'client' : 'parent',
      body: message.trim(),
      authorClientId: clientId ?? null,
      authorParentId: parentId ?? null,
    },
  });
  res.status(201).json({ success: true, data: { ticket } });
});

export const clientListSupportTickets = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const tenantId = req.client?.tenantId ?? req.parent?.tenantId;
  const clientId = req.client?.id;
  const parentId = req.parent?.id;
  if (!tenantId || (!clientId && !parentId)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const tickets = await prisma.supportTicket.findMany({
    where: {
      tenantId,
      OR: [{ clientId: clientId ?? undefined }, { parentId: parentId ?? undefined }],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { messages: true } },
    },
  });
  res.json({ success: true, data: { tickets } });
});

export const clientGetSupportMessages = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const tenantId = req.client?.tenantId ?? req.parent?.tenantId;
  const clientId = req.client?.id;
  const parentId = req.parent?.id;
  const { ticketId } = req.params;
  if (!tenantId || (!clientId && !parentId)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      tenantId,
      OR: [{ clientId: clientId ?? undefined }, { parentId: parentId ?? undefined }],
    },
  });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  const messages = await prisma.supportTicketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: { ticket, messages } });
});

export const clientPostSupportMessage = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const tenantId = req.client?.tenantId ?? req.parent?.tenantId;
  const clientId = req.client?.id;
  const parentId = req.parent?.id;
  const { ticketId } = req.params;
  const { message } = req.body as { message?: string };
  if (!tenantId || (!clientId && !parentId)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  if (!message?.trim()) {
    res.status(400).json({ success: false, error: 'message is required' });
    return;
  }
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      tenantId,
      OR: [{ clientId: clientId ?? undefined }, { parentId: parentId ?? undefined }],
    },
  });
  if (!ticket || ticket.status === 'CLOSED') {
    res.status(404).json({ success: false, error: 'Ticket not found or closed' });
    return;
  }
  const msg = await prisma.supportTicketMessage.create({
    data: {
      ticketId,
      authorType: clientId ? 'client' : 'parent',
      body: message.trim(),
      authorClientId: clientId ?? null,
      authorParentId: parentId ?? null,
    },
  });
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date(), status: ticket.assignedStaffId ? 'ASSIGNED' : 'WAITING' },
  });
  res.status(201).json({ success: true, data: { message: msg } });
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
      assignedStaff: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  res.json({ success: true, data: { tickets } });
});

export const staffClaimTicket = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const staff = req.platformStaff;
  if (staff.role === 'SECURITY') {
    res.status(403).json({ success: false, error: 'Read-only role' });
    return;
  }
  const { ticketId } = req.params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Not found' });
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
    res.status(403).json({ success: false, error: 'Wrong channel for your role' });
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
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  if (staff.role !== 'SECURITY') {
    if (staff.role === 'SUPPORT') {
      if (ticket.channel !== 'SUPPORT') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
    } else if (!designerCanAccessTicket(staff, ticket)) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
  }
  const messages = await prisma.supportTicketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: { ticket, messages } });
});

export const staffPostTicketMessage = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const staff = req.platformStaff;
  if (staff.role === 'SECURITY') {
    res.status(403).json({ success: false, error: 'Read-only role' });
    return;
  }
  const { ticketId } = req.params;
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json({ success: false, error: 'message is required' });
    return;
  }
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.status === 'CLOSED') {
    res.status(404).json({ success: false, error: 'Not found or closed' });
    return;
  }
  if (staff.role === 'SUPPORT') {
    if (ticket.channel !== 'SUPPORT') {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
  } else if (!designerCanAccessTicket(staff, ticket)) {
    res.status(403).json({ success: false, error: 'Forbidden' });
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
    res.status(403).json({ success: false, error: 'Only designers upload call recordings' });
    return;
  }
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ success: false, error: 'File required' });
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
    res.status(400).json({ success: false, error: 'ticketId required' });
    return;
  }
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.channel !== 'DESIGNER') {
    fs.unlinkSync(file.path);
    res.status(400).json({ success: false, error: 'Invalid designer ticket' });
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

export const superAdminListSupportTickets = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const channel = req.query.channel as string | undefined;
  const tenantId = req.query.tenantId as string | undefined;
  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(channel && isListableChannel(channel) ? { channel } : {}),
      ...(tenantId ? { tenantId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 300,
    include: {
      tenant: { select: { id: true, name: true, subdomain: true } },
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      parent: { select: { id: true, fullName: true, email: true } },
      assignedStaff: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
      _count: { select: { messages: true, callRecordings: true } },
    },
  });
  res.json({ success: true, data: { tickets } });
});

export const superAdminGetSupportMessages = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const { ticketId } = req.params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      tenant: { select: { id: true, name: true } },
      assignedStaff: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      messages: { orderBy: { createdAt: 'asc' } },
      callRecordings: { orderBy: { startedAt: 'desc' } },
    },
  });
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  res.json({ success: true, data: ticket });
});

export const superAdminPostSupportMessage = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const superAdmin = req.superAdmin;
  const { ticketId } = req.params;
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json({ success: false, error: 'message is required' });
    return;
  }
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.status === 'CLOSED') {
    res.status(404).json({ success: false, error: 'Not found or closed' });
    return;
  }
  const msg = await prisma.supportTicketMessage.create({
    data: {
      ticketId,
      authorType: 'super_admin',
      body: message.trim(),
      authorSuperAdminId: superAdmin.id,
    },
  });
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });
  res.status(201).json({ success: true, data: { message: msg } });
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
  res.json({ success: true, data: { recordings } });
});

export const superAdminListKnowledgeArticles = asyncHandler(async (_req: any, res: Response<ApiResponse>) => {
  const articles = await prisma.supportKnowledgeArticle.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ success: true, data: { articles } });
});

export const superAdminCreateKnowledgeArticle = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const { title, body, category, sortOrder } = req.body as {
    title?: string;
    body?: string;
    category?: string;
    sortOrder?: number;
  };
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ success: false, error: 'title and body required' });
    return;
  }
  const article = await prisma.supportKnowledgeArticle.create({
    data: {
      title: title.trim(),
      body: body.trim(),
      category: category?.trim() || null,
      sortOrder: sortOrder ?? 0,
    },
  });
  res.status(201).json({ success: true, data: { article } });
});

export const superAdminDeleteCallRecording = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const rec = await prisma.designerCallRecording.findUnique({ where: { id } });
  if (!rec) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  const abs = path.join(process.cwd(), 'uploads', rec.storagePath);
  if (fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
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
    const abs = path.join(process.cwd(), 'uploads', rec.storagePath);
    if (fs.existsSync(abs)) {
      try {
        fs.unlinkSync(abs);
      } catch {
        /* ignore */
      }
    }
    await prisma.designerCallRecording.delete({ where: { id: rec.id } });
    n += 1;
  }
  return n;
}
