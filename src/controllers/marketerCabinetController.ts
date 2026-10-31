import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { MarketerCabinetService } from '../services/marketerCabinetService';
import { AuthService } from '../services/authService';
import { badRequest } from '../utils/httpError';
import { prisma } from '../lib/prisma';

function requireMarketerId(req: AuthenticatedRequest): string {
  const id = (req as any).marketer?.id;
  if (!id) throw badRequest('Требуется авторизация маркетолога');
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

export const getMarketerTeam = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.getTeam(requireMarketerId(req));
    res.json({ success: true, data });
  }
);

export const getMarketerActivity = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.getActivity(requireMarketerId(req));
    res.json({ success: true, data });
  }
);

export const getMarketerProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { MarketerProfileService } = await import('../services/marketerProfileService');
    const data = await MarketerProfileService.getProfile(requireMarketerId(req));
    res.json({ success: true, data });
  }
);

export const updateMarketerProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { MarketerProfileService } = await import('../services/marketerProfileService');
    const data = await MarketerProfileService.updateProfile(requireMarketerId(req), req.body || {});
    res.json({ success: true, data });
  }
);

export const getMarketerOnboarding = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { MarketerProfileService } = await import('../services/marketerProfileService');
    const data = await MarketerProfileService.getOnboarding(requireMarketerId(req));
    res.json({ success: true, data });
  }
);

export const acceptMarketerOnboarding = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { MarketerProfileService } = await import('../services/marketerProfileService');
    const data = await MarketerProfileService.acceptOnboarding(requireMarketerId(req), req.body || {});
    res.json({ success: true, data });
  }
);

export const getMarketerInvite = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.getInviteInfo(requireMarketerId(req));
    res.json({ success: true, data });
  }
);

export const resolveMarketerInvitePublic = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const data = await MarketerCabinetService.resolveInviteToken(String(req.params.token || ''));
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

export const updateMarketerBankDetails = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { MarketerPayoutService } = await import('../services/marketerPayoutService');
    const data = await MarketerPayoutService.updateBankDetails(requireMarketerId(req), req.body || {});
    res.json({ success: true, data });
  }
);

export const createMarketerPayout = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { MarketerPayoutService } = await import('../services/marketerPayoutService');
    const data = await MarketerPayoutService.createPayout(requireMarketerId(req), req.body?.amount);
    res.status(201).json({ success: true, data });
  }
);

export const cancelMarketerPayout = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { MarketerPayoutService } = await import('../services/marketerPayoutService');
    const data = await MarketerPayoutService.cancelPayout(
      requireMarketerId(req),
      String(req.params.id)
    );
    res.json({ success: true, data });
  }
);

export const sendMarketerPayoutSignCode = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { MarketerPayoutService } = await import('../services/marketerPayoutService');
    const data = await MarketerPayoutService.sendSignCode(
      requireMarketerId(req),
      String(req.params.id)
    );
    res.json({ success: true, data });
  }
);

export const confirmMarketerPayoutSign = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { MarketerPayoutService } = await import('../services/marketerPayoutService');
    const data = await MarketerPayoutService.confirmSign(
      requireMarketerId(req),
      String(req.params.id),
      String(req.body?.code || ''),
      {
        ip: String(req.ip || req.headers['x-forwarded-for'] || ''),
        userAgent: String(req.headers['user-agent'] || ''),
      }
    );
    res.json({ success: true, data });
  }
);

export const downloadMarketerPayoutDocument = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { MarketerPayoutService } = await import('../services/marketerPayoutService');
    const doc = await MarketerPayoutService.getDocumentPath(
      requireMarketerId(req),
      String(req.params.id)
    );
    const { isStoredUploadPath, sendStoredUpload } = await import('../utils/marketerCabinetFiles');
    if (!isStoredUploadPath(doc.fileUrl)) {
      res.status(404).json({ success: false, error: 'Некорректный путь' });
      return;
    }
    sendStoredUpload(res, doc.fileUrl, { downloadName: `${doc.title || 'act'}.pdf` });
  }
);

export const uploadMarketerNpdReceipt = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { MarketerPayoutService } = await import('../services/marketerPayoutService');
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ success: false, error: 'Файл не загружен' });
      return;
    }
    const data = await MarketerPayoutService.uploadNpdReceipt(
      requireMarketerId(req),
      String(req.params.id),
      file
    );
    res.json({ success: true, data });
  }
);

export const downloadMarketerNpdReceipt = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { MarketerPayoutService } = await import('../services/marketerPayoutService');
    const doc = await MarketerPayoutService.getNpdReceiptPath(
      requireMarketerId(req),
      String(req.params.id)
    );
    const { isStoredUploadPath, sendStoredUpload } = await import('../utils/marketerCabinetFiles');
    if (!isStoredUploadPath(doc.fileUrl)) {
      res.status(404).json({ success: false, error: 'Некорректный путь' });
      return;
    }
    sendStoredUpload(res, doc.fileUrl, { downloadName: doc.title || 'npd-receipt' });
  }
);

export const changeMarketerPassword = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: 'Укажите текущий и новый пароль' });
      return;
    }
    try {
      await AuthService.changeMarketerPassword(
        requireMarketerId(req),
        String(currentPassword),
        String(newPassword)
      );
      res.json({ success: true, data: { message: 'Пароль успешно изменён' } });
    } catch (e: any) {
      res.status(400).json({ success: false, error: e?.message || 'Не удалось сменить пароль' });
    }
  }
);
