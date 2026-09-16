import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { MarketerCabinetService } from '../services/marketerCabinetService';
import { badRequest } from '../utils/httpError';
import { prisma } from '../lib/prisma';

function requireMarketerId(req: AuthenticatedRequest): string {
  const id = (req as any).marketer?.id;
  if (!id) throw badRequest('Marketer auth required');
  return String(id);
}

function parseDate(v: unknown): Date | undefined {
  if (typeof v !== 'string' || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const getMarketerDashboard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.getDashboard(requireMarketerId(req));
    res.json({ success: true, data });
  }
);

export const listMarketerClients = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.listClients(requireMarketerId(req));
    res.json({ success: true, data });
  }
);

export const getMarketerClientCard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.getClientCard(
      requireMarketerId(req),
      String(req.params.id)
    );
    res.json({ success: true, data });
  }
);

export const createMarketerLead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.createLead(requireMarketerId(req), req.body || {});
    res.status(201).json({ success: true, data });
  }
);

export const updateMarketerLead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.updateLead(
      requireMarketerId(req),
      String(req.params.id),
      req.body || {}
    );
    res.json({ success: true, data });
  }
);

export const claimMarketerClient = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.claimClient(
      requireMarketerId(req),
      String(req.body?.code || '')
    );
    res.json({ success: true, data });
  }
);

export const listMarketerTasks = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.listTasks(requireMarketerId(req), {
      leadId: typeof req.query.leadId === 'string' ? req.query.leadId : undefined,
      tenantId: typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      from: parseDate(req.query.from),
      to: parseDate(req.query.to),
    });
    res.json({ success: true, data });
  }
);

export const createMarketerTask = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.createTask(requireMarketerId(req), req.body || {});
    res.status(201).json({ success: true, data });
  }
);

export const updateMarketerTask = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.updateTask(
      requireMarketerId(req),
      String(req.params.id),
      req.body || {}
    );
    res.json({ success: true, data });
  }
);

export const listMarketerChats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.listChats(requireMarketerId(req));
    res.json({ success: true, data });
  }
);

export const ensureMarketerChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const channel = String(req.params.channel || '').toUpperCase();
    const data = await MarketerCabinetService.ensureChat(requireMarketerId(req), channel);
    res.json({ success: true, data });
  }
);

export const listMarketerChatMessages = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.listChatMessages(
      requireMarketerId(req),
      String(req.params.threadId)
    );
    res.json({ success: true, data });
  }
);

export const postMarketerChatMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.postChatMessage(
      requireMarketerId(req),
      String(req.params.threadId),
      String(req.body?.body || '')
    );
    res.status(201).json({ success: true, data });
  }
);

export const getMarketerFinance = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.getFinance(requireMarketerId(req));
    res.json({ success: true, data });
  }
);

export const listMarketerPublications = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.listPublications();
    res.json({ success: true, data });
  }
);

export const listMarketerClosingDocs = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.listClosingDocs(requireMarketerId(req));
    res.json({ success: true, data });
  }
);

export const downloadMarketerPublicationImage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    requireMarketerId(req);
    const pub = await prisma.platformPublication.findFirst({
      where: { id: String(req.params.id), isActive: true },
    });
    if (!pub?.imageUrl) {
      res.status(404).json({ success: false, error: 'Изображение не найдено' });
      return;
    }
    const { isHttpUrl, isStoredUploadPath, sendStoredUpload } = await import('../utils/marketerCabinetFiles');
    if (isHttpUrl(pub.imageUrl)) {
      res.redirect(pub.imageUrl);
      return;
    }
    if (!isStoredUploadPath(pub.imageUrl)) {
      res.status(404).json({ success: false, error: 'Некорректный путь' });
      return;
    }
    sendStoredUpload(res, pub.imageUrl, { inline: true });
  }
);

export const downloadMarketerPublicationFile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    requireMarketerId(req);
    const pub = await prisma.platformPublication.findFirst({
      where: { id: String(req.params.id), isActive: true },
    });
    if (!pub?.fileUrl) {
      res.status(404).json({ success: false, error: 'Файл не найден' });
      return;
    }
    const { isHttpUrl, isStoredUploadPath, sendStoredUpload } = await import('../utils/marketerCabinetFiles');
    if (isHttpUrl(pub.fileUrl)) {
      res.redirect(pub.fileUrl);
      return;
    }
    if (!isStoredUploadPath(pub.fileUrl)) {
      res.status(404).json({ success: false, error: 'Некорректный путь' });
      return;
    }
    sendStoredUpload(res, pub.fileUrl);
  }
);

export const downloadMarketerClosingDoc = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const marketerId = requireMarketerId(req);
    const doc = await prisma.marketerClosingDoc.findFirst({
      where: {
        id: String(req.params.id),
        OR: [{ marketerId }, { marketerId: null }],
      },
    });
    if (!doc?.fileUrl) {
      res.status(404).json({ success: false, error: 'Файл не найден' });
      return;
    }
    const { isHttpUrl, isStoredUploadPath, sendStoredUpload } = await import('../utils/marketerCabinetFiles');
    if (isHttpUrl(doc.fileUrl)) {
      res.redirect(doc.fileUrl);
      return;
    }
    if (!isStoredUploadPath(doc.fileUrl)) {
      res.status(404).json({ success: false, error: 'Некорректный путь' });
      return;
    }
    sendStoredUpload(res, doc.fileUrl);
  }
);
