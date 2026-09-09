import fs from 'fs';
import path from 'path';

export function uploadsRoot(): string {
  return path.join(process.cwd(), 'uploads');
}

export function ensureUploadDir(...segments: string[]): string {
  const dir = path.join(uploadsRoot(), ...segments);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** relativePath like `dev-notes/file.pdf` → absolute under uploads/ */
export function absoluteUploadPath(relativePath: string): string {
  const abs = path.resolve(uploadsRoot(), relativePath);
  const root = path.resolve(uploadsRoot());
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error('Invalid storage path');
  }
  return abs;
}

export function safeUnlink(relativePath: string): void {
  try {
    const abs = absoluteUploadPath(relativePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    console.error('unlink failed', relativePath, e);
  }
}

export function uniqueUploadFilename(originalName: string): string {
  const ext = path.extname(originalName) || '';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
}

/**
 * Multer/busboy часто отдаёт UTF-8 имя файла как latin1 («Ð”Ð¾Ð³Ð¾Ð²Ð¾Ñ€.pdf»).
 * Восстанавливаем кириллицу и прочие unicode-имена.
 */
export function decodeUploadOriginalName(raw: string): string {
  const name = String(raw || '').trim() || 'file';
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    const hasCyrillic = /[А-Яа-яЁё]/.test(decoded);
    const sourceLooksMojibake = /[ÐÑ]/.test(name) || /Ã./.test(name);
    if (hasCyrillic && (sourceLooksMojibake || !/[А-Яа-яЁё]/.test(name))) {
      return decoded.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'file';
    }
    if (/[А-Яа-яЁё]/.test(name) || !sourceLooksMojibake) {
      return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'file';
    }
    return decoded.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'file';
  } catch {
    return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'file';
  }
}

/** Content-Disposition с ASCII fallback + UTF-8 filename* для кириллицы. */
export function contentDispositionAttachment(originalName: string): string {
  const utf8 = decodeUploadOriginalName(originalName);
  const ext = path.extname(utf8) || '';
  const asciiBase = utf8
    .replace(ext, '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\]/g, '_')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
  const ascii = `${asciiBase || 'file'}${ext || ''}`.replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8)}`;
}
