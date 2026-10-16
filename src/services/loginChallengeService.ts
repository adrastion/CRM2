import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { badRequest, unauthorized } from '../utils/httpError';
import { LOGIN_FAILED_MESSAGE } from '../constants/security';
import {
  detectIdentifierType,
  normalizeEmail,
} from '../utils/identifier';
import {
  AccountType,
  LoginResult,
  UnifiedAuthService,
} from './unifiedAuthService';
import { EmailOtpService } from './emailOtpService';
import { emailService } from './emailService';
import { SessionRequestMeta } from './authSessionService';
import {
  getSubscriptionsForActor,
  sendLoginCodePush,
} from './actorPushService';
import { NotificationActorType } from './notificationPrefsService';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type ChallengeMethod = 'EMAIL_LOGIN' | 'EMAIL_2FA' | 'PUSH' | 'QR';

type AccountKey = { t: AccountType; i: string };

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function generateSecret(): string {
  return crypto.randomBytes(16).toString('base64url');
}

function accountTypeToPushActor(accountType: AccountType): NotificationActorType | null {
  if (accountType === 'TENANT_USER') return 'USER';
  if (accountType === 'CLIENT') return 'CLIENT';
  if (accountType === 'PARENT') return 'PARENT';
  if (accountType === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (accountType === 'TESTER') return 'TESTER';
  return null;
}

async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const type = detectIdentifierType(identifier);
  if (type === 'email') return normalizeEmail(identifier);
  const accounts = await UnifiedAuthService.findAccountsPublic(identifier);
  for (const a of accounts) {
    if (a.accountType === 'TENANT_USER') {
      const u = await prisma.user.findUnique({ where: { id: a.id }, select: { email: true } });
      if (u?.email) return normalizeEmail(u.email);
    }
    if (a.accountType === 'CLIENT') {
      const c = await prisma.client.findUnique({ where: { id: a.id }, select: { email: true } });
      if (c?.email) return normalizeEmail(c.email);
    }
    if (a.accountType === 'PARENT') {
      const p = await prisma.parent.findUnique({ where: { id: a.id }, select: { email: true } });
      if (p?.email) return normalizeEmail(p.email);
    }
    if (a.accountType === 'MARKETER') {
      const m = await prisma.marketer.findUnique({ where: { id: a.id }, select: { email: true } });
      if (m?.email) return normalizeEmail(m.email);
    }
    if (a.accountType === 'SUPER_ADMIN') {
      const s = await prisma.superAdmin.findUnique({ where: { id: a.id }, select: { email: true } });
      if (s?.email) return normalizeEmail(s.email);
    }
    if (a.accountType === 'TESTER') {
      const t = await prisma.tester.findUnique({ where: { id: a.id }, select: { email: true } });
      if (t?.email) return normalizeEmail(t.email);
    }
    if (a.accountType === 'PLATFORM_STAFF') {
      const s = await prisma.platformStaffUser.findUnique({ where: { id: a.id }, select: { email: true } });
      if (s?.email) return normalizeEmail(s.email);
    }
    if (a.accountType === 'PROMO_CODE_ADMIN') {
      const p = await prisma.promoCodeAdmin.findUnique({ where: { id: a.id }, select: { email: true } });
      if (p?.email) return normalizeEmail(p.email);
    }
  }
  return null;
}

export async function getEmail2faEnabled(accountType: AccountType, accountId: string): Promise<boolean> {
  const row = await prisma.loginSecuritySetting.findUnique({
    where: { accountType_accountId: { accountType, accountId } },
  });
  return Boolean(row?.email2faEnabled);
}

export async function setEmail2faEnabled(
  accountType: AccountType,
  accountId: string,
  enabled: boolean
): Promise<{ email2faEnabled: boolean }> {
  const row = await prisma.loginSecuritySetting.upsert({
    where: { accountType_accountId: { accountType, accountId } },
    create: { accountType, accountId, email2faEnabled: enabled },
    update: { email2faEnabled: enabled },
  });
  return { email2faEnabled: row.email2faEnabled };
}

async function anyMatchedNeeds2fa(keys: AccountKey[]): Promise<boolean> {
  for (const k of keys) {
    if (await getEmail2faEnabled(k.t, k.i)) return true;
  }
  return false;
}

async function createChallenge(params: {
  method: ChallengeMethod;
  identifier?: string | null;
  accounts: AccountKey[];
  rememberMe: boolean;
  codeHash?: string | null;
  secretHash?: string | null;
}): Promise<{ challengeToken: string; id: string }> {
  const challengeToken = generateToken();
  const row = await prisma.loginChallenge.create({
    data: {
      tokenHash: hash(challengeToken),
      method: params.method,
      status: 'PENDING',
      identifier: params.identifier || null,
      accountsJson: JSON.stringify(params.accounts),
      codeHash: params.codeHash || null,
      secretHash: params.secretHash || null,
      rememberMe: params.rememberMe,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
  return { challengeToken, id: row.id };
}

async function loadChallenge(challengeToken: string) {
  const row = await prisma.loginChallenge.findUnique({
    where: { tokenHash: hash(challengeToken) },
  });
  if (!row) throw badRequest('Сессия подтверждения не найдена или истекла', 'code');
  if (row.status === 'USED' || row.status === 'DENIED') {
    throw badRequest('Сессия подтверждения уже использована', 'code');
  }
  if (row.expiresAt.getTime() < Date.now() || row.status === 'EXPIRED') {
    await prisma.loginChallenge.update({
      where: { id: row.id },
      data: { status: 'EXPIRED' },
    }).catch(() => undefined);
    throw badRequest('Сессия подтверждения истекла', 'code');
  }
  return row;
}

function parseAccounts(json: string): AccountKey[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({ t: x.t as AccountType, i: String(x.i) }))
      .filter((x) => x.t && x.i);
  } catch {
    return [];
  }
}

async function markUsedAndFinish(
  challengeId: string,
  identifier: string,
  accounts: AccountKey[],
  rememberMe: boolean,
  meta?: SessionRequestMeta | null,
  approved?: { accountType: AccountType; accountId: string }
): Promise<LoginResult> {
  await prisma.loginChallenge.update({
    where: { id: challengeId },
    data: {
      status: 'USED',
      usedAt: new Date(),
      approvedAccountType: approved?.accountType || null,
      approvedAccountId: approved?.accountId || null,
    },
  });
  const keys = approved
    ? [{ accountType: approved.accountType, id: approved.accountId }]
    : accounts.map((a) => ({ accountType: a.t, id: a.i }));
  return UnifiedAuthService.finishLoginForKeys(identifier, keys, rememberMe, meta);
}

function verifyCodeHash(row: { id: string; codeHash: string | null; attempts: number }, code: string) {
  const trimmed = String(code || '').trim();
  if (!/^\d{6}$/.test(trimmed)) throw badRequest('Введите 6-значный код', 'code');
  if (row.attempts >= MAX_ATTEMPTS) {
    throw badRequest('Слишком много попыток. Запросите новый код', 'code');
  }
  if (!row.codeHash || row.codeHash !== hash(trimmed)) {
    void prisma.loginChallenge.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    throw badRequest('Неверный код', 'code');
  }
}

/** После пароля: если нужна 2FA — challenge, иначе null (продолжить обычный login). */
export async function maybeStartEmail2fa(params: {
  identifier: string;
  matched: Array<{ accountType: AccountType; id: string }>;
  rememberMe: boolean;
}): Promise<{ requiresEmail2fa: true; challengeToken: string } | null> {
  const keys: AccountKey[] = params.matched.map((m) => ({ t: m.accountType, i: m.id }));
  if (!(await anyMatchedNeeds2fa(keys))) return null;

  const email = await resolveLoginEmail(params.identifier);
  if (!email) {
    // 2FA включена, но email нет — не блокируем вход паролем
    return null;
  }

  const { code } = await EmailOtpService.createAndIssue({
    email,
    purpose: '2fa',
  });
  await emailService.sendLoginCodeEmail(email, { code, purpose: '2fa' });

  const { challengeToken } = await createChallenge({
    method: 'EMAIL_2FA',
    identifier: params.identifier,
    accounts: keys,
    rememberMe: params.rememberMe,
    codeHash: hash(code),
  });

  return { requiresEmail2fa: true, challengeToken };
}

export async function requestEmailLogin(identifier: string, rememberMe = false) {
  const email = await resolveLoginEmail(identifier);
  // Не раскрываем наличие аккаунта
  if (!email) {
    return { sent: true, message: 'Если аккаунт найден, код отправлен на почту' };
  }
  const accounts = await UnifiedAuthService.findAccountsPublic(identifier);
  if (accounts.length === 0) {
    return { sent: true, message: 'Если аккаунт найден, код отправлен на почту' };
  }

  const { code } = await EmailOtpService.createAndIssue({ email, purpose: 'login' });
  try {
    await emailService.sendLoginCodeEmail(email, { code, purpose: 'login' });
  } catch (e) {
    await EmailOtpService.invalidate({ email, purpose: 'login' });
    throw e;
  }

  const keys: AccountKey[] = accounts.map((a) => ({ t: a.accountType, i: a.id }));
  const { challengeToken } = await createChallenge({
    method: 'EMAIL_LOGIN',
    identifier,
    accounts: keys,
    rememberMe,
    codeHash: hash(code),
  });

  return {
    sent: true,
    challengeToken,
    message: 'Если аккаунт найден, код отправлен на почту',
  };
}

export async function verifyEmailLoginCode(params: {
  challengeToken: string;
  code: string;
  meta?: SessionRequestMeta | null;
}): Promise<LoginResult> {
  const row = await loadChallenge(params.challengeToken);
  if (row.method !== 'EMAIL_LOGIN' && row.method !== 'EMAIL_2FA') {
    throw badRequest('Неверный тип подтверждения', 'code');
  }
  verifyCodeHash(row, params.code);
  const accounts = parseAccounts(row.accountsJson);
  const email = await resolveLoginEmail(row.identifier || '');
  if (email) {
    await EmailOtpService.verify({
      email,
      purpose: row.method === 'EMAIL_2FA' ? '2fa' : 'login',
      code: params.code,
    }).catch(() => undefined);
  }
  return markUsedAndFinish(
    row.id,
    row.identifier || '',
    accounts,
    row.rememberMe,
    params.meta
  );
}

export async function requestPushLogin(identifier: string, rememberMe = false) {
  const accounts = await UnifiedAuthService.findAccountsPublic(identifier);
  if (accounts.length === 0) {
    throw unauthorized(LOGIN_FAILED_MESSAGE, 'identifier');
  }

  const code = generateCode();
  let sent = 0;
  for (const a of accounts) {
    const actor = accountTypeToPushActor(a.accountType);
    if (!actor) continue;
    const subs = await getSubscriptionsForActor(actor, a.id);
    if (!subs.length) continue;
    sent += await sendLoginCodePush(
      actor,
      a.id,
      'Код для входа',
      `Код входа: ${code}. Действует 10 минут.`,
      { code }
    );
  }

  if (sent === 0) {
    throw badRequest(
      'Нет активного устройства с уведомлениями. Включите push в уже открытой сессии или войдите по паролю.',
      'identifier'
    );
  }

  const keys: AccountKey[] = accounts.map((a) => ({ t: a.accountType, i: a.id }));
  const { challengeToken } = await createChallenge({
    method: 'PUSH',
    identifier,
    accounts: keys,
    rememberMe,
    codeHash: hash(code),
  });

  return { challengeToken, message: 'Код отправлен на устройства с уведомлениями' };
}

export async function verifyPushLoginCode(params: {
  challengeToken: string;
  code: string;
  meta?: SessionRequestMeta | null;
}): Promise<LoginResult> {
  const row = await loadChallenge(params.challengeToken);
  if (row.method !== 'PUSH') throw badRequest('Неверный тип подтверждения', 'code');
  verifyCodeHash(row, params.code);
  return markUsedAndFinish(
    row.id,
    row.identifier || '',
    parseAccounts(row.accountsJson),
    row.rememberMe,
    params.meta
  );
}

/**
 * Discord-style QR: без почты/телефона. Аккаунт определяется при approve
 * из уже открытой мобильной сессии.
 */
export async function startQrLogin(rememberMe = false) {
  const secret = generateSecret();
  const { challengeToken } = await createChallenge({
    method: 'QR',
    identifier: null,
    accounts: [],
    rememberMe,
    secretHash: hash(secret),
  });
  return { challengeToken, secret };
}

export async function getQrStatus(challengeToken: string): Promise<{
  status: string;
  session?: LoginResult;
}> {
  const row = await prisma.loginChallenge.findUnique({
    where: { tokenHash: hash(challengeToken) },
  });
  if (!row || row.method !== 'QR') {
    throw badRequest('Сессия подтверждения не найдена или истекла');
  }
  if (row.expiresAt.getTime() < Date.now() || row.status === 'EXPIRED') {
    if (row.status !== 'EXPIRED') {
      await prisma.loginChallenge.update({
        where: { id: row.id },
        data: { status: 'EXPIRED' },
      }).catch(() => undefined);
    }
    return { status: 'EXPIRED' };
  }
  if (row.status === 'DENIED' || row.status === 'USED') {
    return { status: row.status };
  }

  if (row.status === 'APPROVED') {
    if (!row.approvedAccountType || !row.approvedAccountId) {
      throw badRequest('Вход ещё не подтверждён');
    }
    const approved = {
      accountType: row.approvedAccountType as AccountType,
      accountId: row.approvedAccountId,
    };
    const session = await markUsedAndFinish(
      row.id,
      row.identifier || '',
      [{ t: approved.accountType, i: approved.accountId }],
      row.rememberMe,
      null,
      approved
    );
    return { status: 'APPROVED', session };
  }

  return { status: row.status };
}

export async function approveQrChallenge(params: {
  challengeToken: string;
  secret: string;
  accountType: AccountType;
  accountId: string;
}): Promise<{ ok: true }> {
  const row = await loadChallenge(params.challengeToken);
  if (row.method !== 'QR') throw badRequest('Неверный тип подтверждения');
  if (!row.secretHash || row.secretHash !== hash(params.secret)) {
    throw unauthorized('Некорректный QR-код');
  }
  // Пустой accountsJson — анонимный QR: любой залогиненный актор может подтвердить.
  // Если список задан (legacy) — только перечисленные аккаунты.
  const accounts = parseAccounts(row.accountsJson);
  if (accounts.length > 0) {
    const allowed = accounts.some((a) => a.t === params.accountType && a.i === params.accountId);
    if (!allowed) {
      throw unauthorized('Этот аккаунт не может подтвердить вход');
    }
  }
  await prisma.loginChallenge.update({
    where: { id: row.id },
    data: {
      status: 'APPROVED',
      approvedAccountType: params.accountType,
      approvedAccountId: params.accountId,
      accountsJson: JSON.stringify([{ t: params.accountType, i: params.accountId }]),
    },
  });
  return { ok: true };
}

export async function denyQrChallenge(params: {
  challengeToken: string;
  secret: string;
}): Promise<{ ok: true }> {
  const row = await loadChallenge(params.challengeToken);
  if (row.method !== 'QR') throw badRequest('Неверный тип подтверждения');
  if (!row.secretHash || row.secretHash !== hash(params.secret)) {
    throw unauthorized('Некорректный QR-код');
  }
  await prisma.loginChallenge.update({
    where: { id: row.id },
    data: { status: 'DENIED' },
  });
  return { ok: true };
}
