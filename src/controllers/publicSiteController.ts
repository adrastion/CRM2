import { Request, Response } from 'express';
import fs from 'fs';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { PublicSiteService } from '../services/publicSiteService';
import { prisma } from '../lib/prisma';
import { isHttpUrl, sendStoredUpload } from '../utils/marketerCabinetFiles';

export const getPublicSiteConfig = asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
  const data = await PublicSiteService.getPublicConfig();
  res.json({ success: true, data });
});

export const getPublicNews = asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
  const data = await PublicSiteService.listPublicNews();
  res.json({ success: true, data });
});

export const getPublicVacancies = asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
  const data = await PublicSiteService.listPublicVacancies();
  res.json({ success: true, data });
});

export const postPublicFeedback = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  try {
    const data = await PublicSiteService.submitFeedback({
      name: req.body?.name,
      contact: req.body?.contact,
      body: req.body?.body,
    });
    res.json({ success: true, data: { id: data.id } });
  } catch (e: any) {
    const status = e?.statusCode || e?.status || 400;
    res.status(status).json({ success: false, error: e?.message || 'Не удалось отправить' });
  }
});

export const postVacancyApplication = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  try {
    const data = await PublicSiteService.applyToVacancy(req.params.id, {
      name: req.body?.name,
      contacts: req.body?.contacts,
      message: req.body?.message,
    });
    res.json({ success: true, data: { id: data.id } });
  } catch (e: any) {
    const status = e?.statusCode || e?.status || 400;
    res.status(status).json({ success: false, error: e?.message || 'Не удалось отправить заявку' });
  }
});

/** Публичное изображение новости (только isPublicOnSite + опубликовано). */
export const getPublicNewsImage = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const now = new Date();
  const entry = await prisma.platformChangelogEntry.findFirst({
    where: { id, isPublicOnSite: true, publishedAt: { lte: now } },
  });
  if (!entry?.imageUrl) {
    res.status(404).json({ success: false, error: 'Изображение не найдено' });
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

export const downloadPublicApk = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const file = await PublicSiteService.assertPublicApkDownload();
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName.replace(/"/g, '_')}"`
    );
    if (file.size != null) res.setHeader('Content-Length', String(file.size));
    fs.createReadStream(file.abs).pipe(res);
  } catch (e: any) {
    const status = e?.statusCode || e?.status || 404;
    res.status(status).json({ success: false, error: e?.message || 'APK недоступен' });
  }
});

// ——— SA ———

export const getAdminPublicSiteSettings = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await PublicSiteService.getAdminSiteSettings();
    res.json({ success: true, data });
  }
);

export const updateAdminPublicSiteSettings = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    try {
      const data = await PublicSiteService.updateAdminSiteSettings({
        socialLinks: req.body?.socialLinks,
        landingVariant: req.body?.landingVariant,
        download: req.body?.download,
      });
      res.json({ success: true, data });
    } catch (e: any) {
      const status = e?.statusCode || e?.status || 400;
      res.status(status).json({ success: false, error: e?.message || 'Не удалось сохранить' });
    }
  }
);

export const listAdminVacancies = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await PublicSiteService.listVacanciesAdmin();
    res.json({ success: true, data });
  }
);

export const createAdminVacancy = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    try {
      const data = await PublicSiteService.createVacancy(req.body || {});
      res.json({ success: true, data });
    } catch (e: any) {
      const status = e?.statusCode || e?.status || 400;
      res.status(status).json({ success: false, error: e?.message || 'Не удалось создать' });
    }
  }
);

export const updateAdminVacancy = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    try {
      const data = await PublicSiteService.updateVacancy(req.params.id, req.body || {});
      res.json({ success: true, data });
    } catch (e: any) {
      const status = e?.statusCode || e?.status || 400;
      res.status(status).json({ success: false, error: e?.message || 'Не удалось обновить' });
    }
  }
);

export const deleteAdminVacancy = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    try {
      const data = await PublicSiteService.deleteVacancy(req.params.id);
      res.json({ success: true, data });
    } catch (e: any) {
      const status = e?.statusCode || e?.status || 400;
      res.status(status).json({ success: false, error: e?.message || 'Не удалось удалить' });
    }
  }
);

export const listAdminVacancyApplications = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const data = await PublicSiteService.listApplicationsAdmin(status);
    res.json({ success: true, data });
  }
);

export const updateAdminVacancyApplication = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    try {
      const data = await PublicSiteService.updateApplicationStatus(
        req.params.id,
        String(req.body?.status || '')
      );
      res.json({ success: true, data });
    } catch (e: any) {
      const status = e?.statusCode || e?.status || 400;
      res.status(status).json({ success: false, error: e?.message || 'Не удалось обновить' });
    }
  }
);

export const listAdminSiteFeedback = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const data = await PublicSiteService.listFeedbackAdmin(status);
    res.json({ success: true, data });
  }
);

export const updateAdminSiteFeedback = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    try {
      const data = await PublicSiteService.updateFeedbackStatus(
        req.params.id,
        String(req.body?.status || '')
      );
      res.json({ success: true, data });
    } catch (e: any) {
      const status = e?.statusCode || e?.status || 400;
      res.status(status).json({ success: false, error: e?.message || 'Не удалось обновить' });
    }
  }
);
