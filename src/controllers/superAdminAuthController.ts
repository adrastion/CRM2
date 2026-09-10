import { prisma } from '../lib/prisma';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { BCRYPT_ROUNDS, LOGIN_FAILED_MESSAGE } from '../constants/security';
import { maybeSetAuthCookies } from '../middleware/authCookies';

/**
 * Login super admin
 */
export const superAdminLogin = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
    return;
  }

  // Find super admin
  const superAdmin = await prisma.superAdmin.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { linkedUser: { include: { tenant: true } } },
  });

  if (!superAdmin) {
    res.status(401).json({
      success: false,
      error: LOGIN_FAILED_MESSAGE
    });
    return;
  }

  if (!superAdmin.isActive) {
    res.status(401).json({
      success: false,
      error: 'Аккаунт деактивирован'
    });
    return;
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, superAdmin.password);
  if (!isPasswordValid) {
    res.status(401).json({
      success: false,
      error: LOGIN_FAILED_MESSAGE
    });
    return;
  }

  // Generate JWT token
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({
      success: false,
      error: 'JWT_SECRET is not configured'
    });
    return;
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const sign = (payload: object) =>
    jwt.sign(payload, jwtSecret, { expiresIn } as jwt.SignOptions);

  const token = sign({
    userId: superAdmin.id,
    email: superAdmin.email,
    type: 'SUPER_ADMIN',
    sv: superAdmin.sessionVersion,
  });

  // Update last login
  await prisma.superAdmin.update({
    where: { id: superAdmin.id },
    data: { lastLogin: new Date() },
  });

  let linkedSession: Record<string, unknown> | undefined;
  const user = superAdmin.linkedUser;
  if (user && user.isActive) {
    linkedSession = {
      accountType: 'TENANT_USER',
      token: sign({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      }),
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        subdomain: user.tenant.subdomain,
      },
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        phone: user.phone,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  maybeSetAuthCookies(res, { token });
  res.json({
    success: true,
    data: {
      superAdmin: {
        id: superAdmin.id,
        email: superAdmin.email,
        firstName: superAdmin.firstName,
        lastName: superAdmin.lastName,
      },
      token,
      ...(linkedSession ? { linkedSession } : {}),
    },
  });
});
