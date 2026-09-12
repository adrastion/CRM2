import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { ClientRequest } from '../middleware/clientAuth';
import { listInbox, markInboxRead } from '../services/notificationFanout';
import {
  getUnreadTotalForActor,
  resolveClientActor,
  resolveStaffActor,
} from '../services/chatService';
import { prisma } from '../lib/prisma';
import { fanoutNotification } from '../services/notificationFanout';

export const getSchoolNotifications = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const tenantId = req.tenant?.id || req.user.tenantId;
    const actor = await resolveStaffActor(req.user.id, tenantId);
    const chatUnread = await getUnreadTotalForActor(actor);
    const data = await listInbox('USER', req.user.id, {
      chatUnreadOverride: chatUnread,
    });
    res.json({ success: true, data });
  }
);

export const markSchoolNotificationsRead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const count = await markInboxRead('USER', req.user.id, {
      ids: Array.isArray(req.body?.ids) ? req.body.ids.map(String) : undefined,
      category: req.body?.category ? String(req.body.category) : undefined,
      all: req.body?.all === true,
    });
    res.json({ success: true, data: { count } });
  }
);

export const getPortalNotifications = asyncHandler(
  async (req: ClientRequest, res: Response<ApiResponse>) => {
    const actorType = req.userType === 'parent' ? 'PARENT' : 'CLIENT';
    const actorId = req.userType === 'parent' ? req.parent?.id : req.client?.id;
    if (!actorId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const tenantId =
      req.userType === 'parent' ? req.parent?.tenantId : req.client?.tenantId;
    const actor = await resolveClientActor({
      tenantId: tenantId || '',
      ...(actorType === 'PARENT' ? { parentId: actorId } : { clientId: actorId }),
    });
    const chatUnread = await getUnreadTotalForActor(actor);
    const data = await listInbox(actorType, actorId, {
      chatUnreadOverride: chatUnread,
    });
    res.json({ success: true, data });
  }
);

export const markPortalNotificationsRead = asyncHandler(
  async (req: ClientRequest, res: Response<ApiResponse>) => {
    const actorType = req.userType === 'parent' ? 'PARENT' : 'CLIENT';
    const actorId = req.userType === 'parent' ? req.parent?.id : req.client?.id;
    if (!actorId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const count = await markInboxRead(actorType, actorId, {
      ids: Array.isArray(req.body?.ids) ? req.body.ids.map(String) : undefined,
      category: req.body?.category ? String(req.body.category) : undefined,
      all: req.body?.all === true,
    });
    res.json({ success: true, data: { count } });
  }
);

/** SuperAdmin: опубликовать предложение школам. */
export const publishSchoolOffer = asyncHandler(
  async (req: any, res: Response<ApiResponse>) => {
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const url = req.body?.url ? String(req.body.url).trim() : null;
    if (!title || !body) {
      res.status(400).json({ success: false, error: 'Укажите title и body' });
      return;
    }

    const offer = await prisma.platformSchoolOffer.create({
      data: {
        title,
        body,
        url,
        publishedBy: req.superAdmin?.id || null,
      },
    });

    const owners = await prisma.user.findMany({
      where: { role: 'OWNER', isActive: true, tenant: { isActive: true } },
      select: { id: true, tenantId: true },
    });

    // Fan-out по tenant группам
    const byTenant = new Map<string, string[]>();
    for (const o of owners) {
      const list = byTenant.get(o.tenantId) || [];
      list.push(o.id);
      byTenant.set(o.tenantId, list);
    }

    await Promise.allSettled(
      Array.from(byTenant.entries()).map(([tenantId, userIds]) =>
        fanoutNotification({
          tenantId,
          category: 'offer',
          type: 'platform_school_offer',
          title: `Новое предложение: ${title}`,
          body,
          data: { url: url || '/settings', offerId: offer.id },
          eventType: 'offer',
          recipients: userIds.map((id) => ({ actorType: 'USER' as const, actorId: id })),
        })
      )
    );

    res.status(201).json({ success: true, data: offer });
  }
);

export const listSchoolOffers = asyncHandler(async (_req: any, res: Response<ApiResponse>) => {
  const offers = await prisma.platformSchoolOffer.findMany({
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: offers });
});
