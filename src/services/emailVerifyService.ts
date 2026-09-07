import { prisma } from '../lib/prisma';
import { badRequest, unauthorized } from '../utils/httpError';
import { EmailOtpService, OtpAccountType } from './emailOtpService';
import { emailService } from './emailService';
import { normalizeEmail } from '../utils/identifier';

export class EmailVerifyService {
  static async sendVerification(params: {
    accountType: OtpAccountType;
    accountId: string;
  }) {
    let email: string | null = null;
    let firstName: string | undefined;

    if (params.accountType === 'user') {
      const user = await prisma.user.findUnique({ where: { id: params.accountId } });
      if (!user) throw unauthorized('Пользователь не найден');
      email = user.email;
      firstName = user.firstName;
      if (user.emailVerified) {
        return { message: 'Email уже подтверждён', alreadyVerified: true };
      }
    } else if (params.accountType === 'client') {
      const client = await prisma.client.findUnique({ where: { id: params.accountId } });
      if (!client) throw unauthorized('Клиент не найден');
      email = client.email;
      firstName = client.firstName;
      if (!email) throw badRequest('У аккаунта не указан email', 'email');
      if (client.emailVerified) {
        return { message: 'Email уже подтверждён', alreadyVerified: true };
      }
    } else {
      const parent = await prisma.parent.findUnique({ where: { id: params.accountId } });
      if (!parent) throw unauthorized('Родитель не найден');
      email = parent.email;
      firstName = parent.fullName?.split(/\s+/)[0];
      if (!email) throw badRequest('У аккаунта не указан email', 'email');
      if (parent.emailVerified) {
        return { message: 'Email уже подтверждён', alreadyVerified: true };
      }
    }

    const normalized = normalizeEmail(email || '');
    if (!normalized) throw badRequest('У аккаунта не указан email', 'email');

    const { code } = await EmailOtpService.createAndIssue({
      email: normalized,
      purpose: 'verify',
      accountType: params.accountType,
      accountId: params.accountId,
    });

    await emailService.sendVerificationCodeEmail(normalized, { firstName, code });
    return { message: 'Код отправлен на почту', email: normalized };
  }

  static async verifyCode(params: {
    accountType: OtpAccountType;
    accountId: string;
    code: string;
  }) {
    let email: string | null = null;

    if (params.accountType === 'user') {
      const user = await prisma.user.findUnique({ where: { id: params.accountId } });
      if (!user) throw unauthorized('Пользователь не найден');
      email = user.email;
    } else if (params.accountType === 'client') {
      const client = await prisma.client.findUnique({ where: { id: params.accountId } });
      if (!client) throw unauthorized('Клиент не найден');
      email = client.email;
    } else {
      const parent = await prisma.parent.findUnique({ where: { id: params.accountId } });
      if (!parent) throw unauthorized('Родитель не найден');
      email = parent.email;
    }

    const normalized = normalizeEmail(email || '');
    if (!normalized) throw badRequest('У аккаунта не указан email', 'email');

    await EmailOtpService.verify({
      email: normalized,
      purpose: 'verify',
      code: params.code,
      accountType: params.accountType,
      accountId: params.accountId,
    });

    if (params.accountType === 'user') {
      await prisma.user.update({
        where: { id: params.accountId },
        data: { emailVerified: true },
      });
    } else if (params.accountType === 'client') {
      await prisma.client.update({
        where: { id: params.accountId },
        data: { emailVerified: true },
      });
    } else {
      await prisma.parent.update({
        where: { id: params.accountId },
        data: { emailVerified: true },
      });
    }

    return { message: 'Email подтверждён', emailVerified: true };
  }
}
