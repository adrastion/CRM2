import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const prisma = new PrismaClient();

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
  });

  if (!superAdmin) {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
    return;
  }

  if (!superAdmin.isActive) {
    res.status(401).json({
      success: false,
      error: 'Account is deactivated'
    });
    return;
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, superAdmin.password);
  if (!isPasswordValid) {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
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
  
  const token = jwt.sign(
    {
      userId: superAdmin.id,
      email: superAdmin.email,
      type: 'SUPER_ADMIN',
    },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  // Update last login
  await prisma.superAdmin.update({
    where: { id: superAdmin.id },
    data: { lastLogin: new Date() },
  });

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
    },
  });
});

