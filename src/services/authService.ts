import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '@prisma/client';
import { JWTPayload, CreateClientData } from '../types';
import { HttpError } from '../utils/httpError';
import { PasswordResetService } from './passwordResetService';
import { BCRYPT_ROUNDS, LOGIN_FAILED_MESSAGE } from '../constants/security';

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
    const token = this.generateToken(result.user);

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
  static async login(email: string, password: string) {
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
        throw new Error('Account is deactivated');
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
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId
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
      throw new Error('Account is deactivated');
    }

    if (!admin.tenant.isActive) {
      throw new Error('Tenant account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new Error(LOGIN_FAILED_MESSAGE);
    }

    // Generate JWT token for promo code admin
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
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
  static async marketerLogin(email: string, password: string) {
    // Приводим email к нижнему регистру для поиска
    const normalizedEmail = email.trim().toLowerCase();
    
    // Find marketer with tenant
    const marketer = await prisma.marketer.findFirst({
      where: { email: normalizedEmail },
      include: { tenant: true }
    });

    if (!marketer) {
      throw new Error(LOGIN_FAILED_MESSAGE);
    }

    if (!marketer.isActive) {
      throw new Error('Account is deactivated');
    }

    if (!marketer.tenant.isActive) {
      throw new Error('Tenant account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, marketer.password);
    if (!isPasswordValid) {
      throw new Error(LOGIN_FAILED_MESSAGE);
    }

    // Generate JWT token for marketer
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }
    
    const token = jwt.sign(
      {
        userId: marketer.id,
        email: marketer.email,
        type: 'MARKETER',
        tenantId: marketer.tenantId
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    return {
      marketer: {
        id: marketer.id,
        email: marketer.email,
        name: marketer.name,
        type: marketer.type,
        tenantId: marketer.tenantId
      },
      tenant: {
        id: marketer.tenant.id,
        name: marketer.tenant.name,
        subdomain: marketer.tenant.subdomain
      },
      token
    };
  }

  /**
   * Единый вход для всех ролей кроме клиентов (владелец/админ/тренер, маркетолог, админ промокодов, супер-админ, персонал платформы).
   */
  static async unifiedStaffLogin(email: string, password: string) {
    try {
      const result = await this.login(email, password);
      return { accountType: 'TENANT_USER' as const, ...result };
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : '';
      if (m !== LOGIN_FAILED_MESSAGE) throw e;
    }

    try {
      const result = await this.marketerLogin(email, password);
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
        throw new Error('Account is deactivated');
      }
      const isPasswordValid = await bcrypt.compare(password, superAdmin.password);
      if (!isPasswordValid) {
        throw new Error(LOGIN_FAILED_MESSAGE);
      }
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
      }
      const token = jwt.sign(
        {
          userId: superAdmin.id,
          email: superAdmin.email,
          type: 'SUPER_ADMIN',
        },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
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
        throw new Error('Account is deactivated');
      }
      const ok = await bcrypt.compare(password, staff.password);
      if (!ok) {
        throw new Error(LOGIN_FAILED_MESSAGE);
      }
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
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
    phone?: string;
    role: string;
    tenantId: string;
  }) {
    if (data.role !== 'ADMIN' && data.role !== 'TRAINER') {
      throw new Error('Role must be ADMIN or TRAINER');
    }

    const normalizedEmail = data.email.toLowerCase().trim();

    // Email уникален внутри школы
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail, tenantId: data.tenantId },
    });

    if (existingUser) {
      throw new Error('Email is already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
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
      tenantId: user.tenantId
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
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password — сбрасываем старые сессии
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword, sessionVersion: { increment: 1 } }
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Change user email
   */
  static async changeEmail(userId: string, newEmail: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Password is incorrect');
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
      throw new Error('Email already in use');
    }

    // Update email — сбрасываем подтверждение
    await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail.toLowerCase(), emailVerified: false }
    });

    return { message: 'Email changed successfully', email: newEmail.toLowerCase() };
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
  private static generateToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      sv: user.sessionVersion,
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
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
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      lastLogin: user.lastLogin,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        subdomain: user.tenant.subdomain
      },
      trainer: user.trainer
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
    },
    callerTenantId: string
  ) {
    // Get current user to check role change — только внутри школы вызывающего
    const currentUser = await prisma.user.findFirst({
      where: { id: userId, tenantId: callerTenantId },
      include: { trainer: true }
    });

    if (!currentUser) {
      throw new Error('User not found');
    }

    const updateData: any = {
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      phone: data.phone,
    };

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
        throw new Error('Email is already registered');
      }
      updateData.email = normalizedEmail;
    }

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
      updateData.sessionVersion = { increment: 1 };
    }

    // Handle role change
    if (data.role && data.role !== currentUser.role) {
      if (data.role !== 'ADMIN' && data.role !== 'TRAINER') {
        throw new HttpError(400, 'Роль может быть только ADMIN или TRAINER');
      }

      updateData.role = data.role;

      // If changing from TRAINER to ADMIN, delete trainer record
      if (currentUser.role === 'TRAINER' && data.role === 'ADMIN') {
        if (currentUser.trainer) {
          const groupCount = await prisma.group.count({
            where: { trainerId: currentUser.trainer.id }
          });
          if (groupCount > 0) {
            throw new HttpError(
              400,
              'Сначала переназначьте группы другому тренеру, затем смените роль на администратора'
            );
          }
          await prisma.trainer.delete({
            where: { id: currentUser.trainer.id }
          });
        }
      }

      // If changing from ADMIN to TRAINER, create trainer record
      if (currentUser.role === 'ADMIN' && data.role === 'TRAINER') {
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

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      phone: user.phone,
      role: user.role
    };
  }
}
