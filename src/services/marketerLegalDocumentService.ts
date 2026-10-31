import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import { absoluteUploadPath, ensureUploadDir, safeUnlink } from '../utils/fileStorage';

export const DEFAULT_MARKETER_LEGAL_PACK_VERSION = '2026-10-30-draft';

export type MarketerLegalKey = 'offer' | 'programRules' | 'pep' | 'pdn' | 'npdPayouts';

export type MarketerLegalCatalogItem = {
  key: MarketerLegalKey;
  title: string;
  fileName: string;
  sortOrder: number;
  /** Участвует в онбординге / согласиях (bump версии пакета) */
  onboarding: boolean;
};

/** Фиксированные слоты PDF-договоров маркетолога. */
export const MARKETER_LEGAL_CATALOG: MarketerLegalCatalogItem[] = [
  {
    key: 'offer',
    title: 'Оферта маркетолога',
    fileName: 'offer.pdf',
    sortOrder: 10,
    onboarding: true,
  },
  {
    key: 'programRules',
    title: 'Правила партнёрской программы',
    fileName: 'program-rules.pdf',
    sortOrder: 20,
    onboarding: true,
  },
  {
    key: 'pep',
    title: 'Соглашение о ПЭП',
    fileName: 'pep.pdf',
    sortOrder: 30,
    onboarding: true,
  },
  {
    key: 'pdn',
    title: 'Уведомление и согласие на обработку ПДн',
    fileName: 'pdn.pdf',
    sortOrder: 40,
    onboarding: true,
  },
  {
    key: 'npdPayouts',
    title: 'Порядок выплат и чеков НПД',
    fileName: 'npd-payouts.pdf',
    sortOrder: 50,
    onboarding: false,
  },
];

const CATALOG_BY_KEY = new Map(MARKETER_LEGAL_CATALOG.map((d) => [d.key, d]));

export function isMarketerLegalKey(value: string): value is MarketerLegalKey {
  return CATALOG_BY_KEY.has(value as MarketerLegalKey);
}

export function marketerLegalPublicUrl(key: MarketerLegalKey): string {
  return `/api/legal/marketer/${key}`;
}

function formatPackVersion(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function seedSourcePath(fileName: string): string {
  return path.join(process.cwd(), 'client', 'public', 'legal', 'marketer', fileName);
}

async function ensureSettings() {
  let settings = await prisma.superAdminSettings.findFirst();
  if (!settings) {
    settings = await prisma.superAdminSettings.create({ data: {} });
  }
  return settings;
}

export class MarketerLegalDocumentService {
  static async getPackVersion(): Promise<string> {
    const settings = await ensureSettings();
    return settings.marketerLegalPackVersion || DEFAULT_MARKETER_LEGAL_PACK_VERSION;
  }

  /** Создаёт записи из статических PDF в client/public, если слот ещё пуст. */
  static async ensureSeeded(): Promise<void> {
    const existing = await prisma.marketerLegalDocument.findMany({ select: { key: true } });
    const have = new Set(existing.map((d) => d.key));
    const missing = MARKETER_LEGAL_CATALOG.filter((c) => !have.has(c.key));
    if (missing.length === 0) return;

    const dir = ensureUploadDir('marketer-legal');
    const packVersion = await this.getPackVersion();

    for (const item of missing) {
      const src = seedSourcePath(item.fileName);
      if (!fs.existsSync(src)) {
        console.warn(`[marketer-legal] seed missing: ${src}`);
        continue;
      }
      const destName = `${item.key}-${Date.now()}.pdf`;
      const destAbs = path.join(dir, destName);
      fs.copyFileSync(src, destAbs);
      const stat = fs.statSync(destAbs);
      const storagePath = `marketer-legal/${destName}`;
      await prisma.marketerLegalDocument.create({
        data: {
          key: item.key,
          title: item.title,
          fileName: item.fileName,
          mimeType: 'application/pdf',
          size: stat.size,
          storagePath,
          version: packVersion,
          sortOrder: item.sortOrder,
        },
      });
    }
  }

  static async listAdmin() {
    await this.ensureSeeded();
    const [rows, packVersion, settings] = await Promise.all([
      prisma.marketerLegalDocument.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.getPackVersion(),
      ensureSettings(),
    ]);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return {
      packVersion,
      packUpdatedAt: settings.marketerLegalPackUpdatedAt,
      documents: MARKETER_LEGAL_CATALOG.map((c) => {
        const row = byKey.get(c.key);
        return {
          key: c.key,
          title: c.title,
          fileName: c.fileName,
          sortOrder: c.sortOrder,
          onboarding: c.onboarding,
          url: marketerLegalPublicUrl(c.key),
          id: row?.id ?? null,
          size: row?.size ?? null,
          version: row?.version ?? null,
          updatedAt: row?.updatedAt ?? null,
          uploadedById: row?.uploadedById ?? null,
          hasFile: Boolean(row),
        };
      }),
    };
  }

  static async listPublic(opts?: { onboardingOnly?: boolean }) {
    await this.ensureSeeded();
    const packVersion = await this.getPackVersion();
    const catalog = opts?.onboardingOnly
      ? MARKETER_LEGAL_CATALOG.filter((c) => c.onboarding)
      : MARKETER_LEGAL_CATALOG;
    return {
      packVersion,
      documents: catalog.map((c) => ({
        key: c.key,
        title: c.title,
        version: packVersion,
        url: marketerLegalPublicUrl(c.key),
        onboarding: c.onboarding,
      })),
    };
  }

  static async replace(
    key: string,
    file: { path: string; originalname: string; mimetype: string; size: number },
    uploadedById?: string | null
  ) {
    if (!isMarketerLegalKey(key)) {
      throw badRequest('Неизвестный ключ документа', 'INVALID_KEY');
    }
    const catalog = CATALOG_BY_KEY.get(key)!;
    if (!file?.path || !fs.existsSync(file.path)) {
      throw badRequest('Файл не загружен');
    }
    const mime = String(file.mimetype || '').toLowerCase();
    if (mime && mime !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
      throw badRequest('Допускаются только PDF-файлы', 'INVALID_MIME');
    }

    const dir = ensureUploadDir('marketer-legal');
    const destName = `${key}-${Date.now()}.pdf`;
    const destAbs = path.join(dir, destName);
    fs.renameSync(file.path, destAbs);
    const storagePath = `marketer-legal/${destName}`;
    const fileVersion = formatPackVersion();

    const prev = await prisma.marketerLegalDocument.findUnique({ where: { key } });
    if (prev?.storagePath) {
      safeUnlink(prev.storagePath);
    }

    const row = await prisma.marketerLegalDocument.upsert({
      where: { key },
      create: {
        key,
        title: catalog.title,
        fileName: catalog.fileName,
        mimeType: 'application/pdf',
        size: file.size,
        storagePath,
        version: fileVersion,
        sortOrder: catalog.sortOrder,
        uploadedById: uploadedById || null,
      },
      update: {
        title: catalog.title,
        fileName: catalog.fileName,
        mimeType: 'application/pdf',
        size: file.size,
        storagePath,
        version: fileVersion,
        sortOrder: catalog.sortOrder,
        uploadedById: uploadedById || null,
      },
    });

    let packVersion = await this.getPackVersion();
    if (catalog.onboarding) {
      packVersion = fileVersion;
      const settings = await ensureSettings();
      await prisma.superAdminSettings.update({
        where: { id: settings.id },
        data: {
          marketerLegalPackVersion: packVersion,
          marketerLegalPackUpdatedAt: new Date(),
        },
      });
    }

    return {
      packVersion,
      document: {
        key: row.key,
        title: row.title,
        fileName: row.fileName,
        size: row.size,
        version: row.version,
        updatedAt: row.updatedAt,
        url: marketerLegalPublicUrl(key),
        onboarding: catalog.onboarding,
        hasFile: true,
      },
    };
  }

  static async resolveAbsolutePath(key: string): Promise<{ abs: string; fileName: string; mimeType: string }> {
    if (!isMarketerLegalKey(key)) throw notFound('Документ не найден');
    await this.ensureSeeded();
    const row = await prisma.marketerLegalDocument.findUnique({ where: { key } });
    if (!row) {
      // fallback to static public file
      const catalog = CATALOG_BY_KEY.get(key)!;
      const src = seedSourcePath(catalog.fileName);
      if (!fs.existsSync(src)) throw notFound('Файл документа отсутствует');
      return { abs: src, fileName: catalog.fileName, mimeType: 'application/pdf' };
    }
    const abs = absoluteUploadPath(row.storagePath);
    if (!fs.existsSync(abs)) throw notFound('Файл документа отсутствует на диске');
    return { abs, fileName: row.fileName, mimeType: row.mimeType || 'application/pdf' };
  }
}
