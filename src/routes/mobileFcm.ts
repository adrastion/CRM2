import { Router } from 'express';
import { authenticateLoginActor } from '../middleware/loginActorAuth';
import { registerMobileFcm, unregisterMobileFcm } from '../controllers/mobileFcmController';

const router = Router();

router.post('/register', authenticateLoginActor, registerMobileFcm);
router.post('/unregister', authenticateLoginActor, unregisterMobileFcm);

export default router;
