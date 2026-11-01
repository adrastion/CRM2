import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import { absoluteUploadPath, ensureUploadDir, safeUnlink } from '../utils/fileStorage';
import { MARKETER_LEGAL_SEEDS } from '../constants/marketerLegalSeeds';
import {
  applyLegalTemplate,
  normalizePartyPlaceholders,
  renderLegalTextPdf,
  type LegalTemplateVars,
} from './marketerLegalPdf';

export const DEFAULT_MARKETER_LEGAL_PACK_VERSION = '2026-11-01-templates';

export type MarketerLegalKey =
  | 'offer'
  | 'programRules'
  | 'pep'
  | 'pdn'
  | 'npdPayouts'
  | 'actTemplate'
  | 'legalChecklist';

export type MarketerLegalCatalogItem = {
  key: MarketerLegalKey;
  title: string;
  fileName: string;
  sortOrder: number;
  /** Участвует в онбординге / согласиях (bump версии пакета) */
  onboarding: boolean;
};

/** Фиксированные слоты договоров маркетолога (текст + PDF). */
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
  {
    key: 'actTemplate',
    title: 'Шаблон акта и отчёта',
    fileName: 'act-template.pdf',
    sortOrder: 60,
    onboarding: false,
  },
  {
    key: 'legalChecklist',
    title: 'Чек-лист юридического согласования',
    fileName: 'legal-checklist.pdf',
    sortOrder: 70,
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

function serializeDoc(
  c: MarketerLegalCatalogItem,
  row: {
    id: string;
    size: number;
    version: string;
    updatedAt: Date;
    uploadedById: string | null;
    bodyText: string | null;
    storagePath: string | null;
  } | null
) {
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
    hasFile: Boolean(row?.storagePath),
    hasBody: Boolean(row?.bodyText && row.bodyText.trim()),
    bodyPreview: row?.bodyText ? row.bodyText.slice(0, 240) : null,
  };
}

export class MarketerLegalDocumentService {
  static async getPackVersion(): Promise<string> {
    const settings = await ensureSettings();
    return settings.marketerLegalPackVersion || DEFAULT_MARKETER_LEGAL_PACK_VERSION;
  }

  static getBodySeed(key: MarketerLegalKey): string {
    const raw = MARKETER_LEGAL_SEEDS[key] || '';
    return raw ? normalizePartyPlaceholders(raw) : '';
  }

  /** Создаёт/дозаполняет слоты из текстовых сидов (DOCX-пакет) и генерирует PDF. */
  static async ensureSeeded(): Promise<void> {
    const existing = await prisma.marketerLegalDocument.findMany();
    const byKey = new Map(existing.map((d) => [d.key, d]));
    const packVersion = await this.getPackVersion();
    ensureUploadDir('marketer-legal');

    for (const item of MARKETER_LEGAL_CATALOG) {
      const row = byKey.get(item.key);
      const seedText = this.getBodySeed(item.key);

      if (!row) {
        let storagePath: string | null = null;
        let size = 0;
        if (seedText) {
          const pdf = await renderLegalTextPdf({
            title: item.title,
            bodyText: seedText,
            storageKey: item.key,
          });
          storagePath = pdf.relativePath;
          size = pdf.size;
        } else {
          const src = seedSourcePath(item.fileName);
          if (fs.existsSync(src)) {
            const dir = ensureUploadDir('marketer-legal');
            const destName = `${item.key}-${Date.now()}.pdf`;
            fs.copyFileSync(src, path.join(dir, destName));
            storagePath = `marketer-legal/${destName}`;
            size = fs.statSync(path.join(dir, destName)).size;
          }
        }
        await prisma.marketerLegalDocument.create({
          data: {
            key: item.key,
            title: item.title,
            fileName: item.fileName,
            mimeType: 'application/pdf',
            size,
            storagePath,
            bodyText: seedText || null,
            version: packVersion,
            sortOrder: item.sortOrder,
          },
        });
        continue;
      }

      // Без текста — подтянуть сид
      if ((!row.bodyText || !row.bodyText.trim()) && seedText) {
        if (row.storagePath) safeUnlink(row.storagePath);
        const pdf = await renderLegalTextPdf({
          title: item.title,
          bodyText: seedText,
          storageKey: item.key,
        });
        await prisma.marketerLegalDocument.update({
          where: { id: row.id },
          data: {
            bodyText: seedText,
            storagePath: pdf.relativePath,
            size: pdf.size,
            title: item.title,
            fileName: item.fileName,
            sortOrder: item.sortOrder,
            version: packVersion,
          },
        });
        continue;
      }

      // Уже есть текст: нормализуем Заказчик/Исполнитель → Contacts + профиль
      if (row.bodyText?.trim()) {
        const normalized = normalizePartyPlaceholders(row.bodyText);
        if (normalized !== row.bodyText) {
          if (row.storagePath) safeUnlink(row.storagePath);
          const pdf = await renderLegalTextPdf({
            title: item.title,
            bodyText: normalized,
            storageKey: item.key,
          });
          await prisma.marketerLegalDocument.update({
            where: { id: row.id },
            data: {
              bodyText: normalized,
              storagePath: pdf.relativePath,
              size: pdf.size,
            },
          });
        }
      }
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
      placeholders: [
        '{{customer.block}}',
        '{{executor.block}}',
        '{{operator.fullName}}',
        '{{operator.inn}}',
        '{{operator.ogrnip}}',
        '{{operator.email}}',
        '{{operator.legalAddress}}',
        '{{marketer.name}}',
        '{{marketer.email}}',
        '{{marketer.phone}}',
        '{{marketer.inn}}',
        '{{marketer.taxStatus}}',
        '{{payout.amount}}',
        '{{payout.id}}',
        '{{date}}',
      ],
      documents: MARKETER_LEGAL_CATALOG.map((c) => serializeDoc(c, byKey.get(c.key) || null)),
    };
  }

  static async listPublic(opts?: { onboardingOnly?: boolean }) {
    await this.ensureSeeded();
    const packVersion = await this.getPackVersion();
    const catalog = opts?.onboardingOnly
      ? MARKETER_LEGAL_CATALOG.filter((c) => c.onboarding)
      : MARKETER_LEGAL_CATALOG.filter((c) => c.key !== 'legalChecklist');
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

  static async getAdminBody(key: string) {
    if (!isMarketerLegalKey(key)) throw notFound('Документ не найден');
    await this.ensureSeeded();
    const catalog = CATALOG_BY_KEY.get(key)!;
    const row = await prisma.marketerLegalDocument.findUnique({ where: { key } });
    return {
      key,
      title: catalog.title,
      onboarding: catalog.onboarding,
      bodyText: row?.bodyText || this.getBodySeed(key) || '',
      version: row?.version || null,
      updatedAt: row?.updatedAt || null,
      url: marketerLegalPublicUrl(key),
    };
  }

  static async updateBody(key: string, bodyTextRaw: string, uploadedById?: string | null) {
    if (!isMarketerLegalKey(key)) throw badRequest('Неизвестный ключ документа', 'INVALID_KEY');
    const catalog = CATALOG_BY_KEY.get(key)!;
    const bodyText = String(bodyTextRaw || '').trim();
    if (!bodyText) throw badRequest('Текст документа пуст', 'bodyText');

    await this.ensureSeeded();
    const prev = await prisma.marketerLegalDocument.findUnique({ where: { key } });
    const fileVersion = formatPackVersion();
    const pdf = await renderLegalTextPdf({
      title: catalog.title,
      bodyText,
      storageKey: key,
    });

    if (prev?.storagePath) safeUnlink(prev.storagePath);

    const row = await prisma.marketerLegalDocument.upsert({
      where: { key },
      create: {
        key,
        title: catalog.title,
        fileName: catalog.fileName,
        mimeType: 'application/pdf',
        size: pdf.size,
        storagePath: pdf.relativePath,
        bodyText,
        version: fileVersion,
        sortOrder: catalog.sortOrder,
        uploadedById: uploadedById || null,
      },
      update: {
        title: catalog.title,
        fileName: catalog.fileName,
        mimeType: 'application/pdf',
        size: pdf.size,
        storagePath: pdf.relativePath,
        bodyText,
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
      document: serializeDoc(catalog, row),
      bodyText: row.bodyText,
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
        bodyText: prev?.bodyText || this.getBodySeed(key) || null,
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
      document: serializeDoc(catalog, row),
    };
  }

  /** Текст шаблона акта (для генерации выплат), если есть. */
  static async getActTemplateBody(): Promise<string | null> {
    await this.ensureSeeded();
    const row = await prisma.marketerLegalDocument.findUnique({ where: { key: 'actTemplate' } });
    const text = row?.bodyText || this.getBodySeed('actTemplate');
    return text?.trim() ? text : null;
  }

  static async getRenderedBody(key: string, vars?: LegalTemplateVars): Promise<string> {
    if (!isMarketerLegalKey(key)) throw notFound('Документ не найден');
    await this.ensureSeeded();
    const row = await prisma.marketerLegalDocument.findUnique({ where: { key } });
    const body = row?.bodyText || this.getBodySeed(key);
    if (!body) throw notFound('Текст документа отсутствует');
    return applyLegalTemplate(body, vars);
  }

  /**
   * Путь к PDF. Если есть bodyText — пересобирает «общий» PDF с реквизитами оператора.
   * При переданных vars (маркетолог) пишет временный персональный файл.
   */
  static async resolveAbsolutePath(
    key: string,
    vars?: LegalTemplateVars
  ): Promise<{ abs: string; fileName: string; mimeType: string; ephemeral?: boolean }> {
    if (!isMarketerLegalKey(key)) throw notFound('Документ не найден');
    await this.ensureSeeded();
    const catalog = CATALOG_BY_KEY.get(key)!;
    const row = await prisma.marketerLegalDocument.findUnique({ where: { key } });
    const bodyText = row?.bodyText || this.getBodySeed(key);

    const personalized = Boolean(vars?.marketer || vars?.payout);

    // Общий PDF уже на диске — отдаём кэш (пересборка при сохранении текста)
    if (!personalized && row?.storagePath) {
      const abs = absoluteUploadPath(row.storagePath);
      if (fs.existsSync(abs)) {
        return { abs, fileName: row.fileName, mimeType: row.mimeType || 'application/pdf' };
      }
    }

    if (bodyText && bodyText.trim()) {
      const pdf = await renderLegalTextPdf({
        title: catalog.title,
        bodyText,
        vars: vars || {},
        storageKey: personalized ? `${key}-personal` : key,
      });

      if (!personalized && row) {
        if (row.storagePath) safeUnlink(row.storagePath);
        await prisma.marketerLegalDocument.update({
          where: { id: row.id },
          data: { storagePath: pdf.relativePath, size: pdf.size },
        });
        return {
          abs: absoluteUploadPath(pdf.relativePath),
          fileName: catalog.fileName,
          mimeType: 'application/pdf',
        };
      }

      return {
        abs: absoluteUploadPath(pdf.relativePath),
        fileName: catalog.fileName,
        mimeType: 'application/pdf',
        ephemeral: true,
      };
    }

    if (row?.storagePath) {
      const abs = absoluteUploadPath(row.storagePath);
      if (fs.existsSync(abs)) {
        return { abs, fileName: row.fileName, mimeType: row.mimeType || 'application/pdf' };
      }
    }

    const src = seedSourcePath(catalog.fileName);
    if (!fs.existsSync(src)) throw notFound('Файл документа отсутствует');
    return { abs: src, fileName: catalog.fileName, mimeType: 'application/pdf' };
  }
}
