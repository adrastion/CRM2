import path from 'path';
import multer from 'multer';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { ensureUploadDir, uniqueUploadFilename } from '../utils/fileStorage';
import { isHttpUrl, sendStoredUpload } from '../utils/marketerCabinetFiles';

export const PLATFORM_NEWS_ROLES = [
  'SUPER_ADMIN',
  'TESTER',
  'OWNER',
  'ADMIN',
  'TRAINER',
  'PROMOTER',
  'CLIENT',
  'PARENT',
  'MARKETER',
  'PLATFORM_STAFF',
  'PROMO_CODE_ADMIN',
] as const;

export type PlatformNewsRole = (typeof PLATFORM_NEWS_ROLES)[number];

const newsUploadDir = () => ensureUploadDir('platform-news');

export const platformNewsUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, newsUploadDir()),
    filename: (_req, file, cb) => cb(null, uniqueUploadFilename(file.originalname)),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function parseAudienceRoles(raw: unknown): string[] {
  let list: string[] = [];
  if (Array.isArray(raw)) {
    list = raw.map((r) => String(r).trim().toUpperCase()).filter(Boolean);
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed.map((r) => String(r).trim().toUpperCase()).filter(Boolean);
      } else {
        list = raw.split(/[,;\s]+/).map((r) => r.trim().toUpperCase()).filter(Boolean);
      }
    } catch {
      list = raw.split(/[,;\s]+/).map((r) => r.trim().toUpperCase()).filter(Boolean);
    }
  }
  const allowed = new Set<string>(PLATFORM_NEWS_ROLES as unknown as string[]);
  // SUPER_ADMIN всегда видит все новости — в audience не храним.
  return [...new Set(list.filter((r) => allowed.has(r) && r !== 'SUPER_ADMIN'))];
}

function entryInclude() {
  return {
    createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  };
}

/** SA / Tester — полный список. Автор только для SA. */
export const listPlatformChangelog = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const includeAuthor = Boolean((req as any).superAdmin);
  const entries = await prisma.platformChangelogEntry.findMany({
    orderBy: { createdAt: 'desc' },
    include: includeAuthor ? entryInclude() : undefined,
    take: 200,
  });
  res.json({ success: true, data: entries });
});

/** Лента для роли (школа / клиент / маркетолог) — без автора. */
export const listPlatformNewsForRole = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const role = String((req as any).newsAudienceRole || '').toUpperCase();
  if (!role) {
    res.status(400).json({ success: false, error: 'Роль не определена' });
    return;
  }
  const entries = await prisma.platformChangelogEntry.findMany({
    where: { audienceRoles: { has: role } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: entries });
});

export const createPlatformChangelog = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const superAdmin = (req as any).superAdmin;
  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();
  if (!title || !body) {
    res.status(400).json({ success: false, error: 'Укажите заголовок и текст' });
    return;
  }

  let audienceRoles = parseAudienceRoles(req.body?.audienceRoles);
  if (audienceRoles.length === 0) {
    audienceRoles = ['TESTER'];
  }

  const files = req.files as
    | { image?: Express.Multer.File[]; file?: Express.Multer.File[] }
    | undefined;
  const imageFile = files?.image?.[0];
  const docFile = files?.file?.[0];
  const imageUrl = imageFile
    ? `platform-news/${imageFile.filename}`
    : String(req.body?.imageUrl || '').trim() || null;
  const fileUrl = docFile
    ? `platform-news/${docFile.filename}`
    : String(req.body?.fileUrl || '').trim() || null;

  const entry = await prisma.platformChangelogEntry.create({
    data: {
      title,
      body,
      audienceRoles,
      imageUrl,
      fileUrl,
      createdById: superAdmin.id,
    },
    include: entryInclude(),
  });

  void import('../services/actorPushService')
    .then(({ notifyChangelogPush }) =>
      notifyChangelogPush({
        title: entry.title,
        authorSuperAdminId: superAdmin.id,
        entryId: entry.id,
        audienceRoles: entry.audienceRoles,
      })
    )
    .catch((e) => console.error('changelog push notify error', e));

  res.json({ success: true, data: entry });
});

export const updatePlatformChangelog = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const id = req.params.id;
  const title = req.body?.title != null ? String(req.body.title).trim() : undefined;
  const body = req.body?.body != null ? String(req.body.body).trim() : undefined;
  if (title !== undefined && !title) {
    res.status(400).json({ success: false, error: 'Пустой заголовок' });
    return;
  }
  if (body !== undefined && !body) {
    res.status(400).json({ success: false, error: 'Пустой текст' });
    return;
  }

  const existing = await prisma.platformChangelogEntry.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Запись не найдена' });
    return;
  }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (body !== undefined) data.body = body;
  if (req.body?.audienceRoles !== undefined) {
    let roles = parseAudienceRoles(req.body.audienceRoles);
    if (roles.length === 0) roles = ['TESTER'];
    data.audienceRoles = roles;
  }

  const files = req.files as
    | { image?: Express.Multer.File[]; file?: Express.Multer.File[] }
    | undefined;
  if (files?.image?.[0]) {
    data.imageUrl = `platform-news/${files.image[0].filename}`;
  } else if (req.body?.clearImage === 'true' || req.body?.clearImage === true) {
    data.imageUrl = null;
  }
  if (files?.file?.[0]) {
    data.fileUrl = `platform-news/${files.file[0].filename}`;
  } else if (req.body?.clearFile === 'true' || req.body?.clearFile === true) {
    data.fileUrl = null;
  }

  const entry = await prisma.platformChangelogEntry.update({
    where: { id },
    data,
    include: entryInclude(),
  });
  res.json({ success: true, data: entry });
});

export const deletePlatformChangelog = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const id = req.params.id;
  const existing = await prisma.platformChangelogEntry.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Запись не найдена' });
    return;
  }
  await prisma.platformChangelogEntry.delete({ where: { id } });
  res.json({ success: true, data: { ok: true } });
});

async function assertNewsAccess(req: Request, entryId: string): Promise<boolean> {
  const entry = await prisma.platformChangelogEntry.findUnique({ where: { id: entryId } });
  if (!entry) return false;

  // SA / Tester видят полный список новостей и вложения.
  if ((req as any).superAdmin || (req as any).tester) return true;

  const role = String(
    (req as any).newsAudienceRole || (req as AuthenticatedRequest).user?.role || ''
  ).toUpperCase();
  if (!role) return false;
  return entry.audienceRoles.includes(role);
}

export const getPlatformNewsImage = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const entry = await prisma.platformChangelogEntry.findUnique({ where: { id } });
  if (!entry?.imageUrl) {
    res.status(404).json({ success: false, error: 'Изображение не найдено' });
    return;
  }
  const ok = await assertNewsAccess(req, id);
  if (!ok) {
    res.status(403).json({ success: false, error: 'Нет доступа' });
    return;
  }
  if (isHttpUrl(entry.imageUrl)) {
    res.redirect(entry.imageUrl);
    return;
  }
  if (entry.imageUrl.startsWith('platform-news/') || entry.imageUrl.startsWith('marketer-cabinet/')) {
    sendStoredUpload(res, entry.imageUrl, { inline: true });
    return;
  }
  res.status(404).json({ success: false, error: 'Изображение не найдено' });
});

export const getPlatformNewsFile = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const entry = await prisma.platformChangelogEntry.findUnique({ where: { id } });
  if (!entry?.fileUrl) {
    res.status(404).json({ success: false, error: 'Файл не найден' });
    return;
  }
  const ok = await assertNewsAccess(req, id);
  if (!ok) {
    res.status(403).json({ success: false, error: 'Нет доступа' });
    return;
  }
  if (isHttpUrl(entry.fileUrl)) {
    res.redirect(entry.fileUrl);
    return;
  }
  if (entry.fileUrl.startsWith('platform-news/') || entry.fileUrl.startsWith('marketer-cabinet/')) {
    sendStoredUpload(res, entry.fileUrl, {
      downloadName: path.basename(entry.fileUrl),
    });
    return;
  }
  res.status(404).json({ success: false, error: 'Файл не найден' });
});

/** Middleware: роль из школьного JWT. */
export function attachSchoolNewsRole(req: AuthenticatedRequest, _res: Response, next: Function) {
  (req as any).newsAudienceRole = req.user?.role;
  next();
}

/** Middleware: CLIENT / PARENT из портального JWT. */
export function attachPortalNewsRole(req: Request, _res: Response, next: Function) {
  const userType = (req as any).userType;
  (req as any).newsAudienceRole = userType === 'parent' ? 'PARENT' : 'CLIENT';
  next();
}

/** Middleware: MARKETER. */
export function attachMarketerNewsRole(req: Request, _res: Response, next: Function) {
  (req as any).newsAudienceRole = 'MARKETER';
  next();
}
