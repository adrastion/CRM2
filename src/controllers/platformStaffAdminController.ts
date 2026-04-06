import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const prisma = new PrismaClient();

function generateOneTimePassword(): string {
  // 12 chars base64url without ambiguous symbols is overkill; keep readable but random
  return crypto.randomBytes(9).toString('base64url');
}

export const superAdminCreatePlatformStaffUser = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { email, role, firstName, lastName } = req.body as {
    email?: string;
    role?: 'SUPPORT' | 'DESIGNER' | 'SECURITY';
    firstName?: string;
    lastName?: string;
  };

  if (!email || !role || !firstName || !lastName) {
    res.status(400).json({ success: false, error: 'email, role, firstName, lastName are required' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail.includes('@')) {
    res.status(400).json({ success: false, error: 'Invalid email' });
    return;
  }
  if (!['SUPPORT', 'DESIGNER', 'SECURITY'].includes(role)) {
    res.status(400).json({ success: false, error: 'Invalid role' });
    return;
  }

  const existing = await prisma.platformStaffUser.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    res.status(409).json({ success: false, error: 'User with this email already exists' });
    return;
  }

  const oneTimePassword = generateOneTimePassword();
  const hashed = await bcrypt.hash(oneTimePassword, 12);

  const created = await prisma.platformStaffUser.create({
    data: {
      email: normalizedEmail,
      password: hashed,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      isActive: true,
      mustChangePassword: true,
      passwordChangedAt: null,
    } as any,
  });

  res.status(201).json({
    success: true,
    data: {
      staff: {
        id: created.id,
        email: created.email,
        firstName: created.firstName,
        lastName: created.lastName,
        role: created.role,
      },
      oneTimePassword,
    },
  });
});

