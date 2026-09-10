import rateLimit from 'express-rate-limit';

/**
 * Жёсткий лимит на эндпоинты входа (P1).
 * По умолчанию: 20 попыток / 15 минут с одного IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Слишком много попыток входа. Попробуйте позже.',
  },
});
