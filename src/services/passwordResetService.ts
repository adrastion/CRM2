import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { normalizeEmail } from '../utils/identifier';
import { badRequest, unauthorized } from '../utils/httpError';
import { EmailOtpService, OtpAccountType } from './emailOtpService';
import { emailService } from './emailService';
import { PublicAccount } from './unifiedAuthService';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL = '15m';
const NEUTRAL_MSG =
  'Если аккаунт с этим email существует, мы отправили код на почту';

type ResetAccountRef = {
  accountType: OtpAccountType;
  id: string;
  displayName: string;
  role?: string;
  tenant?: { id: string; name: string; subdomain: string };
  childName?: string;
};

function toPublic(a: ResetAccountRef): PublicAccount {
  return {
    accountType:
      a.accountType === 'user'
        ? 'TENANT_USER'
        : a.accountType === 'client'
          ? 'CLIENT'
          : 'PARENT',
    id: a.id,
    displayName: a.displayName,
    role: a.role,
    tenant: a.tenant,
    isAccountApproved: true,
    childName: a.childName,
  };
}

async function findResettableAccounts(email: string): Promise<ResetAccountRef[]> {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];

  const [users, clients, parents] = await Promise.all([
    prisma.user.findMany({
      where: { email: normalized, isActive: true, password: { not: '' } },
      include: { tenant: { select: { id: true, name: true, subdomain: true } } },
    }),
    prisma.client.findMany({
      where: {
        email: { equals: normalized, mode: 'insensitive' },
        isActive: true,
        password: { not: null },
      },
      include: { tenant: { select: { id: true, name: true, subdomain: true } } },
    }),
    prisma.parent.findMany({
      where: {
        email: { equals: normalized, mode: 'insensitive' },
        password: { not: null },
      },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        client: { select: { firstName: true, lastName: true, middleName: true } },
      },
    }),
  ]);

  const result: ResetAccountRef[] = [];

  for (const u of users) {
    if (!u.password) continue;
    result.push({
      accountType: 'user',
      id: u.id,
      displayName: `${u.lastName} ${u.firstName}`.trim(),
      role: u.role,
      tenant: u.tenant,
    });
  }

  for (const c of clients) {
    if (!c.password) continue;
    result.push({
      accountType: 'client',
      id: c.id,
      displayName: `${c.lastName} ${c.firstName}`.trim(),
      tenant: c.tenant,
    });
  }

  for (const p of parents) {
    if (!p.password) continue;
    const child = [p.client?.lastName, p.client?.firstName, p.client?.middleName]
      .filter(Boolean)
      .join(' ')
      .trim();
    result.push({
      accountType: 'parent',
      id: p.id,
      displayName: p.fullName,
      tenant: p.tenant,
      childName: child || undefined,
    });
  }

  return result;
}

export class PasswordResetService {
  static async requestCode(rawEmail: string) {
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return { message: NEUTRAL_MSG };
    }

    const accounts = await findResettableAccounts(email);
    if (accounts.length === 0) {
      return { message: NEUTRAL_MSG };
    }

    try {
      const { code } = await EmailOtpService.createAndIssue({
        email,
        purpose: 'reset',
      });
      const firstName = accounts[0]?.displayName?.split(/\s+/)[1] || accounts[0]?.displayName;
      await emailService.sendPasswordResetCodeEmail(email, {
        firstName,
        code,
      });
    } catch (err: any) {
      // Rate-limit / validation — пробрасываем клиенту
      if (err?.statusCode === 400 || err?.status === 400) throw err;
      console.error('password reset email failed:', err);
    }

    return { message: NEUTRAL_MSG };
  }

  static async verifyCode(rawEmail: string, code: string) {
    const email = normalizeEmail(rawEmail);
    if (!email) throw badRequest('Укажите email', 'email');

    await EmailOtpService.verify({ email, purpose: 'reset', code });

    const accounts = await findResettableAccounts(email);
    if (accounts.length === 0) {
      throw badRequest('Аккаунты с этим email не найдены', 'email');
    }

    const resetToken = jwt.sign(
      {
        type: 'password_reset_code',
        email,
        accounts: accounts.map((a) => ({
          accountType: a.accountType,
          id: a.id,
        })),
      },
      process.env.JWT_SECRET!,
      { expiresIn: RESET_TOKEN_TTL }
    );

    return {
      resetToken,
      accounts: accounts.map(toPublic),
    };
  }

  static async confirm(params: {
    resetToken: string;
    newPassword: string;
    accountType: string;
    accountId: string;
  }) {
    const password = String(params.newPassword || '');
    if (password.length < 6) {
      throw badRequest('Пароль должен содержать минимум 6 символов', 'newPassword');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(params.resetToken, process.env.JWT_SECRET!);
    } catch {
      throw unauthorized('Сессия сброса истекла. Запросите код снова');
    }

    if (decoded.type !== 'password_reset_code' || !decoded.email) {
      throw unauthorized('Недействительный токен сброса');
    }

    const allowed: Array<{ accountType: string; id: string }> = decoded.accounts || [];
    const otpType =
      params.accountType === 'TENANT_USER' || params.accountType === 'user'
        ? 'user'
        : params.accountType === 'CLIENT' || params.accountType === 'client'
          ? 'client'
          : params.accountType === 'PARENT' || params.accountType === 'parent'
            ? 'parent'
            : null;

    if (!otpType) throw badRequest('Некорректный тип аккаунта', 'accountType');

    const match = allowed.find(
      (a) => a.accountType === otpType && a.id === params.accountId
    );
    if (!match) {
      throw badRequest('Аккаунт не входит в список для сброса', 'accountId');
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    if (otpType === 'user') {
      await prisma.user.update({
        where: { id: params.accountId },
        data: { password: hash },
      });
    } else if (otpType === 'client') {
      await prisma.client.update({
        where: { id: params.accountId },
        data: { password: hash },
      });
    } else {
      await prisma.parent.update({
        where: { id: params.accountId },
        data: { password: hash },
      });
    }

    return { message: 'Пароль успешно изменён' };
  }
}
