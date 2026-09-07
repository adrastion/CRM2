import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { badRequest } from '../utils/httpError';
import { normalizeEmail } from '../utils/identifier';

export type OtpPurpose = 'verify' | 'reset';
export type OtpAccountType = 'user' | 'client' | 'parent';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export class EmailOtpService {
  /**
   * Создаёт OTP и возвращает plaintext-код (только для отправки в письме).
   * Удаляет предыдущие коды с тем же email+purpose (+ account при verify).
   */
  static async createAndIssue(params: {
    email: string;
    purpose: OtpPurpose;
    accountType?: OtpAccountType | null;
    accountId?: string | null;
  }): Promise<{ code: string; email: string }> {
    const email = normalizeEmail(params.email);
    if (!email) throw badRequest('Укажите корректный email', 'email');

    const where =
      params.purpose === 'verify' && params.accountType && params.accountId
        ? {
            purpose: params.purpose,
            accountType: params.accountType,
            accountId: params.accountId,
          }
        : { email, purpose: params.purpose };

    const recent = await prisma.emailOtp.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000
      );
      throw badRequest(`Повторная отправка через ${waitSec} с`, 'email');
    }

    await prisma.emailOtp.deleteMany({ where });

    const code = generateCode();
    await prisma.emailOtp.create({
      data: {
        email,
        purpose: params.purpose,
        codeHash: hashCode(code),
        accountType: params.accountType || null,
        accountId: params.accountId || null,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    return { code, email };
  }

  /**
   * Проверяет код. При успехе удаляет OTP.
   */
  static async verify(params: {
    email: string;
    purpose: OtpPurpose;
    code: string;
    accountType?: OtpAccountType | null;
    accountId?: string | null;
  }): Promise<{ email: string }> {
    const email = normalizeEmail(params.email);
    const code = String(params.code || '').trim();
    if (!email) throw badRequest('Укажите корректный email', 'email');
    if (!/^\d{6}$/.test(code)) throw badRequest('Введите 6-значный код', 'code');

    const where =
      params.purpose === 'verify' && params.accountType && params.accountId
        ? {
            purpose: params.purpose,
            accountType: params.accountType,
            accountId: params.accountId,
          }
        : { email, purpose: params.purpose };

    const otp = await prisma.emailOtp.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw badRequest('Код не найден или истёк. Запросите новый', 'code');
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      await prisma.emailOtp.delete({ where: { id: otp.id } }).catch(() => undefined);
      throw badRequest('Код истёк. Запросите новый', 'code');
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      await prisma.emailOtp.delete({ where: { id: otp.id } }).catch(() => undefined);
      throw badRequest('Слишком много попыток. Запросите новый код', 'code');
    }

    if (otp.codeHash !== hashCode(code)) {
      await prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw badRequest('Неверный код', 'code');
    }

    await prisma.emailOtp.delete({ where: { id: otp.id } }).catch(() => undefined);
    return { email };
  }
}
