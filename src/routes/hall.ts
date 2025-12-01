import express from 'express';
import { authenticate } from '../middleware/auth';
import * as hallController from '../controllers/hallController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Hall routes
router.get('/', hallController.getHalls);
router.get('/:id', hallController.getHallById);
router.post('/', hallController.createHall);
router.put('/:id', hallController.updateHall);
router.delete('/:id', hallController.deleteHall);

export default router;

