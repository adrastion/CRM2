import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  getCompetitions,
  getCompetitionById,
  createCompetition,
  updateCompetition,
  deleteCompetition,
  addCompetitionResult,
  updateCompetitionResult,
  deleteCompetitionResult,
  updateCompetitionAttendance,
  getTrainerConflicts
} from '../controllers/competitionController';
import { validate, competitionSchemas } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Competition management routes
router.get('/', getCompetitions);
router.get('/:id', getCompetitionById);
router.post('/', requireOwnerAdminOrTrainer, validate(competitionSchemas.create), createCompetition);
router.put('/:id', requireOwnerAdminOrTrainer, validate(competitionSchemas.update), updateCompetition);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteCompetition);

// Competition results routes
router.post('/:competitionId/results', requireOwnerAdminOrTrainer, validate(competitionSchemas.addResult), addCompetitionResult);
router.put('/results/:id', requireOwnerAdminOrTrainer, validate(competitionSchemas.updateResult), updateCompetitionResult);
router.delete('/results/:id', requireOwnerAdminOrTrainer, deleteCompetitionResult);

// Competition attendance routes
router.put('/:competitionId/attendance/:participantId', requireOwnerAdminOrTrainer, validate(competitionSchemas.updateAttendance), updateCompetitionAttendance);

// Trainer conflicts route
router.get('/:competitionId/trainer-conflicts', getTrainerConflicts);

export default router;


