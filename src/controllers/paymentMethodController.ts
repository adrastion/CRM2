import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import {
  absoluteUploadPath,
  decodeUploadOriginalName,
  ensureUploadDir,
  safeUnlink,
  uniqueUploadFilename,
} from '../utils/fileStorage';
import {
  listActivePaymentMethods,
  methodInclude,
  serializePaymentMethod,
} from '../services/paymentMethodService';
import { FinanceService } from '../services/financeService';
import { accrueForPayment } from '../services/trainerSalaryService';
import {
  notifyClientPaymentReceived,
  notifyFinanceChange,
} from '../services/notificationDomainHooks';

const QR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const RECEIPT_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

function requireTenant(req: AuthenticatedRequest) {
  if (!req.tenant?.id) throw badRequest('Требуется авторизация');
  return req.tenant.id;
}

function parseIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) return [...new Set(raw.map(String).filter(Boolean))];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return [...new Set(parsed.map(String).filter(Boolean))];
    } catch {
      return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
    }
  }
  return [];
}

function parseBool(raw: unknown, fallback = false): boolean {
  if (raw === true || raw === 'true' || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === '0') return false;
  return fallback;
}

export const paymentQrUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const tenantId = (req as AuthenticatedRequest).tenant?.id;
        if (!tenantId) return cb(new Error('No tenant'), '');
        cb(null, ensureUploadDir('payment-qr', tenantId));
      } catch (e: any) {
        cb(e, '');
      }
    },
    filename: (_req, file, cb) => {
      cb(null, uniqueUploadFilename(decodeUploadOriginalName(file.originalname)));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (QR_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Допустимы изображения JPEG/PNG/WebP/GIF'));
  },
});

export const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const tenantId = (req as AuthenticatedRequest).tenant?.id;
        if (!tenantId) return cb(new Error('No tenant'), '');
        cb(null, ensureUploadDir('payment-receipts', tenantId));
      } catch (e: any) {
        cb(e, '');
      }
    },
    filename: (_req, file, cb) => {
      cb(null, uniqueUploadFilename(decodeUploadOriginalName(file.originalname)));
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (RECEIPT_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Допустимы изображения или PDF'));
  },
});

/** Portal receipt upload — tenant from client/parent auth */
export const portalReceiptUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const tenantId =
          (req as any).client?.tenantId || (req as any).parent?.tenantId;
        if (!tenantId) return cb(new Error('No tenant'), '');
        cb(null, ensureUploadDir('payment-receipts', tenantId));
      } catch (e: any) {
        cb(e, '');
      }
    },
    filename: (_req, file, cb) => {
      cb(null, uniqueUploadFilename(decodeUploadOriginalName(file.originalname)));
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (RECEIPT_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Допустимы изображения или PDF'));
  },
});

async function clearOtherDefaults(tenantId: string, exceptId?: string) {
  await prisma.schoolPaymentMethod.updateMany({
    where: {
      tenantId,
      isDefault: true,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    data: { isDefault: false },
  });
}

export const listPaymentMethods = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = requireTenant(req);
    const rows = await prisma.schoolPaymentMethod.findMany({
      where: { tenantId },
      include: methodInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: rows.map(serializePaymentMethod) });
  }
);

export const createPaymentMethod = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = requireTenant(req);
    if (req.user?.role !== 'OWNER') throw forbidden('Только владелец может редактировать реквизиты');

    const title = String(req.body?.title || '').trim();
    if (!title) throw badRequest('Укажите название', 'title');
    const paymentUrl = req.body?.paymentUrl ? String(req.body.paymentUrl).trim() : null;
    const groupIds = parseIdList(req.body?.groupIds);
    const membershipIds = parseIdList(req.body?.membershipIds);
    let isDefault = parseBool(req.body?.isDefault, false);

    if (groupIds.length === 0 && membershipIds.length === 0) {
      isDefault = true;
    }

    const file = req.file;
    let qrStoragePath: string | null = null;
    let mimeType: string | null = null;
    if (file) {
      qrStoragePath = path.join('payment-qr', tenantId, file.filename).replace(/\\/g, '/');
      mimeType = file.mimetype;
    }
    if (!qrStoragePath && !paymentUrl) {
      throw badRequest('Загрузите QR или укажите ссылку на оплату');
    }

    if (isDefault) await clearOtherDefaults(tenantId);

    const row = await prisma.schoolPaymentMethod.create({
      data: {
        tenantId,
        title,
        paymentUrl,
        qrStoragePath,
        mimeType,
        isDefault,
        groups: groupIds.length
          ? { create: groupIds.map((groupId) => ({ groupId })) }
          : undefined,
        memberships: membershipIds.length
          ? { create: membershipIds.map((membershipId) => ({ membershipId })) }
          : undefined,
      },
      include: methodInclude,
    });

    res.status(201).json({ success: true, data: serializePaymentMethod(row) });
  }
);

export const updatePaymentMethod = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = requireTenant(req);
    if (req.user?.role !== 'OWNER') throw forbidden('Только владелец может редактировать реквизиты');
    const { id } = req.params;
    const existing = await prisma.schoolPaymentMethod.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Реквизит не найден');

    const data: Record<string, unknown> = {};
    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) throw badRequest('Укажите название', 'title');
      data.title = title;
    }
    if (req.body?.paymentUrl !== undefined) {
      data.paymentUrl = req.body.paymentUrl ? String(req.body.paymentUrl).trim() : null;
    }
    if (req.body?.isActive !== undefined) {
      data.isActive = parseBool(req.body.isActive, true);
    }
    if (req.body?.sortOrder !== undefined) {
      data.sortOrder = Number(req.body.sortOrder) || 0;
    }

    const groupIds =
      req.body?.groupIds !== undefined ? parseIdList(req.body.groupIds) : null;
    const membershipIds =
      req.body?.membershipIds !== undefined ? parseIdList(req.body.membershipIds) : null;

    let isDefault =
      req.body?.isDefault !== undefined
        ? parseBool(req.body.isDefault, existing.isDefault)
        : existing.isDefault;

    if (groupIds && membershipIds && groupIds.length === 0 && membershipIds.length === 0) {
      isDefault = true;
    }

    const file = req.file;
    if (file) {
      if (existing.qrStoragePath) safeUnlink(existing.qrStoragePath);
      data.qrStoragePath = path.join('payment-qr', tenantId, file.filename).replace(/\\/g, '/');
      data.mimeType = file.mimetype;
    }
    if (parseBool(req.body?.removeQr, false) && !file) {
      if (existing.qrStoragePath) safeUnlink(existing.qrStoragePath);
      data.qrStoragePath = null;
      data.mimeType = null;
    }

    const nextUrl = (data.paymentUrl !== undefined ? data.paymentUrl : existing.paymentUrl) as
      | string
      | null;
    const nextQr = (data.qrStoragePath !== undefined
      ? data.qrStoragePath
      : existing.qrStoragePath) as string | null;
    if (!nextUrl && !nextQr) {
      throw badRequest('Нужен QR или ссылка на оплату');
    }

    if (isDefault) await clearOtherDefaults(tenantId, id);
    data.isDefault = isDefault;

    await prisma.$transaction(async (tx) => {
      if (groupIds) {
        await tx.schoolPaymentMethodGroup.deleteMany({ where: { methodId: id } });
        if (groupIds.length) {
          await tx.schoolPaymentMethodGroup.createMany({
            data: groupIds.map((groupId) => ({ methodId: id, groupId })),
          });
        }
      }
      if (membershipIds) {
        await tx.schoolPaymentMethodMembership.deleteMany({ where: { methodId: id } });
        if (membershipIds.length) {
          await tx.schoolPaymentMethodMembership.createMany({
            data: membershipIds.map((membershipId) => ({ methodId: id, membershipId })),
          });
        }
      }
      await tx.schoolPaymentMethod.update({ where: { id }, data: data as any });
    });

    const row = await prisma.schoolPaymentMethod.findFirst({
      where: { id, tenantId },
      include: methodInclude,
    });
    res.json({ success: true, data: serializePaymentMethod(row!) });
  }
);

export const deletePaymentMethod = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = requireTenant(req);
    if (req.user?.role !== 'OWNER') throw forbidden('Только владелец может редактировать реквизиты');
    const { id } = req.params;
    const existing = await prisma.schoolPaymentMethod.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Реквизит не найден');
    if (existing.qrStoragePath) safeUnlink(existing.qrStoragePath);
    await prisma.schoolPaymentMethod.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  }
);

export const getPaymentMethodQrFile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = requireTenant(req);
    const { id } = req.params;
    const row = await prisma.schoolPaymentMethod.findFirst({ where: { id, tenantId } });
    if (!row?.qrStoragePath) throw notFound('QR не найден');
    const abs = absoluteUploadPath(row.qrStoragePath);
    if (!fs.existsSync(abs)) throw notFound('Файл не найден');
    res.setHeader('Content-Type', row.mimeType || 'image/png');
    res.sendFile(abs);
  }
);

// ——— Receipts (school) ———

export const listAwaitingReceipts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = requireTenant(req);
    const payments = await prisma.payment.findMany({
      where: {
        tenantId,
        status: 'awaiting_confirmation',
        receipt: { isNot: null },
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, middleName: true } },
        group: { select: { id: true, name: true } },
        membership: { select: { id: true, name: true } },
        receipt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      data: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        type: p.type,
        status: p.status,
        dueDate: p.dueDate,
        client: p.client,
        groupName: p.group?.name || null,
        membershipName: p.membership?.name || null,
        receipt: p.receipt
          ? {
              id: p.receipt.id,
              claimedAmount: Number(p.receipt.claimedAmount),
              mimeType: p.receipt.mimeType,
              originalName: p.receipt.originalName,
              submittedAt: p.receipt.submittedAt,
              submittedByKind: p.receipt.submittedByKind,
            }
          : null,
      })),
    });
  }
);

export const getReceiptFile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = requireTenant(req);
    const { paymentId } = req.params;
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
      include: { receipt: true },
    });
    if (!payment?.receipt) throw notFound('Чек не найден');
    const abs = absoluteUploadPath(payment.receipt.storagePath);
    if (!fs.existsSync(abs)) throw notFound('Файл не найден');
    res.setHeader('Content-Type', payment.receipt.mimeType || 'application/octet-stream');
    res.sendFile(abs);
  }
);

export const confirmPaymentReceipt = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = requireTenant(req);
    const role = req.user?.role;
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw forbidden('Подтверждать чеки могут владелец и администратор');
    }
    const { paymentId } = req.params;
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId, status: 'awaiting_confirmation' },
      include: { client: true, receipt: true },
    });
    if (!payment) throw notFound('Платёж на проверке не найден');
    if (!payment.receipt) throw badRequest('Чек отсутствует');

    const clientName = `${payment.client.lastName} ${payment.client.firstName}`.trim();
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: 'transfer',
      },
      include: { client: true },
    });

    await prisma.paymentReceipt.update({
      where: { id: payment.receipt.id },
      data: {
        reviewedAt: new Date(),
        reviewedByUserId: req.user?.id || null,
      },
    });

    await FinanceService.recordPaymentIncome(updated, clientName);
    await accrueForPayment({
      tenantId,
      paymentId: updated.id,
      clientId: updated.clientId,
      amount: Number(updated.amount),
      groupId: updated.groupId,
      isMonthlyPayment: Boolean(updated.isMonthlyPayment),
      paymentType: updated.type || undefined,
      paidAt: updated.paidAt,
    }).catch((err) => console.error('Trainer salary accrue on receipt confirm failed:', err));

    void notifyClientPaymentReceived({
      tenantId,
      clientId: payment.clientId,
      amount: Number(payment.amount),
    }).catch((err) => console.error('[Notifications] payment:', err));
    void notifyFinanceChange({
      tenantId,
      title: 'Оплата подтверждена по чеку',
      body: Number(payment.amount).toLocaleString('ru-RU'),
      branchId: payment.branchId,
      excludeUserId: req.user?.id,
    }).catch((err) => console.error('[Notifications] finance:', err));

    res.json({ success: true, data: { payment: updated } });
  }
);

export const rejectPaymentReceipt = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = requireTenant(req);
    const role = req.user?.role;
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw forbidden('Отклонять чеки могут владелец и администратор');
    }
    const { paymentId } = req.params;
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId, status: 'awaiting_confirmation' },
      include: { receipt: true },
    });
    if (!payment) throw notFound('Платёж на проверке не найден');

    if (payment.receipt?.storagePath) safeUnlink(payment.receipt.storagePath);
    if (payment.receipt) {
      await prisma.paymentReceipt.delete({ where: { id: payment.receipt.id } });
    }

    const now = new Date();
    const overdue =
      payment.dueDate != null && new Date(payment.dueDate).getTime() < now.getTime();
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: overdue ? 'overdue' : 'pending' },
    });

    res.json({ success: true, data: { payment: updated } });
  }
);

export { listActivePaymentMethods };
