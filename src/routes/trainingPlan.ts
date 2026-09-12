import { Router } from 'express';
import { authenticate, requireOwnerOrTrainer } from '../middleware/auth';
import {
  listExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  exerciseMediaUpload,
  uploadExerciseMedia,
  deleteExerciseMedia,
  getExerciseMediaFile,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listAccessibleGroups,
  listCycles,
  createCycle,
  getCycle,
  previewCycleDraft,
  deleteCycle,
  getSessionPlanByTraining,
  upsertSessionPlan,
  applyTemplateToSession,
} from '../controllers/trainingPlanController';

const router = Router();
router.use(authenticate);
router.use(requireOwnerOrTrainer);

router.get('/groups', listAccessibleGroups);

router.get('/exercises', listExercises);
router.post('/exercises', createExercise);
router.put('/exercises/:id', updateExercise);
router.delete('/exercises/:id', deleteExercise);
router.post(
  '/exercises/:id/media',
  (req, res, next) => {
    exerciseMediaUpload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, error: err.message || 'Upload failed' });
        return;
      }
      next();
    });
  },
  uploadExerciseMedia
);
router.delete('/exercises/:id/media/:mediaId', deleteExerciseMedia);
router.get('/media/:mediaId', getExerciseMediaFile);

router.get('/templates', listTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

router.get('/cycles', listCycles);
router.post('/cycles', createCycle);
router.post('/cycles/preview', previewCycleDraft);
router.get('/cycles/:id', getCycle);
router.delete('/cycles/:id', deleteCycle);

router.get('/session-plans/by-training/:trainingId', getSessionPlanByTraining);
router.put('/session-plans/:trainingId', upsertSessionPlan);
router.post('/session-plans/:trainingId/apply-template', applyTemplateToSession);

export default router;
