import { Request, Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AuthService } from '../services/authService';
import { asyncHandler } from '../middleware/errorHandler';
import { validate, validateQuery } from '../middleware/validation';
import Joi from 'joi';

// Validation schemas
const registerSchema = Joi.object({
  tenantName: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const marketerLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const promoCodeAdminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  role: Joi.string().valid('ADMIN', 'TRAINER').required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

const newPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
});

const changeEmailSchema = Joi.object({
  newEmail: Joi.string().email().required().messages({
    'string.email': 'Некорректный формат email',
    'any.required': 'Новый email обязателен'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Пароль обязателен для подтверждения'
  })
});

/**
 * Register a new tenant and owner
 */
export const register = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const result = await AuthService.registerTenant(req.body);
  
  res.status(201).json({
    success: true,
    data: result,
    message: 'Tenant registered successfully'
  });
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { email, password } = req.body;
  const result = await AuthService.login(email, password);
  
  res.json({
    success: true,
    data: result,
    message: 'Login successful'
  });
  return;
});

/**
 * Login marketer
 */
export const marketerLogin = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { email, password } = req.body;
  const result = await AuthService.marketerLogin(email, password);
  
  res.json({
    success: true,
    data: result,
    message: 'Marketer login successful'
  });
  return;
});

/**
 * Login promo code admin
 */
export const promoCodeAdminLogin = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { email, password } = req.body;
  const result = await AuthService.promoCodeAdminLogin(email, password);
  
  res.json({
    success: true,
    data: result,
    message: 'Promo code admin login successful'
  });
  return;
});

/**
 * Create a new user (admin or trainer)
 */
export const createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.tenantId) {
    res.status(400).json({
      success: false,
      error: 'Требуется ID тенанта'
    });
    return;
  }

  const userData = {
    ...req.body,
    tenantId: req.tenantId
  };

  const result = await AuthService.createUser(userData);
  
  res.status(201).json({
    success: true,
    data: result,
    message: 'User created successfully'
  });
  return;
});

/**
 * Get current user profile
 */
export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Пользователь не аутентифицирован'
    });
    return;
  }

  const profile = await AuthService.getUserProfile(req.user.id);
  
  res.json({
    success: true,
    data: profile
  });
  return;
});

/**
 * Update user profile
 */
export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Пользователь не аутентифицирован'
    });
    return;
  }

  const result = await AuthService.updateUserProfile(req.user.id, req.body);
  
  res.json({
    success: true,
    data: result,
    message: 'Profile updated successfully'
  });
  return;
});

/**
 * Update user by ID (owner only)
 */
export const updateUserById = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Пользователь не аутентифицирован'
    });
    return;
  }

  // Only owner can update users
  if (req.user.role !== 'OWNER') {
    res.status(403).json({
      success: false,
      error: 'Доступ запрещен. Только владелец может обновлять пользователей'
    });
    return;
  }

  const { id } = req.params;
  const updateData = {
    ...req.body,
    tenantId: req.tenantId // Добавляем tenantId для создания Trainer при смене роли
  };
  const result = await AuthService.updateUserById(id, updateData);
  
  res.json({
    success: true,
    data: result,
    message: 'User updated successfully'
  });
  return;
});

/**
 * Change user password
 */
export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Пользователь не аутентифицирован'
    });
    return;
  }

  const { currentPassword, newPassword } = req.body;
  const result = await AuthService.changePassword(req.user.id, currentPassword, newPassword);
  
  res.json({
    success: true,
    data: result
  });
  return;
});

/**
 * Change user email
 */
export const changeEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Пользователь не аутентифицирован'
    });
    return;
  }

  const { newEmail, password } = req.body;
  const result = await AuthService.changeEmail(req.user.id, newEmail, password);
  
  res.json({
    success: true,
    data: result,
    message: 'Email успешно изменен'
  });
  return;
});

/**
 * Request password reset
 */
export const requestPasswordReset = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { email } = req.body;
  const result = await AuthService.requestPasswordReset(email);
  
  res.json({
    success: true,
    data: result
  });
  return;
});

/**
 * Reset password with token
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { token, newPassword } = req.body;
  const result = await AuthService.resetPassword(token, newPassword);
  
  res.json({
    success: true,
    data: result
  });
  return;
});

/**
 * Logout user (client-side token removal)
 */
export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
  return;
});

/**
 * Verify token validity
 */
export const verifyToken = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Неверный токен'
    });
    return;
  }

  res.json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        tenantId: req.user.tenantId
      },
      tenant: req.tenant
    }
  });
  return;
});

// Export validation middleware
export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateMarketerLogin = validate(marketerLoginSchema);
export const validatePromoCodeAdminLogin = validate(promoCodeAdminLoginSchema);
export const validateCreateUser = validate(createUserSchema);
export const validateChangePassword = validate(changePasswordSchema);
export const validateChangeEmail = validate(changeEmailSchema);
export const validateResetPassword = validate(resetPasswordSchema);
export const validateNewPassword = validate(newPasswordSchema);
export const validateUpdateProfile = validate(updateProfileSchema);
