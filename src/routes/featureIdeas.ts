import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  attachIdeaActorFromSchool,
  createFeatureIdea,
  listMyFeatureIdeas,
} from '../controllers/clientFeatureIdeaController';

const router = Router();

router.get('/', authenticate, attachIdeaActorFromSchool, listMyFeatureIdeas);
router.post('/', authenticate, attachIdeaActorFromSchool, createFeatureIdea);

export default router;
