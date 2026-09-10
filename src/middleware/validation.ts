import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse } from '../types';
import { normalizePhone } from '../utils/identifier';

/**
 * Телефон: принимает маскированный ввод (8 (999) 123-45-67), пишет в body +7XXXXXXXXXX.
 */
export const phoneSchema = Joi.string()
  .allow('', null)
  .optional()
  .custom((value, helpers) => {
    if (value == null || value === '') return value;
    const normalized = normalizePhone(String(value));
    if (/^\+7\d{10}$/.test(normalized)) return normalized;
    // Прочие международные E.164 после нормализации
    if (/^\+[1-9]\d{7,14}$/.test(normalized) && onlyDigitsLen(normalized) >= 8) {
      return normalized;
    }
    return helpers.error('any.invalid');
  })
  .messages({
    'any.invalid': 'Введите корректный номер телефона (например: +7 999 123-45-67 или 8 (999) 123-45-67)',
  });

function onlyDigitsLen(s: string): number {
  return (s.match(/\d/g) || []).length;
}

/**
 * Validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      convert: true,
      stripUnknown: true,
    });
    
    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      // Не логируем тело запроса целиком (пароли / PII)
      console.error('Validation error:', errorMessages.map((e) => ({ field: e.field, message: e.message })));

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        data: errorMessages
      });
      return;
    }

    // Replace req.body with validated and converted values
    req.body = value;
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
  phone: phoneSchema,
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(10000).default(10),
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
    phone: phoneSchema,
    dateOfBirth: Joi.alternatives().try(
      Joi.date().max('now'),
      Joi.string().allow('', null)
    ).optional(),
    gender: Joi.string().valid('male', 'female', 'other').optional().allow('', null),
    address: Joi.string().max(500).optional().allow('', null),
    birthCertificateNumber: Joi.string().max(100).optional().allow('', null),
    birthCertificate: Joi.string().optional().allow('', null), // data URL → диск на сервере
    medicalCertificateNumber: Joi.string().max(100).optional().allow('', null),
    medicalCertificate: Joi.string().optional().allow('', null), // data URL → диск на сервере
    schoolOrKindergarten: Joi.string().max(200).optional().allow('', null),
    photo: Joi.string().optional().allow('', null),
    weight: Joi.number().min(0).max(500).optional().allow(null),
    discipline: Joi.string().max(100).optional().allow('', null),
    weightCategory: Joi.string().max(100).optional().allow('', null),
    athleteStatus: Joi.string().valid('active', 'pause', 'injury', 'left').optional(),
    // Паспорт РФ
    passportSeries: Joi.string().pattern(/^\d{4}$/).optional().allow('', null),
    passportNumber: Joi.string().pattern(/^\d{6}$/).optional().allow('', null),
    passportIssueDate: Joi.alternatives().try(
      Joi.date().max('now'),
      Joi.string().allow('', null)
    ).optional(),
    passportIssuedBy: Joi.string().max(500).optional().allow('', null),
    passportDivisionCode: Joi.string().pattern(/^\d{3}-?\d{3}$/).optional().allow('', null),
    passportBirthPlace: Joi.string().max(500).optional().allow('', null),
    parents: Joi.array().items(
      Joi.object({
        fullName: Joi.string().min(2).max(100).required(),
        phone: phoneSchema,
        email: Joi.string().email().optional().allow('', null),
        workplace: Joi.string().max(200).optional().allow('', null),
        workplaceContact: Joi.string().max(200).optional().allow('', null),
        relationType: Joi.string().valid('mother', 'father', 'guardian', 'other').optional().allow('', null),
        isPrimaryContact: Joi.boolean().optional(),
      })
    ).optional()
  }),
  update: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    middleName: Joi.string().min(2).max(50).optional().allow('', null),
    email: Joi.string().email().optional().allow('', null),
    phone: phoneSchema,
    dateOfBirth: Joi.alternatives().try(
      Joi.date().max('now'),
      Joi.string().allow('', null)
    ).optional(),
    gender: Joi.string().valid('male', 'female', 'other').optional().allow('', null),
    address: Joi.string().max(500).optional().allow('', null),
    birthCertificateNumber: Joi.string().max(100).optional().allow('', null),
    birthCertificate: Joi.string().optional().allow('', null), // data URL → диск на сервере
    medicalCertificateNumber: Joi.string().max(100).optional().allow('', null),
    medicalCertificate: Joi.string().optional().allow('', null), // data URL → диск на сервере
    schoolOrKindergarten: Joi.string().max(200).optional().allow('', null),
    photo: Joi.string().optional().allow('', null),
    weight: Joi.number().min(0).max(500).optional().allow(null),
    discipline: Joi.string().max(100).optional().allow('', null),
    weightCategory: Joi.string().max(100).optional().allow('', null),
    athleteStatus: Joi.string().valid('active', 'pause', 'injury', 'left').optional(),
    // Паспорт РФ
    passportSeries: Joi.string().pattern(/^\d{4}$/).optional().allow('', null),
    passportNumber: Joi.string().pattern(/^\d{6}$/).optional().allow('', null),
    passportIssueDate: Joi.alternatives().try(
      Joi.date().max('now'),
      Joi.string().allow('', null)
    ).optional(),
    passportIssuedBy: Joi.string().max(500).optional().allow('', null),
    passportDivisionCode: Joi.string().pattern(/^\d{3}-?\d{3}$/).optional().allow('', null),
    passportBirthPlace: Joi.string().max(500).optional().allow('', null),
    parents: Joi.array().items(
      Joi.object({
        fullName: Joi.string().min(2).max(100).required(),
        phone: phoneSchema,
        email: Joi.string().email().optional().allow('', null),
        workplace: Joi.string().max(200).optional().allow('', null),
        workplaceContact: Joi.string().max(200).optional().allow('', null),
        relationType: Joi.string().valid('mother', 'father', 'guardian', 'other').optional().allow('', null),
        isPrimaryContact: Joi.boolean().optional(),
      })
    ).optional(),
    isActive: Joi.boolean().optional(),
    personalDiscountType: Joi.string().valid('percent', 'fixed').optional().allow(null, ''),
    personalDiscountValue: Joi.number().min(0).optional().allow(null),
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
    salaryScheme: Joi.string().valid(
      'per_training_person',
      'fixed_per_student_month',
      'percent_month',
      'fixed_monthly'
    ).optional(),
    salaryRate: Joi.number().min(0).optional(),
    salaryType: Joi.string().valid(
      'fixed',
      'percentage',
      'per_student',
      'per_training',
      'individual',
      'per_training_person',
      'fixed_per_student_month',
      'percent_month',
      'fixed_monthly'
    ).optional(),
    salaryAmount: Joi.number().min(0).optional()
  }),
  update: Joi.object({
    qualification: Joi.string().max(200).optional(),
    experience: Joi.number().integer().min(0).max(50).optional(),
    specialization: Joi.string().max(200).optional(),
    salaryScheme: Joi.string().valid(
      'per_training_person',
      'fixed_per_student_month',
      'percent_month',
      'fixed_monthly'
    ).optional(),
    salaryRate: Joi.number().min(0).optional(),
    salaryType: Joi.string().valid(
      'fixed',
      'percentage',
      'per_student',
      'per_training',
      'individual',
      'per_training_person',
      'fixed_per_student_month',
      'percent_month',
      'fixed_monthly'
    ).optional(),
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
    schedule: Joi.array().items(
      Joi.object({
        dayOfWeek: Joi.number().integer().min(0).max(6).required(),
        startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
        endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required()
      })
    ).optional(),
    branchId: commonSchemas.id,
    trainerId: commonSchemas.id,
    // Ежемесячная оплата
    isMonthlyPayment: Joi.boolean().optional(),
    monthlyPaymentAmount: Joi.number().precision(2).min(0).optional().allow(null),
    paymentDueDay: Joi.number().integer().min(1).max(31).optional().allow(null),
    // Зарплата на группе
    salaryScheme: Joi.string()
      .valid('per_training_person', 'fixed_per_student_month', 'percent_month')
      .optional()
      .allow(null, ''),
    salaryRate: Joi.number().precision(2).min(0).optional().allow(null),
    trainerSalaryType: Joi.string().valid('monthly_percentage', 'per_visit_percentage', 'per_visit_amount').optional().allow(null),
    trainerMonthlyPercentage: Joi.number().precision(2).min(0).max(100).optional().allow(null),
    trainerPerVisitPercentage: Joi.number().precision(2).min(0).max(100).optional().allow(null),
    trainerPerVisitAmount: Joi.number().precision(2).min(0).optional().allow(null),
  }),
  update: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    description: Joi.string().max(500).optional(),
    maxMembers: Joi.number().integer().min(1).max(100).optional(),
    ageMin: Joi.number().integer().min(0).max(100).optional(),
    ageMax: Joi.number().integer().min(0).max(100).optional(),
    color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
    schedule: Joi.array().items(
      Joi.object({
        dayOfWeek: Joi.number().integer().min(0).max(6).required(),
        startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
        endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required()
      })
    ).optional(),
    isActive: Joi.boolean().optional(),
    branchId: commonSchemas.id.optional(),
    trainerId: commonSchemas.id.optional(),
    // Ежемесячная оплата
    isMonthlyPayment: Joi.boolean().optional(),
    monthlyPaymentAmount: Joi.number().precision(2).min(0).optional().allow(null),
    paymentDueDay: Joi.number().integer().min(1).max(31).optional().allow(null),
    // Зарплата на группе
    salaryScheme: Joi.string()
      .valid('per_training_person', 'fixed_per_student_month', 'percent_month')
      .optional()
      .allow(null, ''),
    salaryRate: Joi.number().precision(2).min(0).optional().allow(null),
    // Legacy
    trainerSalaryType: Joi.string().valid('monthly_percentage', 'per_visit_percentage', 'per_visit_amount').optional().allow(null),
    trainerMonthlyPercentage: Joi.number().precision(2).min(0).max(100).optional().allow(null),
    trainerPerVisitPercentage: Joi.number().precision(2).min(0).max(100).optional().allow(null),
    trainerPerVisitAmount: Joi.number().precision(2).min(0).optional().allow(null)
  })
};

/**
 * Training validation schemas
 */
export const competitionSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(200).required(),
    location: Joi.string().min(2).max(200).required(),
    startDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).required(),
    endDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).required()
      .custom((value, helpers) => {
        const { startDate } = helpers.state.ancestors[0];
        if (!startDate) return value;
        
        const start = new Date(startDate);
        const end = new Date(value);
        
        if (end < start) {
          return helpers.error('date.min', { limit: startDate });
        }
        return value;
      }),
    registrationDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).required(),
    registrationTime: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null, ''),
    isElectronicRegistration: Joi.boolean().default(false),
    positionDocument: Joi.string().optional().allow('', null),
    regulationsDocument: Joi.string().optional().allow('', null),
    trainerIds: Joi.array().items(Joi.string()).min(0).optional().default([]),
    participantIds: Joi.array().items(Joi.string()).min(0).optional().default([])
  }),
  update: Joi.object({
    name: Joi.string().min(2).max(200).optional(),
    location: Joi.string().min(2).max(200).optional(),
    startDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional(),
    endDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional(),
    registrationDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional(),
    registrationTime: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null, ''),
    isElectronicRegistration: Joi.boolean().optional(),
    positionDocument: Joi.string().optional().allow('', null),
    regulationsDocument: Joi.string().optional().allow('', null),
    trainerIds: Joi.array().items(Joi.string()).min(0).optional(),
    participantIds: Joi.array().items(Joi.string()).min(0).optional()
  }),
  addResult: Joi.object({
    participantId: commonSchemas.id.required(),
    result: Joi.string().optional().allow('', null),
    resultValue: Joi.number().optional().allow(null),
    category: Joi.string().optional().allow('', null),
    performanceTime: Joi.date().optional().allow(null)
  }),
  updateResult: Joi.object({
    result: Joi.string().optional().allow('', null),
    resultValue: Joi.number().optional().allow(null),
    category: Joi.string().optional().allow('', null),
    performanceTime: Joi.date().optional().allow(null)
  }),
  updateAttendance: Joi.object({
    status: Joi.string().valid('PRESENT', 'ABSENT', 'EXCUSED').required(),
    notes: Joi.string().optional().allow('', null)
  })
};

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
