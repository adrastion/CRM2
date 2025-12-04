import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ApiResponse } from '../types';

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  console.error('Error:', error);

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(error, res);
    return;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: 'Validation error: Invalid data provided'
    });
    return;
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token expired'
    });
    return;
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: error.message
    });
    return;
  }

  // Multer errors (file upload)
  if (error.name === 'MulterError') {
    handleMulterError(error, res);
    return;
  }

  // Authentication errors - проверяем сообщение об ошибке
  if (error.message === 'Аккаунт не существует' || error.message === 'Неверный пароль' || 
      error.message.toLowerCase().includes('аккаунт не существует') || 
      error.message.toLowerCase().includes('неверный пароль') ||
      error.message === 'Invalid credentials' || error.message === 'Account is deactivated' ||
      error.message === 'Tenant account is deactivated') {
    res.status(401).json({
      success: false,
      error: error.message
    });
    return;
  }

  // Default error
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message
  });
};

/**
 * Handle Prisma specific errors
 */
const handlePrismaError = (
  error: Prisma.PrismaClientKnownRequestError,
  res: Response<ApiResponse>
): void => {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      const field = error.meta?.target as string[];
      res.status(409).json({
        success: false,
        error: `A record with this ${field?.join(', ') || 'field'} already exists`
      });
      break;

    case 'P2025':
      // Record not found
      res.status(404).json({
        success: false,
        error: 'Record not found'
      });
      break;

    case 'P2003':
      // Foreign key constraint violation
      res.status(400).json({
        success: false,
        error: 'Referenced record does not exist'
      });
      break;

    case 'P2014':
      // Required relation violation
      res.status(400).json({
        success: false,
        error: 'Required relation is missing'
      });
      break;

    default:
      res.status(500).json({
        success: false,
        error: 'Database operation failed'
      });
  }
};

/**
 * Handle Multer file upload errors
 */
const handleMulterError = (
  error: any,
  res: Response<ApiResponse>
): void => {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      res.status(400).json({
        success: false,
        error: 'File size too large'
      });
      break;

    case 'LIMIT_FILE_COUNT':
      res.status(400).json({
        success: false,
        error: 'Too many files uploaded'
      });
      break;

    case 'LIMIT_UNEXPECTED_FILE':
      res.status(400).json({
        success: false,
        error: 'Unexpected file field'
      });
      break;

    default:
      res.status(400).json({
        success: false,
        error: 'File upload error'
      });
  }
};

/**
 * Async error wrapper
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
