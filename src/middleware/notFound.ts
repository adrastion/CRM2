import { Request, Response } from 'express';
import { ApiResponse } from '../types';

/**
 * 404 Not Found middleware
 */
export const notFound = (req: Request, res: Response<ApiResponse>): void => {
  res.status(404).json({
    success: false,
    error: `Маршрут ${req.originalUrl} не найден`
  });
};
