import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  listCalendarNotes,
  createCalendarNote,
  updateCalendarNote,
  deleteCalendarNote,
} from '../controllers/calendarNoteController';

const router = Router();

router.use(authenticate);
router.use(requireOwnerAdminOrTrainer);

router.get('/', listCalendarNotes);
router.post('/', createCalendarNote);
router.put('/:id', updateCalendarNote);
router.delete('/:id', deleteCalendarNote);

export default router;
