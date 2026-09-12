import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  listStaffNotes,
  createStaffNote,
  updateStaffNote,
  deleteStaffNote,
} from '../controllers/staffNoteController';
import {
  listStaffTasks,
  listStaffUsers,
  createStaffTask,
  updateStaffTask,
  updateStaffTaskStatus,
  deleteStaffTask,
  ensureStaffTaskChat,
} from '../controllers/staffTaskController';

const router = Router();

router.use(authenticate);
router.use(requireOwnerAdminOrTrainer);

router.get('/notes', listStaffNotes);
router.post('/notes', createStaffNote);
router.put('/notes/:id', updateStaffNote);
router.delete('/notes/:id', deleteStaffNote);

router.get('/users', listStaffUsers);
router.get('/tasks', listStaffTasks);
router.post('/tasks', createStaffTask);
router.put('/tasks/:id', updateStaffTask);
router.patch('/tasks/:id/status', updateStaffTaskStatus);
router.delete('/tasks/:id', deleteStaffTask);
router.post('/tasks/:id/chat', ensureStaffTaskChat);

export default router;
