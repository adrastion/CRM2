import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '@prisma/client';
import { JWTPayload, CreateClientData } from '../types';
import { HttpError } from '../utils/httpError';
import { PasswordResetService } from './passwordResetService';
import { BCRYPT_ROUNDS, LOGIN_FAILED_MESSAGE } from '../constants/security';
import { SubscriptionService } from './subscriptionService';
import type { PlanLimits } from './planCatalogService';
import { planLimitHttpError } from '../utils/planLimits';
import {
  SessionRequestMeta,
  createAuthSession,
  expiresAtFromTtl,
  revokeSessionsOnVersionBump,
} from './authSessionService';

const STAFF_LIMIT_BY_ROLE: Partial<Record<string, keyof PlanLimits>> = {
  ADMIN: 'extraStaff',
  PROMOTER: 'extraStaff',
  TRAINER: 'trainers',
};

async function assertStaffRoleWithinLimit(tenantId: string, role: string) {
  const resource = STAFF_LIMIT_BY_ROLE[role];
  if (!resource) return;
  const allowed = await SubscriptionService.checkLimit(tenantId, resource);
  if (!allowed) {
    throw await planLimitHttpError(tenantId, resource);
  }
}

export class AuthService {
  /**
   * Generate subdomain from tenant name
   */
  private static generateSubdomain(tenantName: string): string {
    // Transliterate Cyrillic to Latin
    const transliterationMap: { [key: string]: string } = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };

    let subdomain = tenantName
      .toLowerCase()
      .split('')
      .map(char => transliterationMap[char] || char)
      .join('')
      // Replace spaces and special characters with hyphens
      .replace(/[^a-z0-9]+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Limit length
      .substring(0, 50);

    // Ensure minimum length
    if (subdomain.length < 2) {
      subdomain = 'school-' + Date.now().toString().slice(-6);
    }

    return subdomain;
  }

  /**
   * Generate unique subdomain
   */
  private static async generateUniqueSubdomain(baseSubdomain: string): Promise<string> {
    let subdomain = baseSubdomain;
    let counter = 1;

    while (true) {
      const existingTenant = await prisma.tenant.findUnique({
        where: { subdomain }
      });

      if (!existingTenant) {
        return subdomain;
      }

      // If subdomain exists, append counter
      const suffix = `-${counter}`;
      const maxLength = 50 - suffix.length;
      subdomain = baseSubdomain.substring(0, maxLength) + suffix;
      counter++;
    }
  }

  /**
   * Register a new tenant and owner
   */
  static async registerTenant(data: {
    tenantName: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    // Generate unique subdomain from tenant name
    const baseSubdomain = this.generateSubdomain(data.tenantName);
    const subdomain = await this.generateUniqueSubdomain(baseSubdomain);

    // Normalize email (lowercase and trim)
    const normalizedEmail = data.email.toLowerCase().trim();

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    // Create tenant and user in transaction
    // Email уникален только внутри школы — тот же email может быть тренером в другой школе
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: data.tenantName.trim(),
          subdomain: subdomain, // Use generated subdomain
          email: normalizedEmail,
          phone: data.phone?.trim() || null
        }
      });

      // Create owner user
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phone: data.phone?.trim() || null,
          role: 'OWNER',
          tenantId: tenant.id
        }
      });

      // Create FREE subscription for new tenant
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 100); // Устанавливаем дату окончания далеко в будущем для FREE тарифа

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planType: 'FREE',
          status: 'active',
          startDate,
          endDate,
          autoRenew: true,
        },
      });

      return { tenant, user };
    });

    // Generate JWT token
    const token = await this.generateToken(result.user);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        tenantId: result.user.tenantId
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        subdomain: result.tenant.subdomain
      },
      token
    };
  }

  /**
   * Login user
   */
  static async login(email: string, password: string, meta?: SessionRequestMeta | null) {
    // Приводим email к нижнему регистру для поиска
    const normalizedEmail = email.trim().toLowerCase();

    const candidates = await prisma.user.findMany({
      where: { email: normalizedEmail },
      include: { tenant: true },
    });

    if (candidates.length === 0) {
      throw new Error(LOGIN_FAILED_MESSAGE);
    }

    const matched: typeof candidates = [];
    for (const candidate of candidates) {
      if (!candidate.isActive || !candidate.tenant.isActive) continue;
      if (await bcrypt.compare(password, candidate.password)) {
        matched.push(candidate);
      }
    }

    if (matched.length === 0) {
      const anyActive = candidates.some((c) => c.isActive && c.tenant.isActive);
      if (!anyActive) {
        throw new Error('Аккаунт деактивирован');
      }
      throw new Error(LOGIN_FAILED_MESSAGE);
    }

    if (matched.length > 1) {
      throw new Error(
        'Несколько школ с этим email. Войдите через единую авторизацию на странице /auth'
      );
    }

    const user = matched[0];

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate JWT token
    const token = await this.generateToken(user, meta);

    const { getSeniorAccessMeta } = await import('../utils/branchAccess');
    // OWNER с Trainer-профилем тоже получает trainerId / senior-метки
    const seniorMeta =
      user.role === 'TRAINER' || user.role === 'OWNER'
        ? await getSeniorAccessMeta(user.id, user.tenantId)
        : { isSeniorTrainer: false, seniorBranchIds: [] as string[], trainerId: null as string | null };

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        isSeniorTrainer: seniorMeta.isSeniorTrainer,
        seniorBranchIds: seniorMeta.seniorBranchIds,
        trainerId: seniorMeta.trainerId,
        isTrainer: Boolean(seniorMeta.trainerId),
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        subdomain: user.tenant.subdomain
      },
      token
    };
  }

  /**
   * Login promo code admin
   */
  static async promoCodeAdminLogin(email: string, password: string) {
    // Приводим email к нижнему регистру для поиска
    const normalizedEmail = email.trim().toLowerCase();
    
    // Find promo code admin with tenant
    const admin = await prisma.promoCodeAdmin.findFirst({
      where: { email: normalizedEmail },
      include: { tenant: true }
    });

    if (!admin) {
      throw new Error(LOGIN_FAILED_MESSAGE);
    }

    if (!admin.isActive) {
      throw new Error('Аккаунт деактивирован');
    }

    if (!admin.tenant.isActive) {
      throw new Error('Аккаунт организации деактивирован');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new Error(LOGIN_FAILED_MESSAGE);
    }

    // Generate JWT token for promo code admin
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET не настроен');
    }
    
    const token = jwt.sign(
      {
        userId: admin.id,
        email: admin.email,
        type: 'PROMO_CODE_ADMIN',
        tenantId: admin.tenantId
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        tenantId: admin.tenantId
      },
      tenant: {
        id: admin.tenant.id,
        name: admin.tenant.name,
        subdomain: admin.tenant.subdomain
      },
      token
    };
  }

  /**
   * Login marketer
   */
  static async marketerLogin(
    email: string,
    password: string,
    meta?: SessionRequestMeta | null
  ) {
    // Приводим email к нижнему регистру для поиска
    const normalizedEmail = email.trim().toLowerCase();
    
    // Find marketer (platform — tenant optional)
    const marketer = await prisma.marketer.findFirst({
      where: { email: normalizedEmail },
      include: { tenant: true }
    });

    if (!marketer) {
      throw new Error(LOGIN_FAILED_MESSAGE);
    }

    if (!marketer.isActive) {
      throw new Error('Аккаунт деактивирован');
    }

    if (marketer.tenantId && marketer.tenant && !marketer.tenant.isActive) {
      throw new Error('Аккаунт организации деактивирован');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, marketer.password);
    if (!isPasswordValid) {
      throw new Error(LOGIN_FAILED_MESSAGE);
    }

    // Generate JWT token for marketer
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET не настроен');
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const authSession = await createAuthSession({
      actorType: 'MARKETER',
      actorId: marketer.id,
      expiresAt: expiresAtFromTtl(expiresIn),
      meta,
    });

    const token = jwt.sign(
      {
        userId: marketer.id,
        email: marketer.email,
        type: 'MARKETER',
        tenantId: marketer.tenantId,
        jti: authSession.id,
      },
      jwtSecret,
      { expiresIn } as jwt.SignOptions
    );

    return {
      marketer: {
        id: marketer.id,
        email: marketer.email,
        name: marketer.name,
        type: marketer.type,
        tenantId: marketer.tenantId,
        commissionPercentage: Number(marketer.commissionPercentage),
        balance: Number(marketer.balance),
      },
      tenant: marketer.tenant
        ? {
            id: marketer.tenant.id,
            name: marketer.tenant.name,
            subdomain: marketer.tenant.subdomain
          }
        : null,
      token
    };
  }

  static async changeMarketerPassword(
    marketerId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const marketer = await prisma.marketer.findUnique({ where: { id: marketerId } });
    if (!marketer) throw new Error('Маркетолог не найден');
    const ok = await bcrypt.compare(currentPassword, marketer.password);
    if (!ok) throw new Error('Неверный текущий пароль');
    if (String(newPassword || '').length < 6) {
      throw new Error('Пароль должен содержать минимум 6 символов');
    }
    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.marketer.update({
      where: { id: marketerId },
      data: { password: hashed },
    });
    return { ok: true };
  }

  /**
   * Единый вход для всех ролей кроме клиентов (владелец/админ/тренер, маркетолог, админ промокодов, супер-админ, персонал платформы).
   */
  static async unifiedStaffLogin(
    email: string,
    password: string,
    meta?: SessionRequestMeta | null
  ) {
    try {
      const result = await this.login(email, password, meta);
      return { accountType: 'TENANT_USER' as const, ...result };
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : '';
      if (m !== LOGIN_FAILED_MESSAGE) throw e;
    }

    try {
      const result = await this.marketerLogin(email, password, meta);
      return { accountType: 'MARKETER' as const, ...result };
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : '';
      if (m !== LOGIN_FAILED_MESSAGE) throw e;
    }

    try {
      const result = await this.promoCodeAdminLogin(email, password);
      return { accountType: 'PROMO_CODE_ADMIN' as const, ...result };
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : '';
      if (m !== LOGIN_FAILED_MESSAGE) throw e;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email: normalizedEmail },
    });

    if (superAdmin) {
      if (!superAdmin.isActive) {
        throw new Error('Аккаунт деактивирован');
      }
      const isPasswordValid = await bcrypt.compare(password, superAdmin.password);
      if (!isPasswordValid) {
        throw new Error(LOGIN_FAILED_MESSAGE);
      }
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET не настроен');
      }
      const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
      const authSession = await createAuthSession({
        actorType: 'SUPER_ADMIN',
        actorId: superAdmin.id,
        expiresAt: expiresAtFromTtl(expiresIn),
        meta,
      });
      const token = jwt.sign(
        {
          userId: superAdmin.id,
          email: superAdmin.email,
          type: 'SUPER_ADMIN',
          sv: superAdmin.sessionVersion,
          jti: authSession.id,
        },
        jwtSecret,
        { expiresIn } as SignOptions
      );
      await prisma.superAdmin.update({
        where: { id: superAdmin.id },
        data: { lastLogin: new Date() },
      });
      return {
        accountType: 'SUPER_ADMIN' as const,
        superAdmin: {
          id: superAdmin.id,
          email: superAdmin.email,
          firstName: superAdmin.firstName,
          lastName: superAdmin.lastName,
        },
        token,
      };
    }

    const staff = await prisma.platformStaffUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (staff) {
      if (!staff.isActive) {
        throw new Error('Аккаунт деактивирован');
      }
      const ok = await bcrypt.compare(password, staff.password);
      if (!ok) {
        throw new Error(LOGIN_FAILED_MESSAGE);
      }
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET не настроен');
      }
      const token = jwt.sign(
        {
          userId: staff.id,
          email: staff.email,
          type: 'PLATFORM_STAFF',
          role: staff.role,
        },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
      );
      await prisma.platformStaffUser.update({
        where: { id: staff.id },
        data: { lastLogin: new Date() },
      });
      return {
        accountType: 'PLATFORM_STAFF' as const,
        staff: {
          id: staff.id,
          email: staff.email,
          firstName: staff.firstName,
          lastName: staff.lastName,
          role: staff.role,
          mustChangePassword: (staff as any).mustChangePassword ?? false,
        },
        token,
      };
    }

    throw new Error(LOGIN_FAILED_MESSAGE);
  }

  /**
   * Create a new user (admin or trainer)
   */
  static async createUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    phone?: string;
    role: string;
    tenantId: string;
    isActive?: boolean;
    profileMeta?: string | Record<string, unknown> | null;
  }) {
    if (data.role !== 'ADMIN' && data.role !== 'TRAINER' && data.role !== 'PROMOTER') {
      throw new Error('Роль должна быть ADMIN, TRAINER или PROMOTER');
    }

    await assertStaffRoleWithinLimit(data.tenantId, data.role);

    const normalizedEmail = data.email.toLowerCase().trim();

    // Email уникален внутри школы
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail, tenantId: data.tenantId },
    });

    if (existingUser) {
      throw new Error('Email уже зарегистрирован');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const isActive = data.isActive === undefined ? true : Boolean(data.isActive);
    const profileMeta =
      data.profileMeta == null
        ? null
        : typeof data.profileMeta === 'string'
          ? data.profileMeta.trim() || null
          : JSON.stringify(data.profileMeta);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName ? String(data.middleName).trim() || null : null,
        phone: data.phone,
        role: data.role,
        isActive,
        profileMeta,
        tenantId: data.tenantId
      }
    });

    // If role is TRAINER, create trainer record
    if (data.role === 'TRAINER') {
      await prisma.trainer.create({
        data: {
          userId: user.id,
          tenantId: data.tenantId,
          salaryType: 'fixed',
          salaryAmount: 0,
          salaryScheme: 'fixed_monthly',
          salaryRate: 0,
        }
      });
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      isActive: user.isActive,
      profileMeta: user.profileMeta,
    };
  }

  /**
   * Change user password
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Текущий пароль неверен');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password — сбрасываем старые сессии
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword, sessionVersion: { increment: 1 } }
    });
    await revokeSessionsOnVersionBump('USER', userId);

    return { message: 'Пароль успешно изменён' };
  }

  /**
   * Change user email
   */
  static async changeEmail(userId: string, newEmail: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Неверный пароль');
    }

    // Check if email is already taken in this school
    const existingUser = await prisma.user.findFirst({
      where: {
        email: newEmail.toLowerCase(),
        tenantId: user.tenantId,
        NOT: { id: userId },
      },
    });

    if (existingUser) {
      throw new Error('Email уже используется');
    }

    // Update email — сбрасываем подтверждение
    await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail.toLowerCase(), emailVerified: false }
    });

    return { message: 'Email успешно изменён', email: newEmail.toLowerCase() };
  }

  /**
   * @deprecated Используйте PasswordResetService (сброс по коду).
   */
  static async requestPasswordReset(email: string) {
    return PasswordResetService.requestCode(email);
  }

  /**
   * @deprecated Используйте PasswordResetService.confirm
   */
  static async resetPassword(_token: string, _newPassword: string) {
    throw new Error('Сброс по ссылке больше не поддерживается. Используйте код из письма.');
  }

  /**
   * Generate JWT token
   */
  private static async generateToken(
    user: User,
    meta?: SessionRequestMeta | null
  ): Promise<string> {
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const authSession = await createAuthSession({
      actorType: 'USER',
      actorId: user.id,
      expiresAt: expiresAtFromTtl(expiresIn),
      meta,
    });
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      sv: user.sessionVersion,
      jti: authSession.id,
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): JWTPayload {
    return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
  }

  /**
   * Get user profile
   */
  static async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        tenant: true,
        trainer: true
      }
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    const { getSeniorAccessMeta } = await import('../utils/branchAccess');
    const seniorMeta =
      user.role === 'TRAINER' || user.role === 'OWNER'
        ? await getSeniorAccessMeta(user.id, user.tenantId)
        : { isSeniorTrainer: false, seniorBranchIds: [] as string[], trainerId: null as string | null };

    // Soft-deleted trainer (isActive: false) не считается активным профилем
    const activeTrainer =
      user.trainer && user.trainer.isActive !== false ? user.trainer : null;
    const trainerId = activeTrainer?.id ?? seniorMeta.trainerId ?? null;

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      lastLogin: user.lastLogin,
      tenantId: user.tenantId,
      isSeniorTrainer: seniorMeta.isSeniorTrainer,
      seniorBranchIds: seniorMeta.seniorBranchIds,
      trainerId,
      isTrainer: Boolean(trainerId),
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        subdomain: user.tenant.subdomain
      },
      trainer: activeTrainer
    };
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role
    };
  }

  /**
   * Update user by ID (for owner/admin)
   */
  /**
   * Delete user by ID (owner only)
   */
  static async deleteUser(userId: string, tenantId: string): Promise<User> {
    // Проверяем, что пользователь существует и принадлежит тому же тенанту
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: tenantId
      }
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Нельзя удалить владельца
    if (user.role === 'OWNER') {
      throw new Error('Нельзя удалить владельца');
    }

    // Если это администратор, просто удаляем пользователя
    // Если это тренер, нужно также удалить связанную запись Trainer
    if (user.role === 'TRAINER') {
      const trainer = await prisma.trainer.findFirst({
        where: {
          userId: userId,
          tenantId: tenantId
        }
      });

      if (trainer) {
        // Деактивируем тренера вместо удаления
        await prisma.trainer.update({
          where: { id: trainer.id },
          data: { isActive: false }
        });
      }
    }

    // Удаляем пользователя
    const deletedUser = await prisma.user.delete({
      where: { id: userId }
    });

    return deletedUser;
  }

  static async updateUserById(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      middleName?: string;
      phone?: string;
      email?: string;
      password?: string;
      role?: string;
      tenantId?: string;
      isActive?: boolean;
      profileMeta?: string | Record<string, unknown> | null;
      /** Основной филиал — хранится в profileMeta.branchId */
      branchId?: string | null;
    },
    callerTenantId: string
  ) {
    // Get current user to check role change — только внутри школы вызывающего
    const currentUser = await prisma.user.findFirst({
      where: { id: userId, tenantId: callerTenantId },
      include: { trainer: true }
    });

    if (!currentUser) {
      throw new Error('Пользователь не найден');
    }

    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.middleName !== undefined) updateData.middleName = data.middleName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.isActive !== undefined) {
      updateData.isActive = Boolean(data.isActive);
      if (data.isActive === false) {
        updateData.sessionVersion = { increment: 1 };
      }
    }

    if (data.email) {
      const normalizedEmail = data.email.toLowerCase().trim();
      // Уникальность email внутри школы
      const existingUser = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          tenantId: currentUser.tenantId,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new Error('Email уже зарегистрирован');
      }
      updateData.email = normalizedEmail;
    }

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
      updateData.sessionVersion = { increment: 1 };
    }

    // profileMeta + optional branchId merge
    if (data.profileMeta !== undefined || data.branchId !== undefined) {
      let metaObj: Record<string, unknown> = {};
      try {
        const raw = currentUser.profileMeta;
        if (raw) metaObj = JSON.parse(raw);
      } catch {
        metaObj = {};
      }
      if (data.profileMeta != null) {
        if (typeof data.profileMeta === 'string') {
          try {
            metaObj = { ...metaObj, ...JSON.parse(data.profileMeta) };
          } catch {
            /* keep previous */
          }
        } else {
          metaObj = { ...metaObj, ...data.profileMeta };
        }
      }
      if (data.branchId !== undefined) {
        if (data.branchId == null || data.branchId === '') {
          delete metaObj.branchId;
        } else {
          metaObj.branchId = data.branchId;
        }
      }
      updateData.profileMeta = Object.keys(metaObj).length ? JSON.stringify(metaObj) : null;
    }

    // Handle role change
    if (data.role && data.role !== currentUser.role) {
      if (data.role !== 'ADMIN' && data.role !== 'TRAINER' && data.role !== 'PROMOTER') {
        throw new HttpError(400, 'Роль может быть ADMIN, TRAINER или PROMOTER');
      }

      await assertStaffRoleWithinLimit(currentUser.tenantId, data.role);

      updateData.role = data.role;

      // If changing from TRAINER to ADMIN/PROMOTER, delete trainer record
      if (currentUser.role === 'TRAINER' && data.role !== 'TRAINER') {
        if (currentUser.trainer) {
          const groupCount = await prisma.group.count({
            where: { trainerId: currentUser.trainer.id }
          });
          if (groupCount > 0) {
            throw new HttpError(
              400,
              'Сначала переназначьте группы другому тренеру, затем смените роль'
            );
          }
          await prisma.trainer.delete({
            where: { id: currentUser.trainer.id }
          });
        }
      }

      // If changing to TRAINER, create trainer record
      if (data.role === 'TRAINER' && currentUser.role !== 'TRAINER') {
        const tenantId = currentUser.tenantId;
        if (!currentUser.trainer) {
          await prisma.trainer.create({
            data: {
              userId: userId,
              tenantId: tenantId,
              salaryType: 'fixed',
              salaryAmount: 0,
              salaryScheme: 'fixed_monthly',
              salaryRate: 0,
            }
          });
        }
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { trainer: true }
    });

    if (data.password || data.isActive === false) {
      await revokeSessionsOnVersionBump('USER', userId);
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      profileMeta: user.profileMeta,
    };
  }
}
