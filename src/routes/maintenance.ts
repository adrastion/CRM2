import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { getMaintenanceStatus } from '../services/maintenanceService';

const router = Router();

/** Публичный статус техобслуживания (без auth). */
router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
    const data = await getMaintenanceStatus();
    res.json({ success: true, data });
  })
);

export default router;
