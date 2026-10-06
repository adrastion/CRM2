import { Request, Response } from 'express';
import { ClientFeatureIdeaStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { fanoutNotification } from '../services/notificationFanout';
import { NotificationActorType } from '../services/notificationPrefsService';

const ACK_SUBMITTED =
  'Идея принята, в ближайшее время мы рассмотрим ваше предложение';
const ACK_ACCEPTED = 'Ваша идея принята и поставлена в план на обновление';
const ACK_REJECTED = 'К сожалению, идея не принята';

const PUBLIC_STATUS: Record<ClientFeatureIdeaStatus, string> = {
  SUBMITTED: 'на рассмотрении',
  ACCEPTED: 'в плане',
  REJECTED: 'отклонено',
};

type IdeaActor = {
  actorType: 'USER' | 'CLIENT' | 'PARENT' | 'MARKETER';
  actorId: string;
  tenantId?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  tenantName?: string | null;
};

function getSuperAdminId(req: Request): string | null {
  return (req as any).superAdmin?.id || null;
}

function toPublicIdea(row: {
  id: string;
  title: string;
  body: string;
  status: ClientFeatureIdeaStatus;
  rejectReason: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    statusLabel: PUBLIC_STATUS[row.status],
    rejectReason: row.status === 'REJECTED' ? row.rejectReason : null,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
  };
}

async function notifyIdeaAuthor(
  idea: {
    actorType: string;
    actorId: string;
    tenantId: string | null;
  },
  title: string,
  body: string,
  ideaId: string
): Promise<void> {
  if (idea.actorType === 'MARKETER') return;
  if (!['USER', 'CLIENT', 'PARENT'].includes(idea.actorType)) return;

  await fanoutNotification({
    tenantId: idea.tenantId,
    category: 'system',
    type: 'feature_idea',
    title,
    body,
    data: { url: '/feedback', ideaId },
    eventType: 'feature_idea',
    recipients: [
      {
        actorType: idea.actorType as NotificationActorType,
        actorId: idea.actorId,
      },
    ],
  });
}

/** Middleware: заполняет req.ideaActor из school / portal / marketer JWT. */
export function attachIdeaActorFromSchool(
  req: AuthenticatedRequest,
  _res: Response,
  next: Function
) {
  const user = req.user;
  if (!user) {
    next();
    return;
  }
  const name = [user.lastName, user.firstName].filter(Boolean).join(' ').trim();
  (req as any).ideaActor = {
    actorType: 'USER',
    actorId: user.id,
    tenantId: user.tenantId,
    authorName: name || user.email,
    authorEmail: user.email,
    tenantName: (user as any).tenant?.name || null,
  } as IdeaActor;
  next();
}

export function attachIdeaActorFromPortal(req: Request, _res: Response, next: Function) {
  const userType = (req as any).userType;
  if (userType === 'parent' && (req as any).parent) {
    const p = (req as any).parent;
    (req as any).ideaActor = {
      actorType: 'PARENT',
      actorId: p.id,
      tenantId: p.tenantId,
      authorName: null,
      authorEmail: null,
      tenantName: null,
    } as IdeaActor;
  } else if ((req as any).client) {
    const c = (req as any).client;
    (req as any).ideaActor = {
      actorType: 'CLIENT',
      actorId: c.id,
      tenantId: c.tenantId,
      authorName: null,
      authorEmail: null,
      tenantName: null,
    } as IdeaActor;
  }
  next();
}

export function attachIdeaActorFromMarketer(req: Request, _res: Response, next: Function) {
  const marketer = (req as any).marketer;
  if (marketer) {
    const name = [marketer.lastName, marketer.firstName].filter(Boolean).join(' ').trim();
    (req as any).ideaActor = {
      actorType: 'MARKETER',
      actorId: marketer.id,
      tenantId: null,
      authorName: name || marketer.email,
      authorEmail: marketer.email,
      tenantName: null,
    } as IdeaActor;
  }
  next();
}

async function enrichTenantName(actor: IdeaActor): Promise<IdeaActor> {
  let next = { ...actor };
  if (!next.tenantName && next.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: next.tenantId },
      select: { name: true },
    });
    next.tenantName = tenant?.name || null;
  }
  if ((!next.authorName || !next.authorEmail) && next.actorType === 'CLIENT') {
    const c = await prisma.client.findUnique({
      where: { id: next.actorId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (c) {
      const name = [c.lastName, c.firstName].filter(Boolean).join(' ').trim();
      next.authorName = next.authorName || name || c.email;
      next.authorEmail = next.authorEmail || c.email;
    }
  }
  if ((!next.authorName || !next.authorEmail) && next.actorType === 'PARENT') {
    const p = await prisma.parent.findUnique({
      where: { id: next.actorId },
      select: { fullName: true, email: true },
    });
    if (p) {
      next.authorName = next.authorName || p.fullName || p.email;
      next.authorEmail = next.authorEmail || p.email;
    }
  }
  return next;
}

export const listMyFeatureIdeas = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = (req as any).ideaActor as IdeaActor | undefined;
  if (!actor?.actorId) {
    res.status(401).json({ success: false, error: 'Требуется авторизация' });
    return;
  }
  const rows = await prisma.clientFeatureIdea.findMany({
    where: { actorType: actor.actorType, actorId: actor.actorId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: rows.map(toPublicIdea) });
});

export const createFeatureIdea = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  let actor = (req as any).ideaActor as IdeaActor | undefined;
  if (!actor?.actorId) {
    res.status(401).json({ success: false, error: 'Требуется авторизация' });
    return;
  }
  actor = await enrichTenantName(actor);

  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();
  if (!title || !body) {
    res.status(400).json({ success: false, error: 'Укажите заголовок и текст идеи' });
    return;
  }
  if (title.length > 200) {
    res.status(400).json({ success: false, error: 'Заголовок слишком длинный' });
    return;
  }

  const idea = await prisma.clientFeatureIdea.create({
    data: {
      title,
      body,
      actorType: actor.actorType,
      actorId: actor.actorId,
      tenantId: actor.tenantId || null,
      authorName: actor.authorName || null,
      authorEmail: actor.authorEmail || null,
      tenantName: actor.tenantName || null,
    },
  });

  void notifyIdeaAuthor(
    idea,
    'Связь с разработчиком',
    ACK_SUBMITTED,
    idea.id
  ).catch((e) => console.error('feature idea notify failed', e));

  res.json({
    success: true,
    data: { ...toPublicIdea(idea), message: ACK_SUBMITTED },
  });
});

export const listFeatureIdeasAdmin = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const statusRaw = req.query.status ? String(req.query.status).toUpperCase() : '';
  const status =
    statusRaw && ['SUBMITTED', 'ACCEPTED', 'REJECTED'].includes(statusRaw)
      ? (statusRaw as ClientFeatureIdeaStatus)
      : undefined;

  const rows = await prisma.clientFeatureIdea.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      devNote: { select: { id: true, title: true, status: true } },
    },
  });
  res.json({ success: true, data: rows });
});

export const acceptFeatureIdea = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const superAdminId = getSuperAdminId(req);
  if (!superAdminId) {
    res.status(401).json({ success: false, error: 'Super admin required' });
    return;
  }
  const id = req.params.id;
  const existing = await prisma.clientFeatureIdea.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Идея не найдена' });
    return;
  }
  if (existing.status !== 'SUBMITTED') {
    res.status(400).json({ success: false, error: 'Идея уже рассмотрена' });
    return;
  }

  const authorLine = [
    existing.authorName,
    existing.authorEmail,
    existing.actorType,
    existing.tenantName,
  ]
    .filter(Boolean)
    .join(' · ');

  const note = await prisma.superAdminDevNote.create({
    data: {
      title: existing.title,
      description: `${existing.body}\n\n—\nИдея от: ${authorLine || existing.actorId}`,
      status: 'IDEA',
      createdById: superAdminId,
    },
  });

  const updated = await prisma.clientFeatureIdea.update({
    where: { id },
    data: {
      status: 'ACCEPTED',
      reviewedAt: new Date(),
      reviewedById: superAdminId,
      rejectReason: null,
      devNoteId: note.id,
    },
    include: {
      reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      devNote: { select: { id: true, title: true, status: true } },
    },
  });

  void notifyIdeaAuthor(updated, 'Связь с разработчиком', ACK_ACCEPTED, updated.id).catch((e) =>
    console.error('feature idea accept notify failed', e)
  );

  res.json({ success: true, data: updated });
});

export const rejectFeatureIdea = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const superAdminId = getSuperAdminId(req);
  if (!superAdminId) {
    res.status(401).json({ success: false, error: 'Super admin required' });
    return;
  }
  const id = req.params.id;
  const existing = await prisma.clientFeatureIdea.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Идея не найдена' });
    return;
  }
  if (existing.status !== 'SUBMITTED') {
    res.status(400).json({ success: false, error: 'Идея уже рассмотрена' });
    return;
  }

  const rejectReason =
    req.body?.rejectReason != null ? String(req.body.rejectReason).trim() || null : null;
  const bodyMsg = rejectReason ? `${ACK_REJECTED}: ${rejectReason}` : ACK_REJECTED;

  const updated = await prisma.clientFeatureIdea.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedById: superAdminId,
      rejectReason,
    },
    include: {
      reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      devNote: { select: { id: true, title: true, status: true } },
    },
  });

  void notifyIdeaAuthor(updated, 'Связь с разработчиком', bodyMsg, updated.id).catch((e) =>
    console.error('feature idea reject notify failed', e)
  );

  res.json({ success: true, data: updated });
});
