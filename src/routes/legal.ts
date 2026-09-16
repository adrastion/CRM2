import { Router } from 'express';
import { getPublicTerms, getPublicPrivacy } from '../controllers/maintenanceController';

const router = Router();

router.get('/terms', getPublicTerms);
router.get('/privacy', getPublicPrivacy);

export default router;
