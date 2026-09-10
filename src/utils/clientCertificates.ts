import fs from 'fs';
import path from 'path';
import {
  absoluteUploadPath,
  ensureUploadDir,
  safeUnlink,
  uniqueUploadFilename,
} from './fileStorage';

export type CertificateKind = 'birth' | 'medical';

const KIND_PREFIX: Record<CertificateKind, string> = {
  birth: 'birth',
  medical: 'medical',
};

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

export function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:[^;]+;base64,/i.test(value.trim());
}

/** Относительный путь под uploads/client-certificates/... */
export function isCertificateStoragePath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.length) return false;
  // Не использовать isDataUrl() как type predicate здесь — иначе TS сужает к never.
  if (/^data:[^;]+;base64,/i.test(value.trim())) return false;
  const normalized = value.replace(/\\/g, '/');
  return normalized.startsWith('client-certificates/');
}

export function hasCertificateFile(value: unknown): boolean {
  return isDataUrl(value) || isCertificateStoragePath(value);
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = dataUrl.trim().match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) {
    throw new Error('Invalid data URL');
  }
  const mime = match[1].toLowerCase().trim();
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) {
    throw new Error('Empty certificate file');
  }
  // ~8 MB raw
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('Certificate file too large');
  }
  return { mime, buffer };
}

function extForMime(mime: string): string {
  return MIME_TO_EXT[mime] || '.bin';
}

export function mimeFromStoragePath(storagePath: string): string {
  const ext = path.extname(storagePath).toLowerCase();
  return EXT_TO_MIME[ext] || 'application/octet-stream';
}

export function downloadNameForKind(kind: CertificateKind, storagePath: string): string {
  const ext = path.extname(storagePath) || '';
  const base = kind === 'birth' ? 'svidetelstvo-o-rozhdenii' : 'meditsinskaya-spravka';
  return `${base}${ext}`;
}

/**
 * Сохраняет data URL на диск. Возвращает относительный путь.
 */
export function saveCertificateDataUrl(
  tenantId: string,
  clientId: string,
  kind: CertificateKind,
  dataUrl: string
): string {
  const { mime, buffer } = parseDataUrl(dataUrl);
  const dir = ensureUploadDir('client-certificates', tenantId);
  const filename = uniqueUploadFilename(
    `${KIND_PREFIX[kind]}-${clientId}${extForMime(mime)}`
  );
  const abs = path.join(dir, filename);
  fs.writeFileSync(abs, buffer);
  return path.join('client-certificates', tenantId, filename).replace(/\\/g, '/');
}

export function unlinkCertificateIfStored(value: string | null | undefined): void {
  if (isCertificateStoragePath(value)) {
    safeUnlink(value.replace(/\\/g, '/'));
  }
}

/**
 * Применить поле сертификата из body.
 * - undefined: поле не трогаем (вернуть undefined)
 * - null / '': очистить
 * - data URL: сохранить на диск
 * - уже путь: оставить как есть
 * - иначе: невалидно → очистить
 */
export function resolveCertificateUpdate(
  tenantId: string,
  clientId: string,
  kind: CertificateKind,
  incoming: unknown,
  previous: string | null | undefined
): string | null | undefined {
  if (incoming === undefined) return undefined;

  if (incoming === null || incoming === '') {
    unlinkCertificateIfStored(previous);
    return null;
  }

  if (isDataUrl(incoming)) {
    const next = saveCertificateDataUrl(tenantId, clientId, kind, incoming);
    if (previous && previous !== next) unlinkCertificateIfStored(previous);
    return next;
  }

  if (isCertificateStoragePath(incoming)) {
    // Не принимаем чужой путь из клиента — только если совпадает с текущим.
    if (previous && incoming.replace(/\\/g, '/') === previous.replace(/\\/g, '/')) {
      return previous.replace(/\\/g, '/');
    }
    return previous ?? null;
  }

  // boolean / мусор — не меняем, если уже есть файл; иначе null
  if (typeof incoming === 'boolean') {
    return undefined;
  }

  unlinkCertificateIfStored(previous);
  return null;
}

/**
 * Если в БД ещё лежит data URL — один раз переносим на диск.
 */
export function migrateCertificateValueIfNeeded(
  tenantId: string,
  clientId: string,
  kind: CertificateKind,
  value: string | null | undefined
): { path: string | null; changed: boolean } {
  if (!value) return { path: null, changed: false };
  if (isCertificateStoragePath(value)) {
    return { path: value.replace(/\\/g, '/'), changed: false };
  }
  if (isDataUrl(value)) {
    const stored = saveCertificateDataUrl(tenantId, clientId, kind, value);
    return { path: stored, changed: true };
  }
  return { path: null, changed: false };
}

export function absoluteCertificatePath(storagePath: string): string {
  return absoluteUploadPath(storagePath.replace(/\\/g, '/'));
}

/** Убрать байты/пути из JSON-ответа; оставить флаги наличия. */
export function sanitizeClientCertificateFields<T extends Record<string, any>>(client: T): T {
  const birth = client.birthCertificate;
  const medical = client.medicalCertificate;
  const { birthCertificate: _b, medicalCertificate: _m, ...rest } = client;
  return {
    ...rest,
    hasBirthCertificate: hasCertificateFile(birth),
    hasMedicalCertificate: hasCertificateFile(medical),
  } as unknown as T;
}
