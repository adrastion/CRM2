import { prisma } from '../lib/prisma';
import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { ClientRequest } from '../middleware/clientAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { absoluteUploadPath, safeUnlink, decodeUploadOriginalName, contentDispositionAttachment } from '../utils/fileStorage';
import {
  absoluteCertificatePath,
  downloadNameForKind,
  migrateCertificateValueIfNeeded,
  mimeFromStoragePath,
  saveCertificateDataUrl,
  unlinkCertificateIfStored,
  type CertificateKind,
} from '../utils/clientCertificates';

const PDF_MIME = 'application/pdf';
const PORTAL_DOC_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

function isAllowedPortalDoc(file: Express.Multer.File): boolean {
  const name = file.originalname.toLowerCase();
  if (PORTAL_DOC_MIMES.has(file.mimetype)) return true;
  return /\.(pdf|jpe?g|png)$/i.test(name);
}

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
        },
      },
    });
  }
);

async function streamClientCertificate(
  res: Response,
  args: {
    tenantId: string;
    clientId: string;
    kind: CertificateKind;
    value: string | null | undefined;
  }
) {
  const migrated = migrateCertificateValueIfNeeded(
    args.tenantId,
    args.clientId,
    args.kind,
    args.value
  );
  if (migrated.changed) {
    await prisma.client.update({
      where: { id: args.clientId },
      data:
        args.kind === 'birth'
          ? { birthCertificate: migrated.path }
          : { medicalCertificate: migrated.path },
    });
  }
  if (!migrated.path) {
    res.status(404).json({ success: false, error: 'Файл не загружен' });
    return;
  }
  const abs = absoluteCertificatePath(migrated.path);
  if (!fs.existsSync(abs)) {
    res.status(404).json({ success: false, error: 'Файл отсутствует на диске' });
    return;
  }
  const filename = downloadNameForKind(args.kind, migrated.path);
  res.setHeader('Content-Type', mimeFromStoragePath(migrated.path));
  res.setHeader('Content-Disposition', contentDispositionAttachment(filename));
  fs.createReadStream(abs).pipe(res);
}

/**
 * GET /clients/:id/certificates/:kind/download  kind = birth | medical
 */
export const staffDownloadCertificate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const clientId = String(req.params.id);
    const kindRaw = String(req.params.kind || '').toLowerCase();
    const kind: CertificateKind | null =
      kindRaw === 'birth' || kindRaw === 'medical' ? kindRaw : null;
    if (!kind) {
      res.status(400).json({ success: false, error: 'Укажите kind: birth или medical' });
      return;
    }
    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId },
      select: {
        id: true,
        tenantId: true,
        birthCertificate: true,
        medicalCertificate: true,
      },
    });
    if (!client) {
      res.status(404).json({ success: false, error: 'Клиент не найден' });
      return;
    }
    await streamClientCertificate(res, {
      tenantId: client.tenantId,
      clientId: client.id,
      kind,
      value: kind === 'birth' ? client.birthCertificate : client.medicalCertificate,
    });
  }
);

/**
 * GET /client-auth/clients/:clientId/certificates/:kind/download
 */
export const clientDownloadCertificate = asyncHandler(
  async (req: ClientRequest, res: Response) => {
    const clientId = String(req.params.clientId);
    const kindRaw = String(req.params.kind || '').toLowerCase();
    const kind: CertificateKind | null =
      kindRaw === 'birth' || kindRaw === 'medical' ? kindRaw : null;
    if (!kind) {
      res.status(400).json({ success: false, error: 'Укажите kind: birth или medical' });
      return;
    }
    const access = await assertClientAccess(req, clientId);
    if (!access) {
      res.status(404).json({ success: false, error: 'Клиент не найден' });
      return;
    }
    const client = await prisma.client.findFirst({
      where: { id: access.id, tenantId: access.tenantId },
      select: {
        id: true,
        tenantId: true,
        birthCertificate: true,
        medicalCertificate: true,
      },
    });
    if (!client) {
      res.status(404).json({ success: false, error: 'Клиент не найден' });
      return;
    }
    await streamClientCertificate(res, {
      tenantId: client.tenantId,
      clientId: client.id,
      kind,
      value: kind === 'birth' ? client.birthCertificate : client.medicalCertificate,
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

/**
 * POST /client-auth/clients/:clientId/contracts — загрузка договора из ЛК (PDF/JPG/PNG ≤ 10 МБ).
 */
export const clientUploadContract = asyncHandler(
  async (req: ClientRequest, res: Response<ApiResponse>) => {
    const clientId = String(req.params.clientId);
    const client = await assertClientAccess(req, clientId);
    if (!client) {
      res.status(404).json({ success: false, error: 'Клиент не найден' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'Файл не загружен' });
      return;
    }
    if (!isAllowedPortalDoc(file)) {
      safeUnlink(path.join('client-contracts', client.tenantId, file.filename).replace(/\\/g, '/'));
      res.status(400).json({ success: false, error: 'Допустимы PDF, JPG и PNG' });
      return;
    }

    const title =
      String(req.body?.title || '').trim() ||
      decodeUploadOriginalName(file.originalname).replace(/\.(pdf|jpe?g|png)$/i, '') ||
      'Договор';
    const storagePath = path.join('client-contracts', client.tenantId, file.filename).replace(/\\/g, '/');

    const contract = await prisma.clientContract.create({
      data: {
        tenantId: client.tenantId,
        clientId: client.id,
        title,
        originalName: decodeUploadOriginalName(file.originalname),
        storagePath,
        mimeType: file.mimetype || PDF_MIME,
        sizeBytes: file.size,
        signedAt: parseSignedAt(req.body?.signedAt),
        uploadedById: null,
      },
      include: { addenda: true },
    });

    res.status(201).json({ success: true, data: serializeContract(contract) });
  }
);

/**
 * POST /client-auth/clients/:clientId/certificates/:kind — личный документ из ЛК.
 */
export const clientUploadCertificate = asyncHandler(
  async (req: ClientRequest, res: Response<ApiResponse>) => {
    const clientId = String(req.params.clientId);
    const kindRaw = String(req.params.kind || '').toLowerCase();
    const kind: CertificateKind | null =
      kindRaw === 'birth' || kindRaw === 'medical' ? kindRaw : null;
    if (!kind) {
      res.status(400).json({ success: false, error: 'Укажите kind: birth или medical' });
      return;
    }

    const access = await assertClientAccess(req, clientId);
    if (!access) {
      res.status(404).json({ success: false, error: 'Клиент не найден' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'Файл не загружен' });
      return;
    }
    if (!isAllowedPortalDoc(file)) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      res.status(400).json({ success: false, error: 'Допустимы PDF, JPG и PNG' });
      return;
    }

    const buffer = file.buffer?.length
      ? file.buffer
      : file.path
        ? fs.readFileSync(file.path)
        : null;
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
    }
    if (!buffer?.length) {
      res.status(400).json({ success: false, error: 'Пустой файл' });
      return;
    }

    const dataUrl = `data:${file.mimetype || 'application/octet-stream'};base64,${buffer.toString('base64')}`;

    const existing = await prisma.client.findUnique({
      where: { id: access.id },
      select: { birthCertificate: true, medicalCertificate: true },
    });
    const prev =
      kind === 'birth' ? existing?.birthCertificate : existing?.medicalCertificate;
    let storagePath: string;
    try {
      storagePath = saveCertificateDataUrl(access.tenantId, access.id, kind, dataUrl);
    } catch (e: any) {
      res.status(400).json({ success: false, error: e?.message || 'Не удалось сохранить файл' });
      return;
    }
    unlinkCertificateIfStored(prev);

    await prisma.client.update({
      where: { id: access.id },
      data: kind === 'birth' ? { birthCertificate: storagePath } : { medicalCertificate: storagePath },
    });

    res.status(201).json({
      success: true,
      data: { kind, uploaded: true },
    });
  }
);
