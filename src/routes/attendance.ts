import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  getAttendances,
  getAttendanceById,
  getAttendancesByTraining,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  bulkUpdateAttendance,
  exportAttendanceExcel,
} from '../controllers/attendanceController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Attendance management routes
router.get('/', getAttendances);
router.get('/export/excel', requireOwnerAdminOrTrainer, exportAttendanceExcel);
router.get('/training/:trainingId', getAttendancesByTraining);
router.get('/:id', getAttendanceById);
router.post('/', requireOwnerAdminOrTrainer, createAttendance);
router.post('/bulk', requireOwnerAdminOrTrainer, bulkUpdateAttendance);
router.put('/:id', requireOwnerAdminOrTrainer, updateAttendance);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteAttendance);

export default router;
