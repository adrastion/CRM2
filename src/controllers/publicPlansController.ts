import { Response } from 'express';
import { Request } from 'express';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { PlanCatalogService } from '../services/planCatalogService';

/**
 * Публичный список тарифов для страницы /pricing.
 *
 * Отдаются только активные и публичные тарифы: индивидуальные
 * (`isPublic: false`) выдаются вручную и на странице не показываются.
 */
export const getPublicPlans = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const plans = await PlanCatalogService.listPublic();

  res.json({
    success: true,
    data: plans.map((plan) => ({
      code: plan.code,
      planType: plan.code, // совместимость с существующим интерфейсом
      name: plan.name,
      description: plan.description,
      price: plan.price,
      /** true — «Цена договорная». */
      isNegotiable: plan.isNegotiable,
      limits: plan.limits,
      supportLevel: plan.supportLevel,
      sortOrder: plan.sortOrder,
    })),
  });
});
