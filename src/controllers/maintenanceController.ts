import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getMaintenanceStatus,
  setMaintenanceMode,
} from '../services/maintenanceService';

export const getAdminMaintenance = asyncHandler(
  async (_req: Request, res: Response<ApiResponse>) => {
    const data = await getMaintenanceStatus();
    res.json({ success: true, data });
  }
);

export const updateAdminMaintenance = asyncHandler(
  async (req: Request, res: Response<ApiResponse>) => {
    if (typeof req.body?.enabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'enabled (boolean) required' });
      return;
    }
    const data = await setMaintenanceMode(req.body.enabled);
    res.json({ success: true, data });
  }
);
