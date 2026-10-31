import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import {
  absoluteUploadPath,
  decodeUploadOriginalName,
  ensureUploadDir,
  safeUnlink,
} from '../utils/fileStorage';
import { badRequest, notFound } from '../utils/httpError';

const REL_DIR = 'mobile-app';

type ApkSettings = {
  id: string;
  mobileApkPath: string | null;
  mobileApkOriginalName: string | null;
  mobileApkSize: number | null;
  mobileApkLabel: string | null;
  mobileApkUploadedAt: Date | null;
};

async function ensureSettings(): Promise<ApkSettings> {
  let settings = (await prisma.superAdminSettings.findFirst()) as ApkSettings | null;
  if (!settings) {
    settings = (await prisma.superAdminSettings.create({ data: {} })) as ApkSettings;
  }
  return settings;
}

function serialize(settings: ApkSettings) {
  const hasFile = Boolean(settings.mobileApkPath);
  return {
    hasFile,
    originalName: settings.mobileApkOriginalName ?? null,
    size: settings.mobileApkSize ?? null,
    label: settings.mobileApkLabel ?? null,
    uploadedAt: settings.mobileApkUploadedAt ?? null,
  };
}

export class MobileApkService {
  static async getMeta() {
    const settings = await ensureSettings();
    return serialize(settings);
  }

  static async replace(file: Express.Multer.File, label?: string | null) {
    const originalName = decodeUploadOriginalName(file.originalname || 'app.apk');
    const lower = originalName.toLowerCase();
    if (!lower.endsWith('.apk')) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
      throw badRequest('Допускаются только файлы .apk');
    }

    ensureUploadDir(REL_DIR);
    const relPath = path.join(REL_DIR, path.basename(file.path)).replace(/\\/g, '/');

    const settings = await ensureSettings();
    if (settings.mobileApkPath && settings.mobileApkPath !== relPath) {
      safeUnlink(settings.mobileApkPath);
    }

    const updated = (await prisma.superAdminSettings.update({
      where: { id: settings.id },
      data: {
        mobileApkPath: relPath,
        mobileApkOriginalName: originalName,
        mobileApkSize: file.size,
        mobileApkLabel: label != null && String(label).trim() ? String(label).trim() : null,
        mobileApkUploadedAt: new Date(),
      } as any,
    })) as ApkSettings;

    return serialize(updated);
  }

  static async updateLabel(label: string | null) {
    const settings = await ensureSettings();
    if (!settings.mobileApkPath) throw notFound('APK ещё не загружен');
    const updated = (await prisma.superAdminSettings.update({
      where: { id: settings.id },
      data: {
        mobileApkLabel: label != null && String(label).trim() ? String(label).trim() : null,
      } as any,
    })) as ApkSettings;
    return serialize(updated);
  }

  static async remove() {
    const settings = await ensureSettings();
    if (settings.mobileApkPath) safeUnlink(settings.mobileApkPath);
    const updated = (await prisma.superAdminSettings.update({
      where: { id: settings.id },
      data: {
        mobileApkPath: null,
        mobileApkOriginalName: null,
        mobileApkSize: null,
        mobileApkLabel: null,
        mobileApkUploadedAt: null,
      } as any,
    })) as ApkSettings;
    return serialize(updated);
  }

  /** Только для SA-скачивания; публичных маршрутов нет. */
  static async resolveForDownload() {
    const settings = await ensureSettings();
    if (!settings.mobileApkPath) throw notFound('APK не загружен');
    const abs = absoluteUploadPath(settings.mobileApkPath);
    if (!fs.existsSync(abs)) throw notFound('Файл APK отсутствует на диске');
    return {
      abs,
      fileName: settings.mobileApkOriginalName || 'profsport.apk',
      size: settings.mobileApkSize,
    };
  }
}
