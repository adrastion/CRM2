import { Router } from 'express';
import { globalSearch } from '../controllers/searchController';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', requireOwnerAdminOrTrainer, globalSearch);

export default router;
