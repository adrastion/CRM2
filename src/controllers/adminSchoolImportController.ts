import { Response } from 'express';
import multer from 'multer';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import {
  buildSchoolImportTemplateBuffer,
  importSchoolFromExcelBuffer,
} from '../services/schoolExcelImportService';
import { prisma } from '../lib/prisma';

export const schoolImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      cb(null, true);
      return;
    }
    cb(new Error('Только файлы Excel (.xlsx, .xls)'));
  },
});

export const downloadSchoolImportTemplate = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const buffer = buildSchoolImportTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=template_school_import.xlsx'
    );
    res.send(buffer);
  }
);

export const importSchoolExcel = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = req.params;
    const superAdmin = (req as any).superAdmin as { id: string } | undefined;
    if (!superAdmin?.id) {
      res.status(401).json({ success: false, error: 'Не авторизован' });
      return;
    }
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Укажите школу' });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Школа не найдена' });
      return;
    }

    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ success: false, error: 'Приложите Excel-файл' });
      return;
    }

    const result = await importSchoolFromExcelBuffer({
      tenantId,
      buffer: file.buffer,
      superAdminId: superAdmin.id,
    });

    if (!result.ok) {
      res.status(400).json({
        success: false,
        error: result.emptyCheckFailed || 'Импорт не выполнен — исправьте ошибки в файле',
        data: {
          tenantId,
          tenantName: tenant.name,
          created: result.created,
          errors: result.errors,
          staffPasswords: [],
        },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Данные школы импортированы',
      data: {
        tenantId,
        tenantName: tenant.name,
        created: result.created,
        errors: [],
        staffPasswords: result.staffPasswords,
      },
    });
  }
);
