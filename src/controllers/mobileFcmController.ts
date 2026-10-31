import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

function resolveActor(req: AuthenticatedRequest): { actorType: string; actorId: string } | null {
  const anyReq = req as any;
  if (anyReq.user?.id) return { actorType: 'USER', actorId: String(anyReq.user.id) };
  if (anyReq.client?.id) return { actorType: 'CLIENT', actorId: String(anyReq.client.id) };
  if (anyReq.parent?.id) return { actorType: 'PARENT', actorId: String(anyReq.parent.id) };
  if (anyReq.superAdmin?.id) return { actorType: 'SUPER_ADMIN', actorId: String(anyReq.superAdmin.id) };
  return null;
}

export async function registerMobileFcm(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = resolveActor(req);
    if (!actor) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = String(req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, error: 'token обязателен' });
    }

    const platform = req.body?.platform ? String(req.body.platform) : null;
    const accountType = req.body?.accountType ? String(req.body.accountType) : null;

    await prisma.mobileDeviceToken.upsert({
      where: { token },
      update: {
        actorType: actor.actorType,
        actorId: actor.actorId,
        platform,
        accountType,
        updatedAt: new Date(),
      },
      create: {
        token,
        actorType: actor.actorType,
        actorId: actor.actorId,
        platform,
        accountType,
      },
    });

    return res.json({ success: true, message: 'FCM токен зарегистрирован' });
  } catch (error) {
    console.error('[mobileFcm] register error:', error);
    return res.status(500).json({ success: false, error: 'Не удалось зарегистрировать токен' });
  }
}

export async function unregisterMobileFcm(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = resolveActor(req);
    if (!actor) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = String(req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, error: 'token обязателен' });
    }

    await prisma.mobileDeviceToken.deleteMany({
      where: {
        token,
        actorType: actor.actorType,
        actorId: actor.actorId,
      },
    });

    return res.json({ success: true, message: 'FCM токен удалён' });
  } catch (error) {
    console.error('[mobileFcm] unregister error:', error);
    return res.status(500).json({ success: false, error: 'Не удалось удалить токен' });
  }
}
