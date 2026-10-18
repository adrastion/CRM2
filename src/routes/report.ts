import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  getDashboardStats,
  getRecentActivity,
  getUpcomingTrainings
} from '../controllers/reportController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Report routes
router.get('/dashboard', getDashboardStats);
router.get('/dashboard/activity', getRecentActivity);
router.get('/dashboard/upcoming-trainings', getUpcomingTrainings);

router.get('/revenue', requireOwnerAdminOrTrainer, (req, res) => {
  res.json({
    success: true,
    data: {},
    message: 'Отчёт по выручке успешно получен'
  });
});

router.get('/attendance', requireOwnerAdminOrTrainer, (req, res) => {
  res.json({
    success: true,
    data: {},
    message: 'Отчёт по посещаемости успешно получен'
  });
});

router.get('/trainer-salary', requireOwnerAdminOrTrainer, (req, res) => {
  res.json({
    success: true,
    data: {},
    message: 'Отчёт по зарплате тренеров успешно получен'
  });
});

export default router;
