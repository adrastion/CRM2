import { Request, Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getOrCreateNotificationPrefs,
  updateNotificationPrefs,
  NotificationActorType,
  NotificationPrefsUpdate,
} from '../services/notificationPrefsService';
import {
  getSubscriptionsForActor,
  removeActorPushSubscription,
  saveActorPushSubscription,
} from '../services/actorPushService';
import { getVapidPublicKey } from '../services/pushNotificationService';
import { ClientRequest } from '../middleware/clientAuth';

function parseUpdate(body: any): NotificationPrefsUpdate {
  return {
    chatMessagesEnabled:
      typeof body?.chatMessagesEnabled === 'boolean' ? body.chatMessagesEnabled : undefined,
    changelogEnabled:
      typeof body?.changelogEnabled === 'boolean' ? body.changelogEnabled : undefined,
    pushMasterEnabled:
      typeof body?.pushMasterEnabled === 'boolean' ? body.pushMasterEnabled : undefined,
    scheduleMode:
      body?.scheduleMode === 'ALWAYS' || body?.scheduleMode === 'WINDOW'
        ? body.scheduleMode
        : undefined,
    windowStartMinutes:
      'windowStartMinutes' in (body || {}) ? body.windowStartMinutes : undefined,
    windowEndMinutes: 'windowEndMinutes' in (body || {}) ? body.windowEndMinutes : undefined,
    daysOfWeek: 'daysOfWeek' in (body || {}) ? body.daysOfWeek : undefined,
    timezone: typeof body?.timezone === 'string' ? body.timezone : undefined,
  };
}

function schoolRoleAllowsSchedule(role?: string): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'TRAINER';
}

export const getSchoolNotificationPrefs = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const data = await getOrCreateNotificationPrefs('USER', req.user.id);
    res.json({ success: true, data });
  }
);

export const updateSchoolNotificationPrefs = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const data = await updateNotificationPrefs('USER', req.user.id, parseUpdate(req.body), {
      allowSchedule: schoolRoleAllowsSchedule(req.user.role),
    });
    res.json({ success: true, data });
  }
);

export const getPortalNotificationPrefs = asyncHandler(
  async (req: ClientRequest, res: Response<ApiResponse>) => {
    const actor =
      req.userType === 'parent' && req.parent
        ? ({ type: 'PARENT' as const, id: req.parent.id })
        : req.client
          ? ({ type: 'CLIENT' as const, id: req.client.id })
          : null;
    if (!actor) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const data = await getOrCreateNotificationPrefs(actor.type, actor.id);
    res.json({ success: true, data });
  }
);

export const updatePortalNotificationPrefs = asyncHandler(
  async (req: ClientRequest, res: Response<ApiResponse>) => {
    const actor =
      req.userType === 'parent' && req.parent
        ? ({ type: 'PARENT' as const, id: req.parent.id })
        : req.client
          ? ({ type: 'CLIENT' as const, id: req.client.id })
          : null;
    if (!actor) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const data = await updateNotificationPrefs(actor.type, actor.id, parseUpdate(req.body), {
      allowSchedule: false,
    });
    res.json({ success: true, data });
  }
);

export const getSuperAdminNotificationPrefs = asyncHandler(
  async (req: Request, res: Response<ApiResponse>) => {
    const sa = (req as any).superAdmin;
    if (!sa?.id) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const data = await getOrCreateNotificationPrefs('SUPER_ADMIN', sa.id);
    res.json({ success: true, data });
  }
);

export const updateSuperAdminNotificationPrefs = asyncHandler(
  async (req: Request, res: Response<ApiResponse>) => {
    const sa = (req as any).superAdmin;
    if (!sa?.id) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const data = await updateNotificationPrefs('SUPER_ADMIN', sa.id, parseUpdate(req.body), {
      allowSchedule: false,
    });
    res.json({ success: true, data });
  }
);

export const getTesterNotificationPrefs = asyncHandler(
  async (req: Request, res: Response<ApiResponse>) => {
    const tester = (req as any).tester;
    if (!tester?.id) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const data = await getOrCreateNotificationPrefs('TESTER', tester.id);
    res.json({ success: true, data });
  }
);

export const updateTesterNotificationPrefs = asyncHandler(
  async (req: Request, res: Response<ApiResponse>) => {
    const tester = (req as any).tester;
    if (!tester?.id) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const data = await updateNotificationPrefs('TESTER', tester.id, parseUpdate(req.body), {
      allowSchedule: false,
    });
    res.json({ success: true, data });
  }
);

async function handleSubscribe(
  res: Response,
  actorType: NotificationActorType,
  actorId: string,
  body: any
) {
  const { subscription, userAgent } = body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    res.status(400).json({ success: false, error: 'Invalid subscription data' });
    return;
  }
  await saveActorPushSubscription(
    actorType,
    actorId,
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    },
    userAgent
  );
  res.json({ success: true, message: 'Subscribed' });
}

async function handleUnsubscribe(
  res: Response,
  actorType: NotificationActorType,
  actorId: string,
  body: any
) {
  const endpoint = body?.endpoint || body?.subscription?.endpoint;
  if (!endpoint) {
    res.status(400).json({ success: false, error: 'endpoint required' });
    return;
  }
  await removeActorPushSubscription(actorType, actorId, String(endpoint));
  res.json({ success: true, message: 'Unsubscribed' });
}

export const getSharedVapidKey = asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    res.status(503).json({ success: false, error: 'Push notifications not configured' });
    return;
  }
  res.json({ success: true, data: { publicKey } });
});

export const subscribePortalPush = asyncHandler(async (req: ClientRequest, res: Response) => {
  const actor =
    req.userType === 'parent' && req.parent
      ? ({ type: 'PARENT' as const, id: req.parent.id })
      : req.client
        ? ({ type: 'CLIENT' as const, id: req.client.id })
        : null;
  if (!actor) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  await handleSubscribe(res, actor.type, actor.id, req.body);
});

export const unsubscribePortalPush = asyncHandler(async (req: ClientRequest, res: Response) => {
  const actor =
    req.userType === 'parent' && req.parent
      ? ({ type: 'PARENT' as const, id: req.parent.id })
      : req.client
        ? ({ type: 'CLIENT' as const, id: req.client.id })
        : null;
  if (!actor) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  await handleUnsubscribe(res, actor.type, actor.id, req.body);
});

export const portalPushStatus = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor =
    req.userType === 'parent' && req.parent
      ? ({ type: 'PARENT' as const, id: req.parent.id })
      : req.client
        ? ({ type: 'CLIENT' as const, id: req.client.id })
        : null;
  if (!actor) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const subs = await getSubscriptionsForActor(actor.type, actor.id);
  res.json({ success: true, data: { subscribed: subs.length > 0, count: subs.length } });
});

export const subscribeTesterPush = asyncHandler(async (req: Request, res: Response) => {
  const tester = (req as any).tester;
  if (!tester?.id) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  await handleSubscribe(res, 'TESTER', tester.id, req.body);
});

export const unsubscribeTesterPush = asyncHandler(async (req: Request, res: Response) => {
  const tester = (req as any).tester;
  if (!tester?.id) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  await handleUnsubscribe(res, 'TESTER', tester.id, req.body);
});

export const testerPushStatus = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const tester = (req as any).tester;
  if (!tester?.id) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const subs = await getSubscriptionsForActor('TESTER', tester.id);
  res.json({ success: true, data: { subscribed: subs.length > 0, count: subs.length } });
});
