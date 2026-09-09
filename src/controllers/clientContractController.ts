import { prisma } from '../lib/prisma';
import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { ClientRequest } from '../middleware/clientAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { absoluteUploadPath, safeUnlink, decodeUploadOriginalName, contentDispositionAttachment } from '../utils/fileStorage';

const PDF_MIME = 'application/pdf';

function parseSignedAt(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function assertStaffClient(tenantId: string, clientId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, tenantId },
    select: { id: true, tenantId: true },
  });
}

async function assertClientAccess(req: ClientRequest, clientId: string) {
  const tenantId = req.client?.tenantId || req.parent?.tenantId;
  if (!tenantId) return null;
  if (req.client?.id) {
    if (req.client.id !== clientId) return null;
    return prisma.client.findFirst({
      where: { id: clientId, tenantId },
      select: { id: true, tenantId: true },
    });
  }
  if (req.parent?.id) {
    return prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId,
        parents: { some: { id: req.parent.id } },
      },
      select: { id: true, tenantId: true },
    });
  }
  return null;
}

function serializeContract(c: any) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    clientId: c.clientId,
    title: decodeUploadOriginalName(c.title),
    originalName: decodeUploadOriginalName(c.originalName),
    mimeType: c.mimeType,
    sizeBytes: c.sizeBytes,
    signedAt: c.signedAt ? c.signedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt?.toISOString?.() || undefined,
    addenda: (c.addenda || []).map((a: any) => ({
      id: a.id,
      contractId: a.contractId,
      title: decodeUploadOriginalName(a.title),
      originalName: decodeUploadOriginalName(a.originalName),
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      signedAt: a.signedAt ? a.signedAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

/**
 * GET /clients/:id/contracts
 */
export const staffListContracts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = req.tenantId!;
    const clientId = String(req.params.id);
    const client = await assertStaffClient(tenantId, clientId);
    if (!client) {
      res.status(404).json({ success: false, error: 'Клиент не найден' });
      return;
    }

    const contracts = await prisma.clientContract.findMany({
      where: { clientId, tenantId },
      include: { addenda: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: contracts.map(serializeContract) });
  }
);

/**
 * POST /clients/:id/contracts  (multipart: file, title?, signedAt?)
 */
export const staffUploadContract = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = req.tenantId!;
    const clientId = String(req.params.id);
    const client = await assertStaffClient(tenantId, clientId);
    if (!client) {
      res.status(404).json({ success: false, error: 'Клиент не найден' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'PDF не загружен' });
      return;
    }
    if (file.mimetype !== PDF_MIME && !file.originalname.toLowerCase().endsWith('.pdf')) {
      safeUnlink(path.join('client-contracts', tenantId, file.filename).replace(/\\/g, '/'));
      res.status(400).json({ success: false, error: 'Допустимы только PDF-файлы' });
      return;
    }

    const title =
      String(req.body?.title || '').trim() ||
      decodeUploadOriginalName(file.originalname).replace(/\.pdf$/i, '') ||
      'Договор';
    const storagePath = path.join('client-contracts', tenantId, file.filename).replace(/\\/g, '/');

    const contract = await prisma.clientContract.create({
      data: {
        tenantId,
        clientId,
        title,
        originalName: decodeUploadOriginalName(file.originalname),
        storagePath,
        mimeType: PDF_MIME,
        sizeBytes: file.size,
        signedAt: parseSignedAt(req.body?.signedAt),
        uploadedById: req.user?.id || null,
      },
      include: { addenda: true },
    });

    res.status(201).json({ success: true, data: serializeContract(contract) });
  }
);

/**
 * GET /clients/:id/contracts/:contractId/download
 */
export const staffDownloadContract = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const clientId = String(req.params.id);
    const contractId = String(req.params.contractId);
    const contract = await prisma.clientContract.findFirst({
      where: { id: contractId, clientId, tenantId },
    });
    if (!contract) {
      res.status(404).json({ success: false, error: 'Договор не найден' });
      return;
    }
    const abs = absoluteUploadPath(contract.storagePath);
    if (!fs.existsSync(abs)) {
      res.status(404).json({ success: false, error: 'Файл отсутствует на диске' });
      return;
    }
    res.setHeader('Content-Type', contract.mimeType);
    res.setHeader('Content-Disposition', contentDispositionAttachment(contract.originalName));
    fs.createReadStream(abs).pipe(res);
  }
);

/**
 * DELETE /clients/:id/contracts/:contractId
 */
export const staffDeleteContract = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = req.tenantId!;
    const clientId = String(req.params.id);
    const contractId = String(req.params.contractId);
    const contract = await prisma.clientContract.findFirst({
      where: { id: contractId, clientId, tenantId },
      include: { addenda: { select: { storagePath: true } } },
    });
    if (!contract) {
      res.status(404).json({ success: false, error: 'Договор не найден' });
      return;
    }
    for (const a of contract.addenda) safeUnlink(a.storagePath);
    safeUnlink(contract.storagePath);
    await prisma.clientContract.delete({ where: { id: contractId } });
    res.json({ success: true, data: { id: contractId } });
  }
);

/**
 * POST /clients/:id/contracts/:contractId/addenda
 */
export const staffUploadAddendum = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = req.tenantId!;
    const clientId = String(req.params.id);
    const contractId = String(req.params.contractId);
    const contract = await prisma.clientContract.findFirst({
      where: { id: contractId, clientId, tenantId },
    });
    if (!contract) {
      res.status(404).json({ success: false, error: 'Договор не найден' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'PDF не загружен' });
      return;
    }
    if (file.mimetype !== PDF_MIME && !file.originalname.toLowerCase().endsWith('.pdf')) {
      safeUnlink(path.join('client-contracts', tenantId, file.filename).replace(/\\/g, '/'));
      res.status(400).json({ success: false, error: 'Допустимы только PDF-файлы' });
      return;
    }

    const title =
      String(req.body?.title || '').trim() ||
      decodeUploadOriginalName(file.originalname).replace(/\.pdf$/i, '') ||
      'Доп. соглашение';
    const storagePath = path.join('client-contracts', tenantId, file.filename).replace(/\\/g, '/');

    const addendum = await prisma.clientContractAddendum.create({
      data: {
        contractId,
        title,
        originalName: decodeUploadOriginalName(file.originalname),
        storagePath,
        mimeType: PDF_MIME,
        sizeBytes: file.size,
        signedAt: parseSignedAt(req.body?.signedAt),
        uploadedById: req.user?.id || null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: addendum.id,
        contractId: addendum.contractId,
        title: addendum.title,
        originalName: addendum.originalName,
        mimeType: addendum.mimeType,
        sizeBytes: addendum.sizeBytes,
        signedAt: addendum.signedAt ? addendum.signedAt.toISOString() : null,
        createdAt: addendum.createdAt.toISOString(),
      },
    });
  }
);

/**
 * GET /clients/:id/contracts/:contractId/addenda/:addendumId/download
 */
export const staffDownloadAddendum = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const clientId = String(req.params.id);
    const contractId = String(req.params.contractId);
    const addendumId = String(req.params.addendumId);
    const addendum = await prisma.clientContractAddendum.findFirst({
      where: {
        id: addendumId,
        contractId,
        contract: { clientId, tenantId },
      },
    });
    if (!addendum) {
      res.status(404).json({ success: false, error: 'Доп. соглашение не найдено' });
      return;
    }
    const abs = absoluteUploadPath(addendum.storagePath);
    if (!fs.existsSync(abs)) {
      res.status(404).json({ success: false, error: 'Файл отсутствует на диске' });
      return;
    }
    res.setHeader('Content-Type', addendum.mimeType);
    res.setHeader('Content-Disposition', contentDispositionAttachment(addendum.originalName));
    fs.createReadStream(abs).pipe(res);
  }
);

/**
 * DELETE /clients/:id/contracts/:contractId/addenda/:addendumId
 */
export const staffDeleteAddendum = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const tenantId = req.tenantId!;
    const clientId = String(req.params.id);
    const contractId = String(req.params.contractId);
    const addendumId = String(req.params.addendumId);
    const addendum = await prisma.clientContractAddendum.findFirst({
      where: {
        id: addendumId,
        contractId,
        contract: { clientId, tenantId },
      },
    });
    if (!addendum) {
      res.status(404).json({ success: false, error: 'Доп. соглашение не найдено' });
      return;
    }
    safeUnlink(addendum.storagePath);
    await prisma.clientContractAddendum.delete({ where: { id: addendumId } });
    res.json({ success: true, data: { id: addendumId } });
  }
);

/** Client cabinet */

export const clientListContracts = asyncHandler(
  async (req: ClientRequest, res: Response<ApiResponse>) => {
    const clientId = String(req.params.clientId || req.client?.id || '');
    const client = await assertClientAccess(req, clientId);
    if (!client) {
      res.status(404).json({ success: false, error: 'Клиент не найден' });
      return;
    }

    const contracts = await prisma.clientContract.findMany({
      where: { clientId: client.id, tenantId: client.tenantId },
      include: { addenda: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });

    const profile = await prisma.client.findUnique({
      where: { id: client.id },
      select: {
        birthCertificate: true,
        birthCertificateNumber: true,
        medicalCertificate: true,
        medicalCertificateNumber: true,
      },
    });

    res.json({
      success: true,
      data: {
        contracts: contracts.map(serializeContract),
        personalDocs: {
          birthCertificate: Boolean(profile?.birthCertificate),
          birthCertificateNumber: profile?.birthCertificateNumber || null,
          medicalCertificate: Boolean(profile?.medicalCertificate),
          medicalCertificateNumber: profile?.medicalCertificateNumber || null,
          birthCertificateDataUrl: profile?.birthCertificate || null,
          medicalCertificateDataUrl: profile?.medicalCertificate || null,
        },
      },
    });
  }
);

export const clientDownloadContract = asyncHandler(async (req: ClientRequest, res: Response) => {
  const clientId = String(req.params.clientId);
  const contractId = String(req.params.contractId);
  const client = await assertClientAccess(req, clientId);
  if (!client) {
    res.status(404).json({ success: false, error: 'Клиент не найден' });
    return;
  }
  const contract = await prisma.clientContract.findFirst({
    where: { id: contractId, clientId: client.id, tenantId: client.tenantId },
  });
  if (!contract) {
    res.status(404).json({ success: false, error: 'Договор не найден' });
    return;
  }
  const abs = absoluteUploadPath(contract.storagePath);
  if (!fs.existsSync(abs)) {
    res.status(404).json({ success: false, error: 'Файл отсутствует на диске' });
    return;
  }
  res.setHeader('Content-Type', contract.mimeType);
  res.setHeader('Content-Disposition', contentDispositionAttachment(contract.originalName));
  fs.createReadStream(abs).pipe(res);
});

export const clientDownloadAddendum = asyncHandler(async (req: ClientRequest, res: Response) => {
  const clientId = String(req.params.clientId);
  const contractId = String(req.params.contractId);
  const addendumId = String(req.params.addendumId);
  const client = await assertClientAccess(req, clientId);
  if (!client) {
    res.status(404).json({ success: false, error: 'Клиент не найден' });
    return;
  }
  const addendum = await prisma.clientContractAddendum.findFirst({
    where: {
      id: addendumId,
      contractId,
      contract: { clientId: client.id, tenantId: client.tenantId },
    },
  });
  if (!addendum) {
    res.status(404).json({ success: false, error: 'Доп. соглашение не найдено' });
    return;
  }
  const abs = absoluteUploadPath(addendum.storagePath);
  if (!fs.existsSync(abs)) {
    res.status(404).json({ success: false, error: 'Файл отсутствует на диске' });
    return;
  }
  res.setHeader('Content-Type', addendum.mimeType);
  res.setHeader('Content-Disposition', contentDispositionAttachment(addendum.originalName));
  fs.createReadStream(abs).pipe(res);
});
