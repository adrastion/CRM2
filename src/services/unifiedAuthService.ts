import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import {
  IdentifierType,
  detectIdentifierType,
  normalizeEmail,
  normalizePhone,
  phoneTail,
} from '../utils/identifier';
import { HttpError, badRequest, unauthorized } from '../utils/httpError';

const BCRYPT_ROUNDS = 12;

/** Время жизни токена выбора аккаунта между шагами «пароль» → «выбор организации». */
const SELECTION_TOKEN_TTL = '10m';

/** Обычная сессия и сессия с «Запомнить меня». */
const SESSION_TTL = process.env.JWT_EXPIRES_IN || '7d';
const SESSION_TTL_REMEMBER = process.env.JWT_EXPIRES_IN_REMEMBER || '30d';

/* ------------------------------------------------------------------ */
/* Типы                                                                */
/* ------------------------------------------------------------------ */

/** Все виды аккаунтов, которые обслуживает единая авторизация. */
export type AccountType =
  | 'TENANT_USER'
  | 'CLIENT'
  | 'PARENT'
  | 'MARKETER'
  | 'PROMO_CODE_ADMIN'
  | 'SUPER_ADMIN'
  | 'PLATFORM_STAFF';

/** Клиентские роли — им показывается личный кабинет ученика/родителя. */
const CLIENT_ACCOUNT_TYPES: AccountType[] = ['CLIENT', 'PARENT'];

export interface TenantBrief {
  id: string;
  name: string;
  subdomain: string;
}

/** Один найденный аккаунт по идентификатору. */
export interface AccountCandidate {
  accountType: AccountType;
  /** id записи в соответствующей таблице. */
  id: string;
  /** Отображаемое имя владельца аккаунта. */
  displayName: string;
  /** OWNER / ADMIN / TRAINER / SUPPORT / … — если применимо. */
  role?: string;
  tenant?: TenantBrief;
  /** Установлен ли пароль (у клиентов и родителей он может отсутствовать). */
  hasPassword: boolean;
  /** Подтверждён ли аккаунт администратором школы (только клиенты/родители). */
  isAccountApproved: boolean;
  /** Хеш пароля — не покидает сервер. */
  passwordHash: string | null;
  /** Для родителя — ФИО ребёнка, чтобы отличать однофамильцев. */
  childName?: string;
}

/** Аккаунт в том виде, в котором он уезжает на фронтенд. */
export interface PublicAccount {
  accountType: AccountType;
  id: string;
  displayName: string;
  role?: string;
  tenant?: TenantBrief;
  isAccountApproved: boolean;
  childName?: string;
}

export interface IdentifyResult {
  identifierType: IdentifierType;
  /** Нормализованное значение, которое надо отправить в следующих запросах. */
  identifier: string;
  /** Найден ли хоть один аккаунт. */
  exists: boolean;
  /** Ни у одного найденного аккаунта нет пароля — нужен экран «Придумайте пароль». */
  needsPasswordSetup: boolean;
  /** Сколько аккаунтов найдено (для отладки и подсказок в интерфейсе). */
  accountsCount: number;
}

export interface SessionPayload {
  accountType: AccountType;
  token: string;
  tenant?: TenantBrief;
  user?: Record<string, unknown>;
  client?: Record<string, unknown>;
  parent?: Record<string, unknown>;
  marketer?: Record<string, unknown>;
  admin?: Record<string, unknown>;
  superAdmin?: Record<string, unknown>;
  staff?: Record<string, unknown>;
  /** Подтверждён ли аккаунт (только клиенты/родители). */
  isAccountApproved?: boolean;
}

export interface SelectionRequired {
  requiresSelection: true;
  /** Короткоживущий токен, подтверждающий, что пароль уже проверен. */
  selectionToken: string;
  /** Аккаунты ученика/родителя. */
  clientAccounts: PublicAccount[];
  /** Аккаунты сотрудника, маркетолога, админа промокодов и персонала платформы. */
  staffAccounts: PublicAccount[];
}

export type LoginResult = ({ requiresSelection: false } & SessionPayload) | SelectionRequired;

/* ------------------------------------------------------------------ */
/* Вспомогательные функции                                             */
/* ------------------------------------------------------------------ */

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new HttpError(500, 'JWT_SECRET is not configured');
  }
  return secret;
}

/** Таблицы, в которых ищем по номеру телефона. Список фиксированный. */
const PHONE_TABLES = {
  users: 'users',
  clients: 'clients',
  parents: 'parents',
  marketers: 'marketers',
  promoCodeAdmins: 'promo_code_admins',
} as const;

/**
 * Поиск id по последним 10 цифрам номера.
 *
 * В базе телефоны хранятся в произвольном формате (+7 (999) 123-45-67,
 * 89991234567, 9991234567), поэтому сравниваем нормализованные значения
 * средствами PostgreSQL.
 */
async function findIdsByPhone(table: keyof typeof PHONE_TABLES, tail: string): Promise<string[]> {
  if (tail.length < 10) return [];
  const tableName = PHONE_TABLES[table];
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "${tableName}" WHERE phone IS NOT NULL
       AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE $1
     LIMIT 200`,
    `%${tail}`
  );
  return rows.map((r) => r.id);
}

function fullName(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ').trim();
}

function toTenantBrief(tenant: { id: string; name: string; subdomain: string }): TenantBrief {
  return { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain };
}

function toPublicAccount(a: AccountCandidate): PublicAccount {
  return {
    accountType: a.accountType,
    id: a.id,
    displayName: a.displayName,
    role: a.role,
    tenant: a.tenant,
    isAccountApproved: a.isAccountApproved,
    childName: a.childName,
  };
}

/** Сортировка: сначала клиентские аккаунты, внутри — по названию школы. */
function sortAccounts(accounts: PublicAccount[]): PublicAccount[] {
  return [...accounts].sort((a, b) => {
    const nameA = a.tenant?.name || a.displayName;
    const nameB = b.tenant?.name || b.displayName;
    return nameA.localeCompare(nameB, 'ru');
  });
}

/* ------------------------------------------------------------------ */
/* Сервис                                                              */
/* ------------------------------------------------------------------ */

export class UnifiedAuthService {
  /**
   * Разбирает введённое значение и падает с понятной ошибкой,
   * если это ни телефон, ни email.
   */
  static parseIdentifier(raw: string): { type: IdentifierType; value: string } {
    const type = detectIdentifierType(raw);
    if (!type) {
      throw badRequest('Введите корректный номер телефона или email', 'identifier');
    }
    return {
      type,
      value: type === 'email' ? normalizeEmail(raw) : normalizePhone(raw),
    };
  }

  /**
   * Ищет все аккаунты во всех школах, у которых совпадает телефон или email.
   * Это ядро объединённой авторизации: один идентификатор → все роли.
   */
  static async findAccounts(rawIdentifier: string): Promise<AccountCandidate[]> {
    const { type, value } = this.parseIdentifier(rawIdentifier);
    const email = type === 'email' ? value : null;
    const tail = type === 'phone' ? phoneTail(value) : '';

    const [userIds, clientIds, parentIds, marketerIds, promoAdminIds] =
      type === 'phone'
        ? await Promise.all([
            findIdsByPhone('users', tail),
            findIdsByPhone('clients', tail),
            findIdsByPhone('parents', tail),
            findIdsByPhone('marketers', tail),
            findIdsByPhone('promoCodeAdmins', tail),
          ])
        : [[], [], [], [], []];

    const tenantSelect = { select: { id: true, name: true, subdomain: true, isActive: true } };

    const [users, clients, parents, marketers, promoAdmins, superAdmin, platformStaff] =
      await Promise.all([
        prisma.user.findMany({
          where: email ? { email } : { id: { in: userIds } },
          include: { tenant: tenantSelect },
        }),
        prisma.client.findMany({
          where: email
            ? { email: { equals: email, mode: 'insensitive' }, isActive: true }
            : { id: { in: clientIds }, isActive: true },
          include: { tenant: tenantSelect },
        }),
        prisma.parent.findMany({
          where: email
            ? { email: { equals: email, mode: 'insensitive' }, isApproved: true }
            : { id: { in: parentIds }, isApproved: true },
          include: {
            tenant: tenantSelect,
            client: { select: { id: true, firstName: true, lastName: true, middleName: true } },
          },
        }),
        prisma.marketer.findMany({
          where: email ? { email } : { id: { in: marketerIds } },
          include: { tenant: tenantSelect },
        }),
        prisma.promoCodeAdmin.findMany({
          where: email ? { email } : { id: { in: promoAdminIds } },
          include: { tenant: tenantSelect },
        }),
        email ? prisma.superAdmin.findUnique({ where: { email } }) : Promise.resolve(null),
        email ? prisma.platformStaffUser.findUnique({ where: { email } }) : Promise.resolve(null),
      ]);

    const accounts: AccountCandidate[] = [];

    for (const u of users) {
      if (!u.isActive || !u.tenant.isActive) continue;
      accounts.push({
        accountType: 'TENANT_USER',
        id: u.id,
        displayName: fullName([u.lastName, u.firstName, u.middleName]),
        role: u.role,
        tenant: toTenantBrief(u.tenant),
        hasPassword: Boolean(u.password),
        isAccountApproved: true,
        passwordHash: u.password,
      });
    }

    for (const c of clients) {
      if (!c.tenant.isActive) continue;
      accounts.push({
        accountType: 'CLIENT',
        id: c.id,
        displayName: fullName([c.lastName, c.firstName, c.middleName]),
        tenant: toTenantBrief(c.tenant),
        hasPassword: Boolean(c.password),
        isAccountApproved: c.isAccountApproved,
        passwordHash: c.password,
      });
    }

    for (const p of parents) {
      if (!p.tenant.isActive) continue;
      accounts.push({
        accountType: 'PARENT',
        id: p.id,
        displayName: p.fullName,
        tenant: toTenantBrief(p.tenant),
        hasPassword: Boolean(p.password),
        isAccountApproved: p.isAccountApproved,
        passwordHash: p.password,
        childName: p.client
          ? fullName([p.client.lastName, p.client.firstName, p.client.middleName])
          : undefined,
      });
    }

    for (const m of marketers) {
      if (!m.isActive || !m.tenant.isActive) continue;
      accounts.push({
        accountType: 'MARKETER',
        id: m.id,
        displayName: m.name,
        role: m.type,
        tenant: toTenantBrief(m.tenant),
        hasPassword: Boolean(m.password),
        isAccountApproved: true,
        passwordHash: m.password,
      });
    }

    for (const a of promoAdmins) {
      if (!a.isActive || !a.tenant.isActive) continue;
      accounts.push({
        accountType: 'PROMO_CODE_ADMIN',
        id: a.id,
        displayName: a.name,
        tenant: toTenantBrief(a.tenant),
        hasPassword: Boolean(a.password),
        isAccountApproved: true,
        passwordHash: a.password,
      });
    }

    if (superAdmin && superAdmin.isActive) {
      accounts.push({
        accountType: 'SUPER_ADMIN',
        id: superAdmin.id,
        displayName: fullName([superAdmin.lastName, superAdmin.firstName]),
        hasPassword: Boolean(superAdmin.password),
        isAccountApproved: true,
        passwordHash: superAdmin.password,
      });
    }

    if (platformStaff && platformStaff.isActive) {
      accounts.push({
        accountType: 'PLATFORM_STAFF',
        id: platformStaff.id,
        displayName: fullName([platformStaff.lastName, platformStaff.firstName]),
        role: platformStaff.role,
        hasPassword: Boolean(platformStaff.password),
        isAccountApproved: true,
        passwordHash: platformStaff.password,
      });
    }

    return accounts;
  }

  /**
   * Шаг 1: проверяем, что идентификатор есть в базе, и определяем,
   * нужен ли пользователю экран создания пароля.
   */
  static async identify(rawIdentifier: string): Promise<IdentifyResult> {
    const { type, value } = this.parseIdentifier(rawIdentifier);
    const accounts = await this.findAccounts(rawIdentifier);

    if (accounts.length === 0) {
      throw unauthorized(
        type === 'phone'
          ? 'Такой номер не найден в базе спортивной школы'
          : 'Такой email не найден в базе спортивной школы',
        'identifier'
      );
    }

    const withPassword = accounts.filter((a) => a.hasPassword);

    return {
      identifierType: type,
      identifier: value,
      exists: true,
      needsPasswordSetup: withPassword.length === 0,
      accountsCount: accounts.length,
    };
  }

  /**
   * Шаг 2 (первый вход): пользователь придумывает пароль.
   * Пароль записывается всем найденным аккаунтам ученика/родителя,
   * у которых его ещё нет, — чтобы один идентификатор давал один пароль.
   */
  static async setupPassword(
    rawIdentifier: string,
    password: string,
    rememberMe = false
  ): Promise<LoginResult> {
    if (!password || password.length < 6) {
      throw badRequest('Пароль должен содержать минимум 6 символов', 'password');
    }

    const accounts = await this.findAccounts(rawIdentifier);
    if (accounts.length === 0) {
      throw unauthorized('Аккаунт не найден в базе спортивной школы', 'identifier');
    }

    const alreadyHasPassword = accounts.some((a) => a.hasPassword);
    if (alreadyHasPassword) {
      throw badRequest(
        'Пароль уже создан. Введите существующий пароль для входа.',
        'password'
      );
    }

    // Пароль можно создать только для клиентских аккаунтов: у сотрудников
    // пароль выдаётся школой и в базе всегда присутствует.
    const target = accounts.filter((a) => CLIENT_ACCOUNT_TYPES.includes(a.accountType));
    if (target.length === 0) {
      throw badRequest('Для этого аккаунта пароль задаёт администратор школы', 'password');
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await prisma.$transaction([
      prisma.client.updateMany({
        where: {
          id: { in: target.filter((a) => a.accountType === 'CLIENT').map((a) => a.id) },
          password: null,
        },
        data: { password: hash },
      }),
      prisma.parent.updateMany({
        where: {
          id: { in: target.filter((a) => a.accountType === 'PARENT').map((a) => a.id) },
          password: null,
        },
        data: { password: hash },
      }),
    ]);

    // Сразу впускаем пользователя: подтверждение школы проверяется уже внутри кабинета.
    const authenticated = target.map((a) => ({ ...a, hasPassword: true, passwordHash: hash }));
    return this.completeLogin(rawIdentifier, authenticated, rememberMe);
  }

  /**
   * Шаг 2 (обычный вход): проверяем пароль по всем найденным аккаунтам.
   * Совпасть может сразу несколько — тогда предлагаем выбор организации.
   */
  static async login(
    rawIdentifier: string,
    password: string,
    rememberMe = false
  ): Promise<LoginResult> {
    if (!password) {
      throw badRequest('Введите пароль', 'password');
    }

    const accounts = await this.findAccounts(rawIdentifier);
    if (accounts.length === 0) {
      throw unauthorized('Аккаунт не найден в базе спортивной школы', 'identifier');
    }

    const withPassword = accounts.filter((a) => a.hasPassword && a.passwordHash);
    if (withPassword.length === 0) {
      throw new HttpError(409, 'Пароль ещё не создан', { field: 'password' });
    }

    const matched: AccountCandidate[] = [];
    for (const account of withPassword) {
      // Хеши разные у разных аккаунтов, поэтому проверяем каждый.
      if (await bcrypt.compare(password, account.passwordHash as string)) {
        matched.push(account);
      }
    }

    if (matched.length === 0) {
      throw unauthorized('Неверный пароль', 'password');
    }

    return this.completeLogin(rawIdentifier, matched, rememberMe);
  }

  /**
   * Либо выдаём сессию сразу, либо просим выбрать организацию.
   */
  private static async completeLogin(
    rawIdentifier: string,
    matched: AccountCandidate[],
    rememberMe: boolean
  ): Promise<LoginResult> {
    if (matched.length === 1) {
      const session = await this.issueSession(matched[0], rememberMe);
      return { requiresSelection: false, ...session };
    }

    const clientAccounts = matched.filter((a) => CLIENT_ACCOUNT_TYPES.includes(a.accountType));
    const staffAccounts = matched.filter((a) => !CLIENT_ACCOUNT_TYPES.includes(a.accountType));

    const selectionToken = jwt.sign(
      {
        type: 'account_selection',
        identifier: rawIdentifier,
        accounts: matched.map((a) => ({ t: a.accountType, i: a.id })),
        rememberMe,
      },
      jwtSecret(),
      { expiresIn: SELECTION_TOKEN_TTL } as SignOptions
    );

    return {
      requiresSelection: true,
      selectionToken,
      clientAccounts: sortAccounts(clientAccounts.map(toPublicAccount)),
      staffAccounts: sortAccounts(staffAccounts.map(toPublicAccount)),
    };
  }

  /**
   * Шаг 3: пользователь выбрал организацию/роль — выдаём сессию.
   */
  static async selectAccount(
    selectionToken: string,
    accountType: AccountType,
    accountId: string
  ): Promise<{ requiresSelection: false } & SessionPayload> {
    let decoded: {
      type?: string;
      identifier?: string;
      accounts?: Array<{ t: AccountType; i: string }>;
      rememberMe?: boolean;
    };

    try {
      decoded = jwt.verify(selectionToken, jwtSecret()) as typeof decoded;
    } catch {
      throw unauthorized('Сессия выбора организации истекла. Войдите заново.');
    }

    if (decoded.type !== 'account_selection' || !decoded.identifier || !decoded.accounts) {
      throw unauthorized('Некорректный токен выбора организации');
    }

    const allowed = decoded.accounts.some((a) => a.t === accountType && a.i === accountId);
    if (!allowed) {
      throw unauthorized('Этот аккаунт недоступен для входа');
    }

    // Перечитываем аккаунт из базы: за время выбора он мог измениться.
    const accounts = await this.findAccounts(decoded.identifier);
    const account = accounts.find((a) => a.accountType === accountType && a.id === accountId);
    if (!account) {
      throw unauthorized('Аккаунт больше не доступен');
    }

    const session = await this.issueSession(account, Boolean(decoded.rememberMe));
    return { requiresSelection: false, ...session };
  }

  /**
   * Выдаёт JWT в том же формате, который ожидают существующие middleware,
   * чтобы не ломать защищённые маршруты.
   */
  private static async issueSession(
    account: AccountCandidate,
    rememberMe: boolean
  ): Promise<SessionPayload> {
    const secret = jwtSecret();
    const expiresIn = rememberMe ? SESSION_TTL_REMEMBER : SESSION_TTL;
    const sign = (payload: object) => jwt.sign(payload, secret, { expiresIn } as SignOptions);

    switch (account.accountType) {
      case 'TENANT_USER': {
        const user = await prisma.user.findUnique({
          where: { id: account.id },
          include: { tenant: true },
        });
        if (!user) throw unauthorized('Аккаунт не найден');

        await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

        return {
          accountType: 'TENANT_USER',
          token: sign({
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
          }),
          tenant: toTenantBrief(user.tenant),
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            middleName: user.middleName,
            phone: user.phone,
            role: user.role,
            tenantId: user.tenantId,
          },
        };
      }

      case 'CLIENT': {
        const client = await prisma.client.findUnique({
          where: { id: account.id },
          include: { tenant: true },
        });
        if (!client) throw unauthorized('Аккаунт не найден');

        await prisma.client.update({ where: { id: client.id }, data: { lastLogin: new Date() } });

        return {
          accountType: 'CLIENT',
          token: sign({ clientId: client.id, tenantId: client.tenantId, type: 'client' }),
          tenant: toTenantBrief(client.tenant),
          client: {
            id: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            middleName: client.middleName,
            email: client.email,
            phone: client.phone,
            tenantId: client.tenantId,
            isAccountApproved: client.isAccountApproved,
          },
          isAccountApproved: client.isAccountApproved,
        };
      }

      case 'PARENT': {
        const parent = await prisma.parent.findUnique({
          where: { id: account.id },
          include: {
            tenant: true,
            client: { select: { id: true, firstName: true, lastName: true, middleName: true } },
          },
        });
        if (!parent) throw unauthorized('Аккаунт не найден');

        await prisma.parent.update({ where: { id: parent.id }, data: { lastLogin: new Date() } });

        return {
          accountType: 'PARENT',
          token: sign({ parentId: parent.id, tenantId: parent.tenantId, type: 'parent' }),
          tenant: toTenantBrief(parent.tenant),
          parent: {
            id: parent.id,
            fullName: parent.fullName,
            email: parent.email,
            phone: parent.phone,
            tenantId: parent.tenantId,
            clientId: parent.clientId,
            client: parent.client,
            isAccountApproved: parent.isAccountApproved,
          },
          isAccountApproved: parent.isAccountApproved,
        };
      }

      case 'MARKETER': {
        const marketer = await prisma.marketer.findUnique({
          where: { id: account.id },
          include: { tenant: true },
        });
        if (!marketer) throw unauthorized('Аккаунт не найден');

        return {
          accountType: 'MARKETER',
          token: sign({
            userId: marketer.id,
            email: marketer.email,
            type: 'MARKETER',
            tenantId: marketer.tenantId,
          }),
          tenant: toTenantBrief(marketer.tenant),
          marketer: {
            id: marketer.id,
            email: marketer.email,
            name: marketer.name,
            type: marketer.type,
            tenantId: marketer.tenantId,
          },
        };
      }

      case 'PROMO_CODE_ADMIN': {
        const admin = await prisma.promoCodeAdmin.findUnique({
          where: { id: account.id },
          include: { tenant: true },
        });
        if (!admin) throw unauthorized('Аккаунт не найден');

        return {
          accountType: 'PROMO_CODE_ADMIN',
          token: sign({
            userId: admin.id,
            email: admin.email,
            type: 'PROMO_CODE_ADMIN',
            tenantId: admin.tenantId,
          }),
          tenant: toTenantBrief(admin.tenant),
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            tenantId: admin.tenantId,
          },
        };
      }

      case 'SUPER_ADMIN': {
        const superAdmin = await prisma.superAdmin.findUnique({ where: { id: account.id } });
        if (!superAdmin) throw unauthorized('Аккаунт не найден');

        await prisma.superAdmin.update({
          where: { id: superAdmin.id },
          data: { lastLogin: new Date() },
        });

        return {
          accountType: 'SUPER_ADMIN',
          token: sign({ userId: superAdmin.id, email: superAdmin.email, type: 'SUPER_ADMIN' }),
          superAdmin: {
            id: superAdmin.id,
            email: superAdmin.email,
            firstName: superAdmin.firstName,
            lastName: superAdmin.lastName,
          },
        };
      }

      case 'PLATFORM_STAFF': {
        const staff = await prisma.platformStaffUser.findUnique({ where: { id: account.id } });
        if (!staff) throw unauthorized('Аккаунт не найден');

        await prisma.platformStaffUser.update({
          where: { id: staff.id },
          data: { lastLogin: new Date() },
        });

        return {
          accountType: 'PLATFORM_STAFF',
          token: sign({
            userId: staff.id,
            email: staff.email,
            type: 'PLATFORM_STAFF',
            role: staff.role,
          }),
          staff: {
            id: staff.id,
            email: staff.email,
            firstName: staff.firstName,
            lastName: staff.lastName,
            role: staff.role,
            mustChangePassword: staff.mustChangePassword,
          },
        };
      }

      default:
        throw new HttpError(500, 'Неизвестный тип аккаунта');
    }
  }
}
