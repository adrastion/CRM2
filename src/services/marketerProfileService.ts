import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import { MarketerPayoutService } from './marketerPayoutService';
import {
  DEFAULT_MARKETER_LEGAL_PACK_VERSION,
  MarketerLegalDocumentService,
} from './marketerLegalDocumentService';

/** @deprecated Используйте MarketerLegalDocumentService.getPackVersion() */
export const MARKETER_DOC_VERSION = DEFAULT_MARKETER_LEGAL_PACK_VERSION;

type MarketerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  inn: string | null;
  taxStatus: string;
  taxStatusConfirmedAt: Date | null;
  bankName: string | null;
  bankBik: string | null;
  bankAccount: string | null;
  bankRecipient: string | null;
  offerAcceptedAt: Date | null;
  offerDocVersion: string | null;
  pepAcceptedAt: Date | null;
  pepDocVersion: string | null;
  pdnAcceptedAt: Date | null;
  pdnDocVersion: string | null;
  programRulesAcceptedAt: Date | null;
  programRulesDocVersion: string | null;
  onboardingCompletedAt: Date | null;
};

function displayName(m: { firstName?: string | null; lastName?: string | null; name: string }) {
  const parts = [m.lastName, m.firstName].map((x) => String(x || '').trim()).filter(Boolean);
  return parts.length ? parts.join(' ') : m.name;
}

export function computeOnboardingMissing(m: MarketerRow, packVersion: string): string[] {
  const missing: string[] = [];
  const hasName =
    (m.firstName && m.lastName) ||
    String(m.name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length >= 2 ||
    !!String(m.name || '').trim();
  if (!hasName) missing.push('name');
  if (!String(m.phone || '').trim()) missing.push('phone');
  if (!/^\d{12}$/.test(String(m.inn || '').replace(/\D/g, ''))) missing.push('inn');
  if (m.taxStatus !== 'NPD' || !m.taxStatusConfirmedAt) missing.push('taxStatus');
  if (!m.bankName || !m.bankBik || !m.bankAccount || !m.bankRecipient) missing.push('bank');
  if (!m.offerAcceptedAt || m.offerDocVersion !== packVersion) missing.push('offer');
  if (!m.pepAcceptedAt || m.pepDocVersion !== packVersion) missing.push('pep');
  if (!m.pdnAcceptedAt || m.pdnDocVersion !== packVersion) missing.push('pdn');
  if (!m.programRulesAcceptedAt || m.programRulesDocVersion !== packVersion) {
    missing.push('programRules');
  }
  return missing;
}

export function isOnboardingComplete(m: MarketerRow, packVersion: string): boolean {
  return computeOnboardingMissing(m, packVersion).length === 0;
}

async function loadMarketer(marketerId: string): Promise<MarketerRow> {
  const m = await prisma.marketer.findUnique({ where: { id: marketerId } });
  if (!m) throw notFound('Маркетолог не найден');
  return m as MarketerRow;
}

async function syncOnboardingCompletedAt(marketerId: string) {
  const m = await loadMarketer(marketerId);
  const packVersion = await MarketerLegalDocumentService.getPackVersion();
  const complete = isOnboardingComplete(m, packVersion);
  if (complete && !m.onboardingCompletedAt) {
    await prisma.marketer.update({
      where: { id: marketerId },
      data: { onboardingCompletedAt: new Date() },
    });
  } else if (!complete && m.onboardingCompletedAt) {
    await prisma.marketer.update({
      where: { id: marketerId },
      data: { onboardingCompletedAt: null },
    });
  }
  return complete;
}

export class MarketerProfileService {
  static async assertOnboardingComplete(marketerId: string) {
    const m = await loadMarketer(marketerId);
    const packVersion = await MarketerLegalDocumentService.getPackVersion();
    if (!isOnboardingComplete(m, packVersion)) {
      throw badRequest(
        'Завершите профиль и онбординг перед выводом средств',
        'ONBOARDING_REQUIRED'
      );
    }
  }

  static async getProfile(marketerId: string) {
    const m = await loadMarketer(marketerId);
    const packVersion = await MarketerLegalDocumentService.getPackVersion();
    const missing = computeOnboardingMissing(m, packVersion);
    return {
      id: m.id,
      email: m.email,
      name: m.name,
      firstName: m.firstName,
      lastName: m.lastName,
      phone: m.phone,
      inn: m.inn,
      taxStatus: m.taxStatus,
      taxStatusConfirmedAt: m.taxStatusConfirmedAt,
      bank: MarketerPayoutService.maskBank(m),
      onboarding: {
        complete: missing.length === 0,
        completedAt: m.onboardingCompletedAt,
        missing,
      },
      acceptances: {
        offer: { at: m.offerAcceptedAt, version: m.offerDocVersion },
        pep: { at: m.pepAcceptedAt, version: m.pepDocVersion },
        pdn: { at: m.pdnAcceptedAt, version: m.pdnDocVersion },
        programRules: { at: m.programRulesAcceptedAt, version: m.programRulesDocVersion },
      },
      docVersion: packVersion,
    };
  }

  static async updateProfile(
    marketerId: string,
    input: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      inn?: string | null;
      taxStatus?: string;
      confirmNpd?: boolean;
    }
  ) {
    const data: any = {};
    if (input.firstName !== undefined) data.firstName = String(input.firstName || '').trim() || null;
    if (input.lastName !== undefined) data.lastName = String(input.lastName || '').trim() || null;
    if (input.phone !== undefined) {
      const phone = String(input.phone || '').trim();
      data.phone = phone || null;
    }
    if (input.inn !== undefined) {
      const inn = String(input.inn || '').replace(/\D/g, '');
      if (inn && !/^\d{12}$/.test(inn)) throw badRequest('ИНН должен содержать 12 цифр', 'inn');
      data.inn = inn || null;
    }
    if (input.taxStatus !== undefined) {
      const ts = String(input.taxStatus || 'UNKNOWN').toUpperCase();
      if (!['UNKNOWN', 'NPD', 'OTHER'].includes(ts)) throw badRequest('Некорректный налоговый статус', 'taxStatus');
      data.taxStatus = ts;
      if (ts === 'NPD' && input.confirmNpd) {
        data.taxStatusConfirmedAt = new Date();
      } else if (ts !== 'NPD') {
        data.taxStatusConfirmedAt = null;
      }
    } else if (input.confirmNpd) {
      data.taxStatus = 'NPD';
      data.taxStatusConfirmedAt = new Date();
    }

    if (data.firstName !== undefined || data.lastName !== undefined) {
      const current = await loadMarketer(marketerId);
      const first = data.firstName !== undefined ? data.firstName : current.firstName;
      const last = data.lastName !== undefined ? data.lastName : current.lastName;
      data.name = displayName({ firstName: first, lastName: last, name: current.name });
    }

    await prisma.marketer.update({ where: { id: marketerId }, data });
    await syncOnboardingCompletedAt(marketerId);
    return this.getProfile(marketerId);
  }

  static async getOnboarding(marketerId: string) {
    const profile = await this.getProfile(marketerId);
    const { packVersion, documents } = await MarketerLegalDocumentService.listPublic({
      onboardingOnly: true,
    });
    return {
      ...profile,
      docs: documents,
      docVersion: packVersion,
      steps: [
        {
          id: 'profile',
          title: 'Профиль',
          done: !['name', 'phone', 'inn', 'taxStatus', 'bank'].some((k) =>
            profile.onboarding.missing.includes(k)
          ),
        },
        {
          id: 'documents',
          title: 'Документы',
          done: !['offer', 'pep', 'pdn', 'programRules'].some((k) =>
            profile.onboarding.missing.includes(k)
          ),
        },
        {
          id: 'done',
          title: 'Готово',
          done: profile.onboarding.complete,
        },
      ],
    };
  }

  static async acceptOnboarding(
    marketerId: string,
    input: {
      offer?: boolean;
      pep?: boolean;
      pdn?: boolean;
      programRules?: boolean;
    }
  ) {
    if (!input.offer && !input.pep && !input.pdn && !input.programRules) {
      throw badRequest('Отметьте хотя бы одно согласие');
    }
    const packVersion = await MarketerLegalDocumentService.getPackVersion();
    const now = new Date();
    const data: any = {};
    if (input.offer) {
      data.offerAcceptedAt = now;
      data.offerDocVersion = packVersion;
    }
    if (input.pep) {
      data.pepAcceptedAt = now;
      data.pepDocVersion = packVersion;
    }
    if (input.pdn) {
      data.pdnAcceptedAt = now;
      data.pdnDocVersion = packVersion;
    }
    if (input.programRules) {
      data.programRulesAcceptedAt = now;
      data.programRulesDocVersion = packVersion;
    }
    await prisma.marketer.update({ where: { id: marketerId }, data });
    await syncOnboardingCompletedAt(marketerId);
    return this.getOnboarding(marketerId);
  }

  /** Вызвать после сохранения банка. */
  static async refreshCompletion(marketerId: string) {
    return syncOnboardingCompletedAt(marketerId);
  }
}
