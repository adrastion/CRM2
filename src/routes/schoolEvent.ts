import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  getSchoolEvents,
  getSchoolEventById,
  createSchoolEvent,
  updateSchoolEvent,
  deleteSchoolEvent,
} from '../controllers/schoolEventController';

const router = Router();

router.use(authenticate);

router.get('/', getSchoolEvents);
router.get('/:id', getSchoolEventById);
router.post('/', requireOwnerAdminOrTrainer, createSchoolEvent);
router.put('/:id', requireOwnerAdminOrTrainer, updateSchoolEvent);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteSchoolEvent);

export default router;
