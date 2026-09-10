import { prisma } from '../lib/prisma';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { BCRYPT_ROUNDS, LOGIN_FAILED_MESSAGE } from '../constants/security';
import { maybeSetAuthCookies } from '../middleware/authCookies';

export const platformStaffLogin = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }
  const staff = await prisma.platformStaffUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!staff || !staff.isActive) {
    res.status(401).json({ success: false, error: LOGIN_FAILED_MESSAGE });
    return;
  }
  const ok = await bcrypt.compare(password, staff.password);
  if (!ok) {
    res.status(401).json({ success: false, error: LOGIN_FAILED_MESSAGE });
    return;
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ success: false, error: 'JWT_SECRET is not configured' });
    return;
  }
  const token = jwt.sign(
    { userId: staff.id, email: staff.email, type: 'PLATFORM_STAFF', role: staff.role },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
  await prisma.platformStaffUser.update({
    where: { id: staff.id },
    data: { lastLogin: new Date() },
  });
  maybeSetAuthCookies(res, { token });
  res.json({
    success: true,
    data: {
      token,
      staff: {
        id: staff.id,
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role,
        mustChangePassword: (staff as any).mustChangePassword ?? false,
      },
    },
  });
});

export const platformStaffChangePassword = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const staff = req.platformStaff as any;
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, error: 'currentPassword and newPassword are required' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    return;
  }
  const ok = await bcrypt.compare(currentPassword, staff.password);
  if (!ok) {
    res.status(401).json({ success: false, error: 'Неверный пароль' });
    return;
  }
  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.platformStaffUser.update({
    where: { id: staff.id },
    data: {
      password: hashed,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    } as any,
  });
  res.json({ success: true, data: {} });
});
