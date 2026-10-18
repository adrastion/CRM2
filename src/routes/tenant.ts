import { Router } from 'express';
import { authenticate, requireOwnerOrAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Tenant management routes
router.get('/profile', requireOwnerOrAdmin, (req: any, res) => {
  res.json({
    success: true,
    data: req.tenant,
    message: 'Профиль организации успешно получен'
  });
});

router.put('/profile', requireOwnerOrAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Профиль организации успешно обновлён'
  });
});

export default router;
