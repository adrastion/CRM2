import { Request, Response } from 'express';
import Joi from 'joi';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { UnifiedAuthService, AccountType } from '../services/unifiedAuthService';

const ACCOUNT_TYPES: AccountType[] = [
  'TENANT_USER',
  'CLIENT',
  'PARENT',
  'MARKETER',
  'PROMO_CODE_ADMIN',
  'SUPER_ADMIN',
  'TESTER',
  'PLATFORM_STAFF',
];

const identifySchema = Joi.object({
  identifier: Joi.string().trim().min(3).max(255).required().messages({
    'string.empty': 'Введите номер телефона или email',
    'any.required': 'Введите номер телефона или email',
  }),
});

const loginSchema = Joi.object({
  identifier: Joi.string().trim().min(3).max(255).required().messages({
    'string.empty': 'Введите номер телефона или email',
    'any.required': 'Введите номер телефона или email',
  }),
  password: Joi.string().min(1).required().messages({
    'string.empty': 'Введите пароль',
    'any.required': 'Введите пароль',
  }),
  rememberMe: Joi.boolean().default(false),
});

const setupPasswordSchema = Joi.object({
  identifier: Joi.string().trim().min(3).max(255).required(),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Пароль должен содержать минимум 6 символов',
    'any.required': 'Придумайте пароль',
  }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Пароли не совпадают',
    'any.required': 'Подтвердите пароль',
  }),
  acceptTerms: Joi.boolean().valid(true).required().messages({
    'any.only': 'Необходимо принять условия соглашения',
    'any.required': 'Необходимо принять условия соглашения',
  }),
  rememberMe: Joi.boolean().default(false),
});

const selectAccountSchema = Joi.object({
  selectionToken: Joi.string().required(),
  accountType: Joi.string()
    .valid(...ACCOUNT_TYPES)
    .required(),
  accountId: Joi.string().required(),
});

/**
 * Шаг 1 единой авторизации: проверяем телефон/email и решаем,
 * куда вести пользователя — на создание пароля или на ввод пароля.
 */
export const identify = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const result = await UnifiedAuthService.identify(req.body.identifier);
  res.json({ success: true, data: result });
});

/**
 * Шаг 2а: первый вход — пользователь придумывает пароль.
 */
export const setupPassword = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { identifier, password, rememberMe } = req.body;
  const result = await UnifiedAuthService.setupPassword(identifier, password, rememberMe);
  res.json({ success: true, data: result, message: 'Пароль создан' });
});

/**
 * Шаг 2б: обычный вход по паролю.
 */
export const login = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { identifier, password, rememberMe } = req.body;
  const result = await UnifiedAuthService.login(identifier, password, rememberMe);
  res.json({ success: true, data: result });
});

/**
 * Шаг 3: пользователь выбрал организацию/роль.
 */
export const selectAccount = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { selectionToken, accountType, accountId } = req.body;
  const result = await UnifiedAuthService.selectAccount(selectionToken, accountType, accountId);
  res.json({ success: true, data: result });
});

/**
 * Актуальные linked-сессии SA/Tester для текущего школьного пользователя.
 */
export const getLinkedSessions = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const result = await UnifiedAuthService.getLinkedSessionsForUser(userId);
  res.json({ success: true, data: result });
});

export const validateIdentify = validate(identifySchema);
export const validateUnifiedLogin = validate(loginSchema);
export const validateSetupPassword = validate(setupPasswordSchema);
export const validateSelectAccount = validate(selectAccountSchema);
