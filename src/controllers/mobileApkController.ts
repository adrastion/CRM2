import { Response } from 'express';
import fs from 'fs';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { MobileApkService } from '../services/mobileApkService';

export const getMobileApkMeta = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MobileApkService.getMeta();
    res.json({ success: true, data });
  }
);

export const uploadMobileApk = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const uploaded = (req as any).file as Express.Multer.File | undefined;
    if (!uploaded) {
      res.status(400).json({ success: false, error: 'Прикрепите APK-файл' });
      return;
    }
    const label =
      typeof req.body?.label === 'string' ? req.body.label : undefined;
    try {
      const data = await MobileApkService.replace(uploaded, label);
      try {
        const { emitPlatformRealtime } = await import('../services/realtimeBus');
        emitPlatformRealtime({
          entity: 'mobile-apk',
          action: 'uploaded',
          meta: { label: data.label, originalName: data.originalName },
        });
      } catch (e) {
        console.warn('[realtime] apk upload emit failed', e);
      }
      res.json({ success: true, data });
    } catch (e: any) {
      const status = e?.statusCode || e?.status || 400;
      res.status(status).json({ success: false, error: e?.message || 'Не удалось загрузить APK' });
    }
  }
);

export const updateMobileApkLabel = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const label = req.body?.label == null ? null : String(req.body.label);
    try {
      const data = await MobileApkService.updateLabel(label);
      try {
        const { emitPlatformRealtime } = await import('../services/realtimeBus');
        emitPlatformRealtime({
          entity: 'mobile-apk',
          action: 'updated',
          meta: { label: data.label },
        });
      } catch (e) {
        console.warn('[realtime] apk label emit failed', e);
      }
      res.json({ success: true, data });
    } catch (e: any) {
      const status = e?.statusCode || e?.status || 400;
      res.status(status).json({ success: false, error: e?.message || 'Не удалось обновить подпись' });
    }
  }
);

export const deleteMobileApk = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MobileApkService.remove();
    try {
      const { emitPlatformRealtime } = await import('../services/realtimeBus');
      emitPlatformRealtime({
        entity: 'mobile-apk',
        action: 'removed',
      });
    } catch (e) {
      console.warn('[realtime] apk delete emit failed', e);
    }
    res.json({ success: true, data });
  }
);

/** Скачивание только для супер-админа (маршрут за authenticateSuperAdmin). */
export const downloadMobileApk = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const file = await MobileApkService.resolveForDownload();
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${file.fileName.replace(/"/g, '_')}"`
      );
      if (file.size != null) res.setHeader('Content-Length', String(file.size));
      fs.createReadStream(file.abs).pipe(res);
    } catch (e: any) {
      const status = e?.statusCode || e?.status || 404;
      res.status(status).json({ success: false, error: e?.message || 'APK не найден' });
    }
  }
);
