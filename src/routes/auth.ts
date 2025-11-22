import { Router } from 'express';
import {
  register,
  login,
  marketerLogin,
  promoCodeAdminLogin,
  createUser,
  getProfile,
  updateProfile,
  changePassword,
  requestPasswordReset,
  resetPassword,
  logout,
  verifyToken,
  validateRegister,
  validateLogin,
  validateMarketerLogin,
  validatePromoCodeAdminLogin,
  validateCreateUser,
  validateChangePassword,
  validateResetPassword,
  validateNewPassword,
  validateUpdateProfile
} from '../controllers/authController';
import { authenticate, requireOwnerOrAdmin } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/marketer/login', validateMarketerLogin, marketerLogin);
router.post('/promo-code-admin/login', validatePromoCodeAdminLogin, promoCodeAdminLogin);
router.post('/request-password-reset', validateResetPassword, requestPasswordReset);
router.post('/reset-password', validateNewPassword, resetPassword);

// Protected routes
router.use(authenticate); // All routes below require authentication

router.get('/profile', getProfile);
router.put('/profile', validateUpdateProfile, updateProfile);
router.post('/change-password', validateChangePassword, changePassword);
router.post('/logout', logout);
router.get('/verify', verifyToken);

// Admin/Owner only routes
router.post('/users', requireOwnerOrAdmin, validateCreateUser, createUser);

export default router;
