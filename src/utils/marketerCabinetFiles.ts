import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { absoluteUploadPath, contentDispositionAttachment } from './fileStorage';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};

export function isHttpUrl(value?: string | null): boolean {
  return !!value && /^https?:\/\//i.test(value.trim());
}

export function isStoredUploadPath(value?: string | null): boolean {
  if (!value || isHttpUrl(value)) return false;
  return value.startsWith('marketer-cabinet/');
}

export function sendStoredUpload(
  res: Response,
  relativePath: string,
  opts?: { inline?: boolean; downloadName?: string }
): void {
  const abs = absoluteUploadPath(relativePath);
  if (!fs.existsSync(abs)) {
    res.status(404).json({ success: false, error: 'Файл отсутствует на диске' });
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const name = opts?.downloadName || path.basename(abs);
  res.setHeader('Content-Type', mime);
  if (opts?.inline) {
    res.setHeader('Content-Disposition', `inline; filename="${name.replace(/"/g, '_')}"`);
  } else {
    res.setHeader('Content-Disposition', contentDispositionAttachment(name));
  }
  fs.createReadStream(abs).pipe(res);
}
