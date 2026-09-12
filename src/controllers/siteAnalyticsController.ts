import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import {
  pingSiteVisit,
  getLiveTraffic,
  getTrafficSummary,
  getQuietHours,
  SummaryRange,
} from '../services/siteAnalyticsService';

const RANGES = new Set<SummaryRange>(['day', 'month', 'quarter', 'year']);

export const postSiteAnalyticsPing = asyncHandler(async (req: Request, res: Response) => {
  const visitorId = String(req.body?.visitorId || '');
  const path = req.body?.path != null ? String(req.body.path) : null;
  const actorHint = req.body?.actorHint != null ? String(req.body.actorHint) : null;
  const closing = Boolean(req.body?.closing);

  try {
    const data = await pingSiteVisit({ visitorId, path, actorHint, closing });
    res.json({ success: true, data });
  } catch (e: any) {
    if (e?.statusCode === 400) {
      res.status(400).json({ success: false, error: e.message || 'Bad request' });
      return;
    }
    throw e;
  }
});

export const getSiteTrafficLive = asyncHandler(
  async (_req: Request, res: Response<ApiResponse>) => {
    const data = await getLiveTraffic();
    res.json({ success: true, data });
  }
);

export const getSiteTrafficSummary = asyncHandler(
  async (req: Request, res: Response<ApiResponse>) => {
    const rangeRaw = String(req.query.range || 'day').toLowerCase() as SummaryRange;
    const range = RANGES.has(rangeRaw) ? rangeRaw : 'day';
    const data = await getTrafficSummary(range);
    res.json({ success: true, data });
  }
);

export const getSiteTrafficQuietHours = asyncHandler(
  async (req: Request, res: Response<ApiResponse>) => {
    const days = Number(req.query.days) || 30;
    const data = await getQuietHours(days);
    res.json({ success: true, data });
  }
);
