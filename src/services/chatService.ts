import { prisma } from '../lib/prisma';
import { ChatThreadType, Prisma } from '@prisma/client';
import { HttpError, badRequest, forbidden, notFound } from '../utils/httpError';
import {
  isPresenceOnline,
  presenceKeyClient,
  presenceKeyParent,
  presenceKeySuperAdmin,
  presenceKeyTester,
  presenceKeyUser,
  PresenceStatus,
  statusFromOnline,
} from './chatPresence';

export type ChatAuthorType = 'CLIENT' | 'PARENT' | 'USER' | 'SUPER_ADMIN' | 'TESTER';

export type ChatActor =
  | { kind: 'USER'; userId: string; tenantId: string; role: string; trainerId: string | null }
  | { kind: 'CLIENT'; clientId: string; tenantId: string }
  | { kind: 'PARENT'; parentId: string; clientId: string; tenantId: string }
  | { kind: 'SUPER_ADMIN'; superAdminId: string }
  | { kind: 'TESTER'; testerId: string };

export interface EnsureThreadInput {
  type: ChatThreadType;
  clientId?: string;
  trainerId?: string;
  groupId?: string;
}

export interface ThreadListItem {
  id: string | null;
  type: ChatThreadType;
  threadKey: string;
  title: string;
  subtitle: string;
  clientId: string | null;
  trainerId: string | null;
  groupId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  ensurePayload: EnsureThreadInput;
  /** Только для личных бесед; иначе null/undefined. */
  presenceStatus?: PresenceStatus | null;
}

function personName(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ').trim();
}

function isPlatformActor(
  actor: ChatActor
): actor is { kind: 'SUPER_ADMIN'; superAdminId: string } | { kind: 'TESTER'; testerId: string } {
  return actor.kind === 'SUPER_ADMIN' || actor.kind === 'TESTER';
}

function actorTenantId(actor: ChatActor): string | null {
  if (actor.kind === 'SUPER_ADMIN' || actor.kind === 'TESTER') return null;
  return actor.tenantId;
}

export function threadKeyFor(input: EnsureThreadInput, tenantId?: string | null): string {
  switch (input.type) {
    case 'CLIENT_ADMIN':
      if (!input.clientId) throw badRequest('clientId обязателен');
      return `client_admin:${input.clientId}`;
    case 'CLIENT_TRAINER':
      if (!input.clientId || !input.trainerId) throw badRequest('clientId и trainerId обязательны');
      return `client_trainer:${input.clientId}:${input.trainerId}`;
    case 'GROUP':
      if (!input.groupId) throw badRequest('groupId обязателен');
      return `group:${input.groupId}`;
    case 'TRAINER_ADMIN':
      if (!input.trainerId) throw badRequest('trainerId обязателен');
      return `trainer_admin:${input.trainerId}`;
    case 'TRAINERS':
      if (!tenantId) throw badRequest('tenantId обязателен для TRAINERS');
      return `trainers:${tenantId}`;
    case 'PLATFORM_TESTERS':
      return 'platform_testers';
    case 'SUPER_ADMINS':
      return 'super_admins';
    default:
      throw badRequest('Неизвестный тип чата');
  }
}

function readerOf(actor: ChatActor): { readerType: ChatAuthorType; readerId: string } {
  if (actor.kind === 'USER') return { readerType: 'USER', readerId: actor.userId };
  if (actor.kind === 'CLIENT') return { readerType: 'CLIENT', readerId: actor.clientId };
  if (actor.kind === 'PARENT') return { readerType: 'PARENT', readerId: actor.parentId };
  if (actor.kind === 'SUPER_ADMIN') return { readerType: 'SUPER_ADMIN', readerId: actor.superAdminId };
  return { readerType: 'TESTER', readerId: actor.testerId };
}

function subjectClientId(actor: ChatActor): string | null {
  if (actor.kind === 'CLIENT') return actor.clientId;
  if (actor.kind === 'PARENT') return actor.clientId;
  return null;
}

async function isActiveGroupMember(clientId: string, groupId: string): Promise<boolean> {
  const m = await prisma.groupMembership.findFirst({
    where: { clientId, groupId, isActive: true },
  });
  return Boolean(m);
}

const DM_TYPES: ChatThreadType[] = ['CLIENT_ADMIN', 'CLIENT_TRAINER', 'TRAINER_ADMIN'];

async function anyAdminOnline(tenantId: string): Promise<boolean> {
  const admins = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: { in: ['OWNER', 'ADMIN'] } },
    select: { id: true },
  });
  return admins.some((u) => isPresenceOnline(presenceKeyUser(u.id)));
}

async function resolvePresenceForCandidate(
  actor: ChatActor,
  type: ChatThreadType,
  meta: { clientId?: string; trainerId?: string }
): Promise<PresenceStatus | null> {
  if (!DM_TYPES.includes(type) || isPlatformActor(actor)) return null;

  if (type === 'CLIENT_ADMIN' || type === 'CLIENT_TRAINER') {
    if (actor.kind === 'USER' && meta.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: meta.clientId },
        select: { password: true },
      });
      if (!client || client.password == null) return 'unregistered';
      return statusFromOnline(isPresenceOnline(presenceKeyClient(meta.clientId)));
    }
    if ((actor.kind === 'CLIENT' || actor.kind === 'PARENT') && type === 'CLIENT_ADMIN') {
      const tenantId = actor.tenantId;
      return statusFromOnline(await anyAdminOnline(tenantId));
    }
    if ((actor.kind === 'CLIENT' || actor.kind === 'PARENT') && type === 'CLIENT_TRAINER' && meta.trainerId) {
      const trainer = await prisma.trainer.findFirst({
        where: { id: meta.trainerId },
        select: { userId: true },
      });
      if (!trainer) return 'offline';
      return statusFromOnline(isPresenceOnline(presenceKeyUser(trainer.userId)));
    }
  }

  if (type === 'TRAINER_ADMIN') {
    if (actor.kind === 'USER' && (actor.role === 'OWNER' || actor.role === 'ADMIN') && meta.trainerId) {
      const trainer = await prisma.trainer.findFirst({
        where: { id: meta.trainerId },
        select: { userId: true },
      });
      if (!trainer) return 'offline';
      return statusFromOnline(isPresenceOnline(presenceKeyUser(trainer.userId)));
    }
    if (actor.kind === 'USER' && actor.role === 'TRAINER') {
      return statusFromOnline(await anyAdminOnline(actor.tenantId));
    }
  }

  return null;
}

/** Проверка доступа актора к существующему потоку. */
export async function canAccessThread(
  actor: ChatActor,
  thread: {
    tenantId: string | null;
    type: ChatThreadType;
    clientId: string | null;
    trainerId: string | null;
    groupId: string | null;
  }
): Promise<boolean> {
  if (thread.type === 'PLATFORM_TESTERS') {
    return actor.kind === 'SUPER_ADMIN' || actor.kind === 'TESTER';
  }
  if (thread.type === 'SUPER_ADMINS') {
    return actor.kind === 'SUPER_ADMIN';
  }

  if (isPlatformActor(actor)) return false;
  if (thread.tenantId !== actor.tenantId) return false;

  const school = actor;
  const isAdmin = school.kind === 'USER' && (school.role === 'OWNER' || school.role === 'ADMIN');
  const isTrainer = school.kind === 'USER' && school.role === 'TRAINER';
  const clientId = subjectClientId(school);

  switch (thread.type) {
    case 'CLIENT_ADMIN': {
      if (isAdmin) return true;
      if (clientId && thread.clientId === clientId) return true;
      return false;
    }
    case 'CLIENT_TRAINER': {
      if (clientId && thread.clientId === clientId) return true;
      if (isTrainer && school.kind === 'USER' && school.trainerId && thread.trainerId === school.trainerId) {
        if (!thread.clientId || !thread.trainerId) return false;
        const groups = await prisma.group.findMany({
          where: { tenantId: school.tenantId, trainerId: school.trainerId, isActive: true },
          select: { id: true },
        });
        if (groups.length === 0) return false;
        const member = await prisma.groupMembership.findFirst({
          where: {
            clientId: thread.clientId,
            isActive: true,
            groupId: { in: groups.map((g) => g.id) },
          },
        });
        return Boolean(member);
      }
      return false;
    }
    case 'GROUP': {
      if (!thread.groupId) return false;
      const group = await prisma.group.findFirst({
        where: { id: thread.groupId, tenantId: school.tenantId },
      });
      if (!group) return false;
      if (isTrainer && school.kind === 'USER' && school.trainerId === group.trainerId) return true;
      if (clientId) return isActiveGroupMember(clientId, group.id);
      return false;
    }
    case 'TRAINER_ADMIN': {
      if (isAdmin) return true;
      if (isTrainer && school.kind === 'USER' && school.trainerId && thread.trainerId === school.trainerId) {
        return true;
      }
      return false;
    }
    case 'TRAINERS': {
      return isTrainer;
    }
    default:
      return false;
  }
}

async function assertCanEnsure(actor: ChatActor, input: EnsureThreadInput): Promise<void> {
  if (input.type === 'PLATFORM_TESTERS') {
    if (actor.kind === 'SUPER_ADMIN' || actor.kind === 'TESTER') return;
    throw forbidden('Нет доступа');
  }
  if (input.type === 'SUPER_ADMINS') {
    if (actor.kind === 'SUPER_ADMIN') return;
    throw forbidden('Нет доступа');
  }

  if (isPlatformActor(actor)) throw forbidden('Нет доступа');

  const school = actor;
  const isAdmin = school.kind === 'USER' && (school.role === 'OWNER' || school.role === 'ADMIN');
  const isTrainer = school.kind === 'USER' && school.role === 'TRAINER';
  const clientId = subjectClientId(school);

  switch (input.type) {
    case 'CLIENT_ADMIN': {
      if (!input.clientId) throw badRequest('clientId обязателен');
      if (isAdmin) return;
      if (clientId === input.clientId) return;
      throw forbidden('Нет доступа');
    }
    case 'CLIENT_TRAINER': {
      if (!input.clientId || !input.trainerId) throw badRequest('clientId и trainerId обязательны');
      if (clientId === input.clientId) return;
      if (isTrainer && school.kind === 'USER' && school.trainerId === input.trainerId) return;
      throw forbidden('Нет доступа');
    }
    case 'GROUP': {
      if (!input.groupId) throw badRequest('groupId обязателен');
      const group = await prisma.group.findFirst({
        where: { id: input.groupId, tenantId: school.tenantId },
      });
      if (!group) throw notFound('Группа не найдена');
      if (isTrainer && school.kind === 'USER' && school.trainerId === group.trainerId) return;
      if (clientId && (await isActiveGroupMember(clientId, group.id))) return;
      throw forbidden('Нет доступа');
    }
    case 'TRAINER_ADMIN': {
      if (!input.trainerId) throw badRequest('trainerId обязателен');
      if (isAdmin) return;
      if (isTrainer && school.kind === 'USER' && school.trainerId === input.trainerId) return;
      throw forbidden('Нет доступа');
    }
    case 'TRAINERS': {
      if (isTrainer) return;
      throw forbidden('Только для тренеров');
    }
    default:
      throw badRequest('Неизвестный тип чата');
  }
}

export async function ensureThread(actor: ChatActor, input: EnsureThreadInput) {
  await assertCanEnsure(actor, input);
  const tenantId = actorTenantId(actor);
  const threadKey = threadKeyFor(input, tenantId);

  const existing = await prisma.chatThread.findUnique({
    where: { threadKey },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, middleName: true } },
      trainer: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true, middleName: true } },
        },
      },
      group: { select: { id: true, name: true } },
    },
  });
  if (existing) return existing;

  return prisma.chatThread.create({
    data: {
      tenantId,
      type: input.type,
      threadKey,
      clientId: input.clientId || null,
      trainerId: input.trainerId || null,
      groupId: input.groupId || null,
    },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, middleName: true } },
      trainer: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true, middleName: true } },
        },
      },
      group: { select: { id: true, name: true } },
    },
  });
}

function titleForCandidate(
  type: ChatThreadType,
  meta: {
    clientName?: string;
    trainerName?: string;
    groupName?: string;
  },
  actor: ChatActor
): { title: string; subtitle: string } {
  if (type === 'PLATFORM_TESTERS') {
    return { title: 'Тестировщики', subtitle: 'Платформа' };
  }
  if (type === 'SUPER_ADMINS') {
    return { title: 'Супер-админы', subtitle: 'Платформа' };
  }

  const isStaff = actor.kind === 'USER';
  const isAdminStaff = isStaff && (actor.role === 'OWNER' || actor.role === 'ADMIN');

  switch (type) {
    case 'CLIENT_ADMIN':
      if (isStaff) {
        return {
          title: meta.clientName || 'Клиент',
          subtitle: meta.groupName ? `Клиент — ${meta.groupName}` : 'Клиент',
        };
      }
      return { title: 'Администрация', subtitle: 'Школа' };
    case 'CLIENT_TRAINER':
      if (isStaff) {
        return {
          title: meta.clientName || 'Клиент',
          subtitle: meta.groupName ? `Клиент — ${meta.groupName}` : 'Клиент',
        };
      }
      return { title: meta.trainerName || 'Тренер', subtitle: 'Тренер' };
    case 'GROUP':
      return {
        title: meta.groupName || 'Группа',
        subtitle: isStaff ? 'Группа' : 'Беседа группы',
      };
    case 'TRAINER_ADMIN':
      if (isAdminStaff) {
        return { title: meta.trainerName || 'Тренер', subtitle: 'Тренер' };
      }
      return { title: 'Администрация', subtitle: 'Администрация' };
    case 'TRAINERS':
      return { title: 'Тренеры', subtitle: 'Общая беседа тренеров' };
    default:
      return { title: 'Чат', subtitle: '' };
  }
}

function ownMessageNotFilter(actor: ChatActor): Prisma.ChatMessageWhereInput {
  if (actor.kind === 'USER') return { authorType: 'USER', authorUserId: actor.userId };
  if (actor.kind === 'CLIENT') return { authorType: 'CLIENT', authorClientId: actor.clientId };
  if (actor.kind === 'PARENT') return { authorType: 'PARENT', authorParentId: actor.parentId };
  if (actor.kind === 'SUPER_ADMIN') {
    return { authorType: 'SUPER_ADMIN', authorSuperAdminId: actor.superAdminId };
  }
  return { authorType: 'TESTER', authorTesterId: actor.testerId };
}

async function unreadForThread(
  threadId: string,
  lastMessageAt: Date | null,
  actor: ChatActor
): Promise<number> {
  if (!lastMessageAt) return 0;
  const { readerType, readerId } = readerOf(actor);
  const read = await prisma.chatThreadRead.findUnique({
    where: {
      threadId_readerType_readerId: { threadId, readerType, readerId },
    },
  });
  const since = read?.lastReadAt || new Date(0);
  return prisma.chatMessage.count({
    where: {
      threadId,
      createdAt: { gt: since },
      NOT: ownMessageNotFilter(actor),
    },
  });
}

async function lastPreview(threadId: string): Promise<string | null> {
  const msg = await prisma.chatMessage.findFirst({
    where: { threadId },
    orderBy: { createdAt: 'desc' },
    select: { body: true },
  });
  if (!msg) return null;
  return msg.body.length > 120 ? `${msg.body.slice(0, 117)}…` : msg.body;
}

/** Список платформенных бесед для SA / Tester. */
export async function listPlatformThreadsForActor(actor: ChatActor): Promise<ThreadListItem[]> {
  if (actor.kind !== 'SUPER_ADMIN' && actor.kind !== 'TESTER') {
    throw forbidden('Нет доступа');
  }

  const types: ChatThreadType[] =
    actor.kind === 'SUPER_ADMIN' ? ['PLATFORM_TESTERS', 'SUPER_ADMINS'] : ['PLATFORM_TESTERS'];

  const candidates = types.map((type) => ({
    type,
    threadKey: threadKeyFor({ type }),
  }));

  const existing = await prisma.chatThread.findMany({
    where: { threadKey: { in: candidates.map((c) => c.threadKey) } },
  });
  const existingByKey = new Map(existing.map((t) => [t.threadKey, t]));

  const items: ThreadListItem[] = [];
  for (const c of candidates) {
    const { title, subtitle } = titleForCandidate(c.type, {}, actor);
    const thread = existingByKey.get(c.threadKey);
    const ensurePayload: EnsureThreadInput = { type: c.type };
    if (thread) {
      const [preview, unreadCount] = await Promise.all([
        lastPreview(thread.id),
        unreadForThread(thread.id, thread.lastMessageAt, actor),
      ]);
      items.push({
        id: thread.id,
        type: c.type,
        threadKey: c.threadKey,
        title,
        subtitle,
        clientId: null,
        trainerId: null,
        groupId: null,
        lastMessageAt: thread.lastMessageAt?.toISOString() || null,
        lastMessagePreview: preview,
        unreadCount,
        ensurePayload,
        presenceStatus: null,
      });
    } else {
      items.push({
        id: null,
        type: c.type,
        threadKey: c.threadKey,
        title,
        subtitle,
        clientId: null,
        trainerId: null,
        groupId: null,
        lastMessageAt: null,
        lastMessagePreview: null,
        unreadCount: 0,
        ensurePayload,
        presenceStatus: null,
      });
    }
  }

  return items;
}

/** Список доступных бесед (виртуальные + существующие). */
export async function listThreadsForActor(actor: ChatActor): Promise<ThreadListItem[]> {
  if (isPlatformActor(actor)) {
    return listPlatformThreadsForActor(actor);
  }

  type Candidate = {
    type: ChatThreadType;
    threadKey: string;
    clientId?: string;
    trainerId?: string;
    groupId?: string;
    clientName?: string;
    trainerName?: string;
    groupName?: string;
  };

  const candidates: Candidate[] = [];
  const tenantId = actor.tenantId;

  if (actor.kind === 'CLIENT' || actor.kind === 'PARENT') {
    const clientId = actor.clientId;
    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId },
      select: { firstName: true, lastName: true, middleName: true },
    });
    const clientName = personName([client?.lastName, client?.firstName, client?.middleName]);

    candidates.push({
      type: 'CLIENT_ADMIN',
      threadKey: threadKeyFor({ type: 'CLIENT_ADMIN', clientId }, tenantId),
      clientId,
      clientName,
    });

    const memberships = await prisma.groupMembership.findMany({
      where: { clientId, isActive: true, group: { tenantId, isActive: true } },
      include: {
        group: {
          include: {
            trainer: {
              include: { user: { select: { firstName: true, lastName: true, middleName: true } } },
            },
          },
        },
      },
    });

    const trainerSeen = new Set<string>();
    for (const m of memberships) {
      const g = m.group;
      candidates.push({
        type: 'GROUP',
        threadKey: threadKeyFor({ type: 'GROUP', groupId: g.id }, tenantId),
        groupId: g.id,
        groupName: g.name,
      });
      if (!trainerSeen.has(g.trainerId)) {
        trainerSeen.add(g.trainerId);
        const trainerName = personName([
          g.trainer.user.lastName,
          g.trainer.user.firstName,
          g.trainer.user.middleName,
        ]);
        candidates.push({
          type: 'CLIENT_TRAINER',
          threadKey: threadKeyFor(
            { type: 'CLIENT_TRAINER', clientId, trainerId: g.trainerId },
            tenantId
          ),
          clientId,
          trainerId: g.trainerId,
          clientName,
          trainerName,
        });
      }
    }
  } else if (actor.kind === 'USER' && (actor.role === 'OWNER' || actor.role === 'ADMIN')) {
    const [clients, trainers] = await Promise.all([
      prisma.client.findMany({
        where: { tenantId, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          groupMemberships: {
            where: { isActive: true, group: { isActive: true } },
            take: 1,
            include: { group: { select: { name: true } } },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: 500,
      }),
      prisma.trainer.findMany({
        where: { tenantId, isActive: true },
        include: { user: { select: { firstName: true, lastName: true, middleName: true } } },
        take: 200,
      }),
    ]);

    for (const c of clients) {
      candidates.push({
        type: 'CLIENT_ADMIN',
        threadKey: threadKeyFor({ type: 'CLIENT_ADMIN', clientId: c.id }, tenantId),
        clientId: c.id,
        clientName: personName([c.lastName, c.firstName, c.middleName]),
        groupName: c.groupMemberships[0]?.group?.name,
      });
    }
    for (const t of trainers) {
      candidates.push({
        type: 'TRAINER_ADMIN',
        threadKey: threadKeyFor({ type: 'TRAINER_ADMIN', trainerId: t.id }, tenantId),
        trainerId: t.id,
        trainerName: personName([t.user.lastName, t.user.firstName, t.user.middleName]),
      });
    }
  } else if (actor.kind === 'USER' && actor.role === 'TRAINER' && actor.trainerId) {
    const trainerId = actor.trainerId;
    candidates.push({
      type: 'TRAINER_ADMIN',
      threadKey: threadKeyFor({ type: 'TRAINER_ADMIN', trainerId }, tenantId),
      trainerId,
    });
    candidates.push({
      type: 'TRAINERS',
      threadKey: threadKeyFor({ type: 'TRAINERS' }, tenantId),
    });

    const groups = await prisma.group.findMany({
      where: { tenantId, trainerId, isActive: true },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            client: { select: { id: true, firstName: true, lastName: true, middleName: true } },
          },
        },
      },
    });

    const clientSeen = new Set<string>();
    for (const g of groups) {
      candidates.push({
        type: 'GROUP',
        threadKey: threadKeyFor({ type: 'GROUP', groupId: g.id }, tenantId),
        groupId: g.id,
        groupName: g.name,
      });
      for (const m of g.memberships) {
        if (clientSeen.has(m.clientId)) continue;
        clientSeen.add(m.clientId);
        candidates.push({
          type: 'CLIENT_TRAINER',
          threadKey: threadKeyFor(
            { type: 'CLIENT_TRAINER', clientId: m.clientId, trainerId },
            tenantId
          ),
          clientId: m.clientId,
          trainerId,
          clientName: personName([m.client.lastName, m.client.firstName, m.client.middleName]),
          groupName: g.name,
        });
      }
    }
  }

  const byKey = new Map<string, Candidate>();
  for (const c of candidates) {
    if (!byKey.has(c.threadKey)) byKey.set(c.threadKey, c);
  }
  const unique = Array.from(byKey.values());

  const existing = await prisma.chatThread.findMany({
    where: {
      tenantId,
      threadKey: { in: unique.map((u) => u.threadKey) },
    },
  });
  const existingByKey = new Map(existing.map((t) => [t.threadKey, t]));

  const items: ThreadListItem[] = [];
  for (const c of unique) {
    const { title, subtitle } = titleForCandidate(
      c.type,
      {
        clientName: c.clientName,
        trainerName: c.trainerName,
        groupName: c.groupName,
      },
      actor
    );
    const thread = existingByKey.get(c.threadKey);
    const ensurePayload: EnsureThreadInput = {
      type: c.type,
      clientId: c.clientId,
      trainerId: c.trainerId,
      groupId: c.groupId,
    };
    const presenceStatus = await resolvePresenceForCandidate(actor, c.type, {
      clientId: c.clientId,
      trainerId: c.trainerId,
    });

    if (thread) {
      const [preview, unreadCount] = await Promise.all([
        lastPreview(thread.id),
        unreadForThread(thread.id, thread.lastMessageAt, actor),
      ]);
      items.push({
        id: thread.id,
        type: c.type,
        threadKey: c.threadKey,
        title,
        subtitle,
        clientId: c.clientId || null,
        trainerId: c.trainerId || null,
        groupId: c.groupId || null,
        lastMessageAt: thread.lastMessageAt?.toISOString() || null,
        lastMessagePreview: preview,
        unreadCount,
        ensurePayload,
        presenceStatus,
      });
    } else {
      items.push({
        id: null,
        type: c.type,
        threadKey: c.threadKey,
        title,
        subtitle,
        clientId: c.clientId || null,
        trainerId: c.trainerId || null,
        groupId: c.groupId || null,
        lastMessageAt: null,
        lastMessagePreview: null,
        unreadCount: 0,
        ensurePayload,
        presenceStatus,
      });
    }
  }

  items.sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return a.title.localeCompare(b.title, 'ru');
  });

  return items;
}

export async function getMessages(
  actor: ChatActor,
  threadId: string,
  opts: { before?: string; limit?: number }
) {
  const thread = await prisma.chatThread.findFirst({ where: { id: threadId } });
  if (!thread || !(await canAccessThread(actor, thread))) {
    throw notFound('Чат не найден');
  }

  const limit = Math.min(Math.max(opts.limit || 50, 1), 100);
  const where: Prisma.ChatMessageWhereInput = { threadId };
  if (opts.before) {
    const beforeMsg = await prisma.chatMessage.findFirst({
      where: { id: opts.before, threadId },
    });
    if (beforeMsg) {
      where.createdAt = { lt: beforeMsg.createdAt };
    }
  }

  const messages = await prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const userIds = [...new Set(messages.filter((m) => m.authorUserId).map((m) => m.authorUserId!))];
  const clientIds = [
    ...new Set(messages.filter((m) => m.authorClientId).map((m) => m.authorClientId!)),
  ];
  const parentIds = [
    ...new Set(messages.filter((m) => m.authorParentId).map((m) => m.authorParentId!)),
  ];
  const saIds = [
    ...new Set(messages.filter((m) => m.authorSuperAdminId).map((m) => m.authorSuperAdminId!)),
  ];
  const testerIds = [
    ...new Set(messages.filter((m) => m.authorTesterId).map((m) => m.authorTesterId!)),
  ];

  const [users, clients, parents, superAdmins, testers] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, middleName: true, role: true },
        })
      : [],
    clientIds.length
      ? prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, firstName: true, lastName: true, middleName: true },
        })
      : [],
    parentIds.length
      ? prisma.parent.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, fullName: true },
        })
      : [],
    saIds.length
      ? prisma.superAdmin.findMany({
          where: { id: { in: saIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [],
    testerIds.length
      ? prisma.tester.findMany({
          where: { id: { in: testerIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [],
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const parentMap = new Map(parents.map((p) => [p.id, p]));
  const saMap = new Map(superAdmins.map((s) => [s.id, s]));
  const testerMap = new Map(testers.map((t) => [t.id, t]));

  const enriched = messages.map((m) => {
    let authorName = 'Участник';
    if (m.authorType === 'USER' && m.authorUserId) {
      const u = userMap.get(m.authorUserId);
      authorName = personName([u?.lastName, u?.firstName, u?.middleName]) || 'Сотрудник';
    } else if (m.authorType === 'CLIENT' && m.authorClientId) {
      const c = clientMap.get(m.authorClientId);
      authorName = personName([c?.lastName, c?.firstName, c?.middleName]) || 'Клиент';
    } else if (m.authorType === 'PARENT' && m.authorParentId) {
      authorName = parentMap.get(m.authorParentId)?.fullName || 'Родитель';
    } else if (m.authorType === 'SUPER_ADMIN' && m.authorSuperAdminId) {
      const s = saMap.get(m.authorSuperAdminId);
      authorName = personName([s?.lastName, s?.firstName]) || 'Супер-админ';
    } else if (m.authorType === 'TESTER' && m.authorTesterId) {
      const t = testerMap.get(m.authorTesterId);
      authorName = personName([t?.lastName, t?.firstName]) || 'Тестировщик';
    }
    return {
      id: m.id,
      threadId: m.threadId,
      body: m.body,
      authorType: m.authorType,
      authorClientId: m.authorClientId,
      authorParentId: m.authorParentId,
      authorUserId: m.authorUserId,
      authorSuperAdminId: m.authorSuperAdminId,
      authorTesterId: m.authorTesterId,
      authorName,
      createdAt: m.createdAt.toISOString(),
    };
  });

  return {
    threadId,
    messages: enriched.reverse(),
    hasMore: messages.length === limit,
  };
}

export type CreatedMessagePayload = {
  id: string;
  threadId: string;
  tenantId: string | null;
  body: string;
  authorType: string;
  authorClientId: string | null;
  authorParentId: string | null;
  authorUserId: string | null;
  authorSuperAdminId: string | null;
  authorTesterId: string | null;
  authorName: string;
  createdAt: string;
};

let emitChatMessage: ((payload: CreatedMessagePayload) => void) | null = null;
let emitChatUnread:
  | ((opts: {
      thread: {
        id: string;
        tenantId: string | null;
        type: ChatThreadType;
        clientId: string | null;
        trainerId: string | null;
        groupId: string | null;
      };
      author: ChatActor;
    }) => void)
  | null = null;

export function setChatMessageEmitter(fn: (payload: CreatedMessagePayload) => void): void {
  emitChatMessage = fn;
}

export function setChatUnreadEmitter(
  fn: (opts: {
    thread: {
      id: string;
      tenantId: string | null;
      type: ChatThreadType;
      clientId: string | null;
      trainerId: string | null;
      groupId: string | null;
    };
    author: ChatActor;
  }) => void
): void {
  emitChatUnread = fn;
}

export async function createMessage(actor: ChatActor, threadId: string, bodyRaw: string) {
  const body = String(bodyRaw || '').trim();
  if (!body) throw badRequest('Пустое сообщение');
  if (body.length > 5000) throw badRequest('Слишком длинное сообщение');

  const thread = await prisma.chatThread.findFirst({ where: { id: threadId } });
  if (!thread || !(await canAccessThread(actor, thread))) {
    throw notFound('Чат не найден');
  }

  const authorType =
    actor.kind === 'USER'
      ? 'USER'
      : actor.kind === 'CLIENT'
        ? 'CLIENT'
        : actor.kind === 'PARENT'
          ? 'PARENT'
          : actor.kind === 'SUPER_ADMIN'
            ? 'SUPER_ADMIN'
            : 'TESTER';

  const message = await prisma.chatMessage.create({
    data: {
      threadId,
      tenantId: thread.tenantId,
      body,
      authorType,
      authorUserId: actor.kind === 'USER' ? actor.userId : null,
      authorClientId: actor.kind === 'CLIENT' ? actor.clientId : null,
      authorParentId: actor.kind === 'PARENT' ? actor.parentId : null,
      authorSuperAdminId: actor.kind === 'SUPER_ADMIN' ? actor.superAdminId : null,
      authorTesterId: actor.kind === 'TESTER' ? actor.testerId : null,
    },
  });

  await prisma.chatThread.update({
    where: { id: threadId },
    data: { lastMessageAt: message.createdAt },
  });

  const { readerType, readerId } = readerOf(actor);
  await prisma.chatThreadRead.upsert({
    where: {
      threadId_readerType_readerId: { threadId, readerType, readerId },
    },
    create: { threadId, readerType, readerId, lastReadAt: message.createdAt },
    update: { lastReadAt: message.createdAt },
  });

  let authorName = 'Участник';
  if (actor.kind === 'USER') {
    const u = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { firstName: true, lastName: true, middleName: true },
    });
    authorName = personName([u?.lastName, u?.firstName, u?.middleName]) || 'Сотрудник';
  } else if (actor.kind === 'CLIENT') {
    const c = await prisma.client.findUnique({
      where: { id: actor.clientId },
      select: { firstName: true, lastName: true, middleName: true },
    });
    authorName = personName([c?.lastName, c?.firstName, c?.middleName]) || 'Клиент';
  } else if (actor.kind === 'PARENT') {
    const p = await prisma.parent.findUnique({
      where: { id: actor.parentId },
      select: { fullName: true },
    });
    authorName = p?.fullName || 'Родитель';
  } else if (actor.kind === 'SUPER_ADMIN') {
    const s = await prisma.superAdmin.findUnique({
      where: { id: actor.superAdminId },
      select: { firstName: true, lastName: true },
    });
    authorName = personName([s?.lastName, s?.firstName]) || 'Супер-админ';
  } else {
    const t = await prisma.tester.findUnique({
      where: { id: actor.testerId },
      select: { firstName: true, lastName: true },
    });
    authorName = personName([t?.lastName, t?.firstName]) || 'Тестировщик';
  }

  const payload: CreatedMessagePayload = {
    id: message.id,
    threadId: message.threadId,
    tenantId: message.tenantId,
    body: message.body,
    authorType: message.authorType,
    authorClientId: message.authorClientId,
    authorParentId: message.authorParentId,
    authorUserId: message.authorUserId,
    authorSuperAdminId: message.authorSuperAdminId,
    authorTesterId: message.authorTesterId,
    authorName,
    createdAt: message.createdAt.toISOString(),
  };

  if (emitChatMessage) {
    try {
      emitChatMessage(payload);
    } catch (e) {
      console.error('chat emit error', e);
    }
  }

  if (emitChatUnread) {
    try {
      emitChatUnread({ thread, author: actor });
    } catch (e) {
      console.error('chat unread emit error', e);
    }
  }

  return payload;
}

export async function markThreadRead(actor: ChatActor, threadId: string) {
  const thread = await prisma.chatThread.findFirst({ where: { id: threadId } });
  if (!thread || !(await canAccessThread(actor, thread))) {
    throw notFound('Чат не найден');
  }
  const { readerType, readerId } = readerOf(actor);
  const now = new Date();
  await prisma.chatThreadRead.upsert({
    where: {
      threadId_readerType_readerId: { threadId, readerType, readerId },
    },
    create: { threadId, readerType, readerId, lastReadAt: now },
    update: { lastReadAt: now },
  });
  return { ok: true, lastReadAt: now.toISOString() };
}

export async function resolveStaffActor(userId: string, tenantId: string): Promise<ChatActor> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, isActive: true },
    include: { trainer: { select: { id: true } } },
  });
  if (!user) throw new HttpError(401, 'Пользователь не найден');
  return {
    kind: 'USER',
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    trainerId: user.trainer?.id || null,
  };
}

export async function resolveClientActor(opts: {
  clientId?: string;
  parentId?: string;
  tenantId: string;
}): Promise<ChatActor> {
  if (opts.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: opts.clientId, tenantId: opts.tenantId },
    });
    if (!client) throw new HttpError(401, 'Клиент не найден');
    return { kind: 'CLIENT', clientId: client.id, tenantId: client.tenantId };
  }
  if (opts.parentId) {
    const parent = await prisma.parent.findFirst({
      where: { id: opts.parentId, tenantId: opts.tenantId },
    });
    if (!parent) throw new HttpError(401, 'Родитель не найден');
    return {
      kind: 'PARENT',
      parentId: parent.id,
      clientId: parent.clientId,
      tenantId: parent.tenantId,
    };
  }
  throw new HttpError(401, 'Нет актора');
}

export function resolveSuperAdminActor(superAdminId: string): ChatActor {
  return { kind: 'SUPER_ADMIN', superAdminId };
}

export function resolveTesterActor(testerId: string): ChatActor {
  return { kind: 'TESTER', testerId };
}

export function presenceKeyForActor(actor: ChatActor): string {
  if (actor.kind === 'USER') return presenceKeyUser(actor.userId);
  if (actor.kind === 'CLIENT') return presenceKeyClient(actor.clientId);
  if (actor.kind === 'PARENT') return presenceKeyParent(actor.parentId);
  if (actor.kind === 'SUPER_ADMIN') return presenceKeySuperAdmin(actor.superAdminId);
  return presenceKeyTester(actor.testerId);
}

/** Сумма непрочитанных по всем доступным беседам (для бейджа в меню). */
export async function getUnreadTotalForActor(actor: ChatActor): Promise<number> {
  const items = await listThreadsForActor(actor);
  return items.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
}

/**
 * Presence-keys участников треда кроме автора — для chat:unread в personal rooms.
 */
export async function resolvePeerPresenceKeys(
  thread: {
    tenantId: string | null;
    type: ChatThreadType;
    clientId: string | null;
    trainerId: string | null;
    groupId: string | null;
  },
  author: ChatActor
): Promise<string[]> {
  const keys = new Set<string>();
  const authorKey = presenceKeyForActor(author);

  if (thread.type === 'PLATFORM_TESTERS') {
    const [sas, testers] = await Promise.all([
      prisma.superAdmin.findMany({ where: { isActive: true }, select: { id: true } }),
      prisma.tester.findMany({ where: { isActive: true }, select: { id: true } }),
    ]);
    for (const s of sas) keys.add(presenceKeySuperAdmin(s.id));
    for (const t of testers) keys.add(presenceKeyTester(t.id));
  } else if (thread.type === 'SUPER_ADMINS') {
    const sas = await prisma.superAdmin.findMany({ where: { isActive: true }, select: { id: true } });
    for (const s of sas) keys.add(presenceKeySuperAdmin(s.id));
  } else if (thread.tenantId) {
    const tenantId = thread.tenantId;

    const addClientAndParents = async (clientId: string) => {
      keys.add(presenceKeyClient(clientId));
      const parents = await prisma.parent.findMany({
        where: { clientId, isApproved: true },
        select: { id: true },
      });
      for (const p of parents) keys.add(presenceKeyParent(p.id));
    };

    const addAdmins = async () => {
      const admins = await prisma.user.findMany({
        where: { tenantId, isActive: true, role: { in: ['OWNER', 'ADMIN'] } },
        select: { id: true },
      });
      for (const u of admins) keys.add(presenceKeyUser(u.id));
    };

    switch (thread.type) {
      case 'CLIENT_ADMIN': {
        if (thread.clientId) await addClientAndParents(thread.clientId);
        await addAdmins();
        break;
      }
      case 'CLIENT_TRAINER': {
        if (thread.clientId) await addClientAndParents(thread.clientId);
        if (thread.trainerId) {
          const trainer = await prisma.trainer.findFirst({
            where: { id: thread.trainerId },
            select: { userId: true },
          });
          if (trainer) keys.add(presenceKeyUser(trainer.userId));
        }
        break;
      }
      case 'TRAINER_ADMIN': {
        if (thread.trainerId) {
          const trainer = await prisma.trainer.findFirst({
            where: { id: thread.trainerId },
            select: { userId: true },
          });
          if (trainer) keys.add(presenceKeyUser(trainer.userId));
        }
        await addAdmins();
        break;
      }
      case 'GROUP': {
        if (thread.groupId) {
          const group = await prisma.group.findFirst({
            where: { id: thread.groupId },
            include: {
              memberships: { where: { isActive: true }, select: { clientId: true } },
              trainer: { select: { userId: true } },
            },
          });
          if (group) {
            keys.add(presenceKeyUser(group.trainer.userId));
            for (const m of group.memberships) {
              await addClientAndParents(m.clientId);
            }
          }
        }
        break;
      }
      case 'TRAINERS': {
        const trainers = await prisma.trainer.findMany({
          where: { tenantId, isActive: true },
          select: { userId: true },
        });
        for (const t of trainers) keys.add(presenceKeyUser(t.userId));
        break;
      }
      default:
        break;
    }
  }

  keys.delete(authorKey);
  return Array.from(keys);
}

export function actorPersonalRoom(presenceKey: string): string {
  return `chat:actor:${presenceKey}`;
}
