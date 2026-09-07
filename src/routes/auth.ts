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

const router = Router();

// Единая авторизация: один идентификатор (телефон ИЛИ email) для всех ролей
router.post('/identify', validateIdentify, identify);
router.post('/setup-password', validateSetupPassword, setupPassword);
router.post('/unified-login', validateUnifiedLogin, unifiedLogin);
router.post('/select-account', validateSelectAccount, selectAccount);

// Public routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/unified-staff-login', validateLogin, unifiedStaffLogin);
router.post('/marketer/login', validateMarketerLogin, marketerLogin);
router.post('/promo-code-admin/login', validatePromoCodeAdminLogin, promoCodeAdminLogin);

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
router.put('/profile', validateUpdateProfile, updateProfile);
router.post('/change-password', validateChangePassword, changePassword);
router.post('/change-email', validateChangeEmail, changeEmail);
router.post('/logout', logout);
router.get('/verify', verifyToken);

router.post('/users', requireOwnerOrAdmin, validateCreateUser, createUser);
router.put('/users/:id', requireOwner, updateUserById);
router.delete('/users/:id', requireOwner, deleteUser);

export default router;
