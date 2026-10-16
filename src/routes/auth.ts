import { Router } from 'express';
import {
  register,
  login,
  unifiedStaffLogin,
  marketerLogin,
  promoCodeAdminLogin,
  createUser,
  getProfile,
  updateProfile,
  updateUserById,
  deleteUser,
  changePassword,
  changeEmail,
  requestPasswordReset,
  logout,
  getAuthSessions,
  revokeAuthSession,
  revokeOtherAuthSessionsHandler,
  revokeAllAuthSessionsHandler,
  verifyToken,
  validateRegister,
  validateLogin,
  validateMarketerLogin,
  validatePromoCodeAdminLogin,
  validateCreateUser,
  validateChangePassword,
  validateChangeEmail,
  validateResetPassword,
  validateUpdateProfile
} from '../controllers/authController';
import {
  identify,
  setupPassword,
  login as unifiedLogin,
  selectAccount,
  getLinkedSessions,
  validateIdentify,
  validateUnifiedLogin,
  validateSetupPassword,
  validateSelectAccount
} from '../controllers/unifiedAuthController';
import {
  requestPasswordResetCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  sendEmailVerification,
  verifyEmailCode,
  legacyResetPasswordUnavailable,
  validatePasswordResetRequest,
  validatePasswordResetVerify,
  validatePasswordResetConfirm,
  validateEmailVerifyCode,
} from '../controllers/emailAuthController';
import { authenticate, requireOwnerOrAdmin, requireOwner } from '../middleware/auth';
import { loginRateLimiter } from '../middleware/loginRateLimit';
import { ensureCsrfCookie } from '../middleware/authCookies';
import { registerMarketer } from '../controllers/marketerController';
import { getSavedAccountsUnread } from '../controllers/inboxNotificationController';
import {
  emailLoginRequest,
  emailLoginVerify,
  email2faVerify,
  pushLoginRequest,
  pushLoginVerify,
  qrLoginStart,
  qrLoginStatus,
  qrLoginApprove,
  qrLoginDeny,
  getLoginSecurity,
  updateLoginSecurity,
  validateLoginIdentifier,
  validateLoginCode,
  validateQrApprove,
} from '../controllers/loginChallengeController';
import { authenticateLoginActor } from '../middleware/loginActorAuth';

const router = Router();

router.get('/csrf', ensureCsrfCookie);

// Единая авторизация: один идентификатор (телефон ИЛИ email) для всех ролей
router.post('/identify', loginRateLimiter, validateIdentify, identify);
router.post('/setup-password', loginRateLimiter, validateSetupPassword, setupPassword);
router.post('/unified-login', loginRateLimiter, validateUnifiedLogin, unifiedLogin);
router.post('/select-account', loginRateLimiter, validateSelectAccount, selectAccount);

// Быстрый вход / 2FA
router.post('/login/email/request', loginRateLimiter, validateLoginIdentifier, emailLoginRequest);
router.post('/login/email/verify', loginRateLimiter, validateLoginCode, emailLoginVerify);
router.post('/login/2fa/verify', loginRateLimiter, validateLoginCode, email2faVerify);
router.post('/login/push/request', loginRateLimiter, validateLoginIdentifier, pushLoginRequest);
router.post('/login/push/verify', loginRateLimiter, validateLoginCode, pushLoginVerify);
router.post('/login/qr/start', loginRateLimiter, validateLoginIdentifier, qrLoginStart);
router.get('/login/qr/status', loginRateLimiter, qrLoginStatus);
router.post('/login/qr/approve', authenticateLoginActor, validateQrApprove, qrLoginApprove);
router.post('/login/qr/deny', authenticateLoginActor, validateQrApprove, qrLoginDeny);
router.get('/security', authenticateLoginActor, getLoginSecurity);
router.put('/security', authenticateLoginActor, updateLoginSecurity);

// Public routes
router.post('/register', validateRegister, register);
router.post('/login', loginRateLimiter, validateLogin, login);
router.post('/unified-staff-login', loginRateLimiter, validateLogin, unifiedStaffLogin);
router.post('/marketer/register', loginRateLimiter, registerMarketer);
router.post('/marketer/login', loginRateLimiter, validateMarketerLogin, marketerLogin);
router.post(
  '/promo-code-admin/login',
  loginRateLimiter,
  validatePromoCodeAdminLogin,
  promoCodeAdminLogin
);

/** Batch unread по токенам savedAccounts (каждый JWT сам за себя). */
router.post('/saved-accounts/unread', loginRateLimiter, getSavedAccountsUnread);

// Сброс пароля по коду (User / Client / Parent)
router.post('/password-reset/request', validatePasswordResetRequest, requestPasswordResetCode);
router.post('/password-reset/verify-code', validatePasswordResetVerify, verifyPasswordResetCode);
router.post('/password-reset/confirm', validatePasswordResetConfirm, confirmPasswordReset);
// Совместимость со старыми клиентами
router.post('/request-password-reset', validateResetPassword, requestPasswordReset);
router.post('/reset-password', legacyResetPasswordUnavailable);

// Подтверждение email (staff JWT или client/parent token)
router.post('/email/send-verification', sendEmailVerification);
router.post('/email/verify', validateEmailVerifyCode, verifyEmailCode);

// Protected routes
router.use(authenticate);

router.get('/profile', getProfile);
router.get('/linked-sessions', getLinkedSessions);
router.put('/profile', validateUpdateProfile, updateProfile);
router.post('/change-password', validateChangePassword, changePassword);
router.post('/change-email', validateChangeEmail, changeEmail);
router.post('/logout', logout);
router.get('/sessions', getAuthSessions);
router.delete('/sessions/others', revokeOtherAuthSessionsHandler);
router.delete('/sessions', revokeAllAuthSessionsHandler);
router.delete('/sessions/:id', revokeAuthSession);
router.get('/verify', verifyToken);

router.post('/users', requireOwnerOrAdmin, validateCreateUser, createUser);
router.put('/users/:id', requireOwner, updateUserById);
router.delete('/users/:id', requireOwner, deleteUser);

export default router;
