import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse } from '../types';

/**
 * Validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        data: errorMessages
      });
      return;
    }

    next();
  };
};

/**
 * Query validation middleware factory
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    const { error } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      res.status(400).json({
        success: false,
        error: 'Query validation failed',
        data: errorMessages
      });
      return;
    }

    next();
  };
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  id: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().allow('', null),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc')
  }),
  search: Joi.object({
    search: Joi.string().optional(),
    filter: Joi.string().optional()
  })
};

/**
 * Client validation schemas
 */
export const clientSchemas = {
  create: Joi.object({
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    middleName: Joi.string().min(2).max(50).optional().allow('', null),
    email: Joi.string().email().optional().allow('', null),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().allow('', null),
    dateOfBirth: Joi.alternatives().try(
      Joi.date().max('now'),
      Joi.string().allow('', null)
    ).optional(),
    gender: Joi.string().valid('male', 'female', 'other').optional().allow('', null),
    address: Joi.string().max(500).optional().allow('', null),
    birthCertificateNumber: Joi.string().max(100).optional().allow('', null),
    medicalCertificateNumber: Joi.string().max(100).optional().allow('', null),
    schoolOrKindergarten: Joi.string().max(200).optional().allow('', null),
    photo: Joi.string().optional().allow('', null),
    weight: Joi.number().min(0).max(500).optional().allow(null),
    categoryId: commonSchemas.id.allow(null, '').optional(),
    parents: Joi.array().items(
      Joi.object({
        fullName: Joi.string().min(2).max(100).required(),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().allow('', null),
        email: Joi.string().email().optional().allow('', null),
        workplace: Joi.string().max(200).optional().allow('', null),
        workplaceContact: Joi.string().max(200).optional().allow('', null)
      })
    ).optional()
  }),
  update: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    middleName: Joi.string().min(2).max(50).optional().allow('', null),
    email: Joi.string().email().optional().allow('', null),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().allow('', null),
    dateOfBirth: Joi.alternatives().try(
      Joi.date().max('now'),
      Joi.string().allow('', null)
    ).optional(),
    gender: Joi.string().valid('male', 'female', 'other').optional().allow('', null),
    address: Joi.string().max(500).optional().allow('', null),
    birthCertificateNumber: Joi.string().max(100).optional().allow('', null),
    medicalCertificateNumber: Joi.string().max(100).optional().allow('', null),
    schoolOrKindergarten: Joi.string().max(200).optional().allow('', null),
    photo: Joi.string().optional().allow('', null),
    weight: Joi.number().min(0).max(500).optional().allow(null),
    categoryId: commonSchemas.id.allow(null, '').optional(),
    parents: Joi.array().items(
      Joi.object({
        fullName: Joi.string().min(2).max(100).required(),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().allow('', null),
        email: Joi.string().email().optional().allow('', null),
        workplace: Joi.string().max(200).optional().allow('', null),
        workplaceContact: Joi.string().max(200).optional().allow('', null)
      })
    ).optional(),
    isActive: Joi.boolean().optional()
  })
};

/**
 * Trainer validation schemas
 */
export const trainerSchemas = {
  create: Joi.object({
    userId: commonSchemas.id,
    qualification: Joi.string().max(200).optional(),
    experience: Joi.number().integer().min(0).max(50).optional(),
    specialization: Joi.string().max(200).optional(),
    salaryType: Joi.string().valid('fixed', 'percentage').required(),
    salaryAmount: Joi.number().min(0).optional()
  }),
  update: Joi.object({
    qualification: Joi.string().max(200).optional(),
    experience: Joi.number().integer().min(0).max(50).optional(),
    specialization: Joi.string().max(200).optional(),
    salaryType: Joi.string().valid('fixed', 'percentage').optional(),
    salaryAmount: Joi.number().min(0).optional(),
    isActive: Joi.boolean().optional()
  })
};

/**
 * Group validation schemas
 */
export const groupSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(500).optional(),
    maxMembers: Joi.number().integer().min(1).max(100).optional(),
    ageMin: Joi.number().integer().min(0).max(100).optional(),
    ageMax: Joi.number().integer().min(0).max(100).optional(),
    color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
    branchId: commonSchemas.id,
    trainerId: commonSchemas.id
  }),
  update: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    description: Joi.string().max(500).optional(),
    maxMembers: Joi.number().integer().min(1).max(100).optional(),
    ageMin: Joi.number().integer().min(0).max(100).optional(),
    ageMax: Joi.number().integer().min(0).max(100).optional(),
    color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
    isActive: Joi.boolean().optional()
  })
};

/**
 * Training validation schemas
 */
export const trainingSchemas = {
  create: Joi.object({
    title: Joi.string().min(2).max(200).required(),
    description: Joi.string().max(500).optional(),
    startTime: Joi.date().required(),
    endTime: Joi.date().greater(Joi.ref('startTime')).required(),
    isRecurring: Joi.boolean().default(false),
    recurrence: Joi.string().valid('daily', 'weekly', 'monthly').optional(),
    branchId: commonSchemas.id,
    groupId: commonSchemas.id,
    trainerId: commonSchemas.id
  }),
  update: Joi.object({
    title: Joi.string().min(2).max(200).optional(),
    description: Joi.string().max(500).optional(),
    startTime: Joi.date().optional(),
    endTime: Joi.date().optional(),
    isRecurring: Joi.boolean().optional(),
    recurrence: Joi.string().valid('daily', 'weekly', 'monthly').optional(),
    isCancelled: Joi.boolean().optional()
  })
};

/**
 * Payment validation schemas
 */
export const paymentSchemas = {
  create: Joi.object({
    amount: Joi.number().min(0).required(),
    type: Joi.string().valid('membership', 'single', 'penalty', 'other').required(),
    paymentMethod: Joi.string().valid('cash', 'card', 'transfer', 'other').optional(),
    notes: Joi.string().max(500).optional(),
    dueDate: Joi.date().min('now').optional(),
    clientId: commonSchemas.id,
    membershipId: commonSchemas.id.optional()
  }),
  update: Joi.object({
    amount: Joi.number().min(0).optional(),
    type: Joi.string().valid('membership', 'single', 'penalty', 'other').optional(),
    paymentMethod: Joi.string().valid('cash', 'card', 'transfer', 'other').optional(),
    notes: Joi.string().max(500).optional(),
    dueDate: Joi.date().optional(),
    status: Joi.string().valid('pending', 'paid', 'cancelled', 'refunded').optional(),
    paidAt: Joi.date().optional()
  })
};
