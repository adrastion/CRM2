import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import { MobileApkService } from './mobileApkService';

export type SocialLink = {
  key: string;
  label: string;
  url: string;
  enabled: boolean;
  sortOrder: number;
};

const DEFAULT_SOCIALS: SocialLink[] = [
  { key: 'vk', label: 'ВКонтакте', url: '', enabled: false, sortOrder: 0 },
  { key: 'max', label: 'MAX', url: '', enabled: false, sortOrder: 1 },
  { key: 'telegram', label: 'Telegram', url: '', enabled: false, sortOrder: 2 },
  { key: 'youtube', label: 'YouTube', url: '', enabled: false, sortOrder: 3 },
];

const DEFAULT_IOS_INSTRUCTION =
  'Откройте сайт в Safari → «Поделиться» → «На экран „Домой“». На Android в Chrome: меню → «Установить приложение» или «Добавить на главный экран».';

const LANDING_VARIANTS = new Set([
  'arena',
  'motion',
  'editorial',
  'pulse',
  'ledger',
  'volt',
  'ribbon',
  'atlas',
]);

function normalizeLandingVariant(raw: unknown): string {
  const v = String(raw || '').trim().toLowerCase();
  return LANDING_VARIANTS.has(v) ? v : 'arena';
}

function parseSocials(raw: string | null | undefined): SocialLink[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SOCIALS.map((s) => ({ ...s }));
    return parsed
      .map((item: any, idx: number) => ({
        key: String(item?.key || `link-${idx}`).trim() || `link-${idx}`,
        label: String(item?.label || item?.key || 'Ссылка').trim() || 'Ссылка',
        url: String(item?.url || '').trim(),
        enabled: Boolean(item?.enabled) && Boolean(String(item?.url || '').trim()),
        sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : idx,
      }))
      .sort((a: SocialLink, b: SocialLink) => a.sortOrder - b.sortOrder);
  } catch {
    return DEFAULT_SOCIALS.map((s) => ({ ...s }));
  }
}

async function ensureSettings() {
  let settings = await prisma.superAdminSettings.findFirst();
  if (!settings) {
    settings = await prisma.superAdminSettings.create({ data: {} });
  }
  return settings;
}

function slugify(input: string): string {
  const base = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'e')
    .replace(/[^a-z0-9а-яa-z]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || `vacancy-${Date.now().toString(36)}`;
}

export class PublicSiteService {
  static async getPublicConfig() {
    const settings = await ensureSettings();
    const apk = await MobileApkService.getMeta();
    const socialLinks = parseSocials(settings.socialLinksJson)
      .filter((s) => s.enabled && s.url)
      .map(({ key, label, url, sortOrder }) => ({ key, label, url, sortOrder }));

    return {
      socialLinks,
      landingVariant: normalizeLandingVariant(settings.landingVariant),
      download: {
        tabEnabled: Boolean(settings.mobileDownloadTabEnabled),
        rustoreUrl: settings.mobileRustoreUrl || null,
        publicApkEnabled: Boolean(settings.mobilePublicApkEnabled) && apk.hasFile,
        apkLabel: apk.label || apk.originalName || null,
        iosInstructionEnabled: Boolean(settings.mobileIosInstructionEnabled),
        iosInstructionText: settings.mobileIosInstructionText?.trim() || DEFAULT_IOS_INSTRUCTION,
      },
    };
  }

  static async getAdminSiteSettings() {
    const settings = await ensureSettings();
    const apk = await MobileApkService.getMeta();
    return {
      socialLinks: parseSocials(settings.socialLinksJson),
      landingVariant: normalizeLandingVariant(settings.landingVariant),
      download: {
        tabEnabled: Boolean(settings.mobileDownloadTabEnabled),
        rustoreUrl: settings.mobileRustoreUrl || '',
        publicApkEnabled: Boolean(settings.mobilePublicApkEnabled),
        iosInstructionEnabled: Boolean(settings.mobileIosInstructionEnabled),
        iosInstructionText: settings.mobileIosInstructionText || DEFAULT_IOS_INSTRUCTION,
        apk,
      },
    };
  }

  static async updateAdminSiteSettings(input: {
    socialLinks?: SocialLink[];
    landingVariant?: string;
    download?: {
      tabEnabled?: boolean;
      rustoreUrl?: string | null;
      publicApkEnabled?: boolean;
      iosInstructionEnabled?: boolean;
      iosInstructionText?: string | null;
    };
  }) {
    const settings = await ensureSettings();
    const data: Record<string, unknown> = {};

    if (input.socialLinks !== undefined) {
      if (!Array.isArray(input.socialLinks)) throw badRequest('socialLinks должен быть массивом');
      const normalized = input.socialLinks.map((item, idx) => ({
        key: String(item?.key || `link-${idx}`).trim() || `link-${idx}`,
        label: String(item?.label || '').trim() || String(item?.key || 'Ссылка'),
        url: String(item?.url || '').trim(),
        enabled: Boolean(item?.enabled),
        sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : idx,
      }));
      data.socialLinksJson = JSON.stringify(normalized);
    }

    if (input.landingVariant !== undefined) {
      data.landingVariant = normalizeLandingVariant(input.landingVariant);
    }

    if (input.download) {
      const d = input.download;
      if (d.tabEnabled !== undefined) data.mobileDownloadTabEnabled = Boolean(d.tabEnabled);
      if (d.publicApkEnabled !== undefined) data.mobilePublicApkEnabled = Boolean(d.publicApkEnabled);
      if (d.iosInstructionEnabled !== undefined) {
        data.mobileIosInstructionEnabled = Boolean(d.iosInstructionEnabled);
      }
      if (d.rustoreUrl !== undefined) {
        const url = d.rustoreUrl == null ? null : String(d.rustoreUrl).trim() || null;
        data.mobileRustoreUrl = url;
      }
      if (d.iosInstructionText !== undefined) {
        data.mobileIosInstructionText =
          d.iosInstructionText == null ? null : String(d.iosInstructionText).trim() || null;
      }
    }

    await prisma.superAdminSettings.update({ where: { id: settings.id }, data: data as any });
    return this.getAdminSiteSettings();
  }

  static async listPublicNews() {
    const now = new Date();
    return prisma.platformChangelogEntry.findMany({
      where: {
        isPublicOnSite: true,
        publishedAt: { lte: now },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        title: true,
        body: true,
        tag: true,
        imageUrl: true,
        publishedAt: true,
        createdAt: true,
      },
    });
  }

  static async listPublicVacancies() {
    return prisma.vacancy.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        roleType: true,
        description: true,
        requirements: true,
        sortOrder: true,
      },
    });
  }

  static async submitFeedback(input: { name?: string; contact?: string; body: string }) {
    const body = String(input.body || '').trim();
    if (body.length < 5) throw badRequest('Опишите пожелание подробнее');
    if (body.length > 5000) throw badRequest('Слишком длинный текст');
    return prisma.siteFeedback.create({
      data: {
        name: input.name?.trim() || null,
        contact: input.contact?.trim() || null,
        body,
      },
    });
  }

  static async applyToVacancy(
    vacancyId: string,
    input: { name: string; contacts: string; message: string }
  ) {
    const vacancy = await prisma.vacancy.findFirst({
      where: { id: vacancyId, isActive: true },
    });
    if (!vacancy) throw notFound('Вакансия не найдена');
    if (vacancy.roleType === 'MARKETER') {
      throw badRequest('Для маркетологов используйте форму регистрации');
    }
    const name = String(input.name || '').trim();
    const contacts = String(input.contacts || '').trim();
    const message = String(input.message || '').trim();
    if (!name || !contacts || message.length < 5) {
      throw badRequest('Заполните имя, контакты и сообщение');
    }
    return prisma.vacancyApplication.create({
      data: { vacancyId, name, contacts, message },
    });
  }

  static async assertPublicApkDownload() {
    const settings = await ensureSettings();
    if (!settings.mobileDownloadTabEnabled || !settings.mobilePublicApkEnabled) {
      throw notFound('Скачивание недоступно');
    }
    return MobileApkService.resolveForDownload();
  }

  // ——— SA vacancies ———
  static listVacanciesAdmin() {
    return prisma.vacancy.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { applications: true } } },
    });
  }

  static async createVacancy(input: {
    title: string;
    slug?: string;
    roleType: string;
    description: string;
    requirements?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    const title = String(input.title || '').trim();
    const description = String(input.description || '').trim();
    const roleType = String(input.roleType || '').trim().toUpperCase();
    if (!title || !description) throw badRequest('Укажите название и описание');
    if (!['MARKETER', 'DESIGNER', 'PROMOTER', 'OTHER'].includes(roleType)) {
      throw badRequest('Некорректный тип вакансии');
    }
    let slug = String(input.slug || '').trim() || slugify(title);
    const exists = await prisma.vacancy.findUnique({ where: { slug } });
    if (exists) slug = `${slug}-${Date.now().toString(36)}`;
    return prisma.vacancy.create({
      data: {
        title,
        slug,
        roleType: roleType as any,
        description,
        requirements: input.requirements?.trim() || null,
        isActive: input.isActive !== false,
        sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
      },
    });
  }

  static async updateVacancy(
    id: string,
    input: {
      title?: string;
      slug?: string;
      roleType?: string;
      description?: string;
      requirements?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) {
    const existing = await prisma.vacancy.findUnique({ where: { id } });
    if (!existing) throw notFound('Вакансия не найдена');
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) {
      const title = String(input.title).trim();
      if (!title) throw badRequest('Пустое название');
      data.title = title;
    }
    if (input.description !== undefined) {
      const description = String(input.description).trim();
      if (!description) throw badRequest('Пустое описание');
      data.description = description;
    }
    if (input.slug !== undefined) {
      const slug = String(input.slug).trim() || slugify(String(input.title || existing.title));
      data.slug = slug;
    }
    if (input.roleType !== undefined) {
      const roleType = String(input.roleType).trim().toUpperCase();
      if (!['MARKETER', 'DESIGNER', 'PROMOTER', 'OTHER'].includes(roleType)) {
        throw badRequest('Некорректный тип вакансии');
      }
      data.roleType = roleType;
    }
    if (input.requirements !== undefined) {
      data.requirements = input.requirements == null ? null : String(input.requirements).trim() || null;
    }
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
    if (input.sortOrder !== undefined) data.sortOrder = Number(input.sortOrder) || 0;
    return prisma.vacancy.update({ where: { id }, data: data as any });
  }

  static async deleteVacancy(id: string) {
    const existing = await prisma.vacancy.findUnique({ where: { id } });
    if (!existing) throw notFound('Вакансия не найдена');
    await prisma.vacancy.delete({ where: { id } });
    return { ok: true };
  }

  static listApplicationsAdmin(status?: string) {
    const where =
      status && ['NEW', 'READ', 'ARCHIVED'].includes(status) ? { status: status as any } : {};
    return prisma.vacancyApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        vacancy: { select: { id: true, title: true, roleType: true, slug: true } },
      },
    });
  }

  static async updateApplicationStatus(id: string, status: string) {
    if (!['NEW', 'READ', 'ARCHIVED'].includes(status)) throw badRequest('Некорректный статус');
    const existing = await prisma.vacancyApplication.findUnique({ where: { id } });
    if (!existing) throw notFound('Заявка не найдена');
    return prisma.vacancyApplication.update({
      where: { id },
      data: { status: status as any },
      include: { vacancy: { select: { id: true, title: true, roleType: true } } },
    });
  }

  static listFeedbackAdmin(status?: string) {
    const where =
      status && ['NEW', 'READ', 'ARCHIVED'].includes(status) ? { status: status as any } : {};
    return prisma.siteFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  static async updateFeedbackStatus(id: string, status: string) {
    if (!['NEW', 'READ', 'ARCHIVED'].includes(status)) throw badRequest('Некорректный статус');
    const existing = await prisma.siteFeedback.findUnique({ where: { id } });
    if (!existing) throw notFound('Сообщение не найдено');
    return prisma.siteFeedback.update({ where: { id }, data: { status: status as any } });
  }
}
