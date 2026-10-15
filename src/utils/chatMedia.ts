import fs from 'fs';
import path from 'path';

export type ChatMediaKind = 'image' | 'video' | 'voice';
export type ChatMessageKind = 'TEXT' | 'IMAGE' | 'VIDEO' | 'VOICE';

export const CHAT_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const CHAT_VIDEO_MIME = new Set(['video/mp4', 'video/webm']);
export const CHAT_VOICE_MIME = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'video/webm', // MediaRecorder often labels voice as video/webm
]);

export const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const CHAT_VOICE_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_VOICE_MAX_DURATION_MS = 5 * 60 * 1000;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
};

export function extensionForMime(mime: string): string {
  return EXT_BY_MIME[mime] || '.bin';
}

export function mediaKindFromMime(mime: string): ChatMediaKind | null {
  if (CHAT_IMAGE_MIME.has(mime)) return 'image';
  if (CHAT_VIDEO_MIME.has(mime)) return 'video';
  if (CHAT_VOICE_MIME.has(mime)) return 'voice';
  return null;
}

export function messageKindFromMedia(kind: ChatMediaKind): ChatMessageKind {
  if (kind === 'image') return 'IMAGE';
  if (kind === 'video') return 'VIDEO';
  return 'VOICE';
}

export function maxBytesForMediaKind(kind: ChatMediaKind): number {
  if (kind === 'image') return CHAT_IMAGE_MAX_BYTES;
  if (kind === 'video') return CHAT_VIDEO_MAX_BYTES;
  return CHAT_VOICE_MAX_BYTES;
}

/** Проверка magic bytes (без зависимости file-type). */
export function sniffMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  // WEBP (RIFF....WEBP)
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  // MP4 / M4A (ftyp)
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.slice(8, 12).toString('ascii');
    if (brand.startsWith('mp4') || brand === 'isom' || brand === 'iso2' || brand === 'avc1') {
      return 'video/mp4';
    }
    if (brand === 'M4A ' || brand === 'M4B ') return 'audio/mp4';
    return 'video/mp4';
  }
  // WebM / EBML
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'video/webm';
  }
  // OGG
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    return 'audio/ogg';
  }
  // MPEG / MP3
  if (
    (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) ||
    (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33)
  ) {
    return 'audio/mpeg';
  }
  return null;
}

export function sniffMimeFromFile(absPath: string): string | null {
  const fd = fs.openSync(absPath, 'r');
  try {
    const buf = Buffer.alloc(32);
    const n = fs.readSync(fd, buf, 0, 32, 0);
    return sniffMimeFromBuffer(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
}

const MENTION_TOKEN_RE = /@\[([A-Z_]+):([^\]|]+)\|([^\]]+)\]/g;

/** Токены @[TYPE:id|Имя] → @Имя для превью в списке чатов. */
export function formatMentionsForPreview(text: string): string {
  return String(text || '').replace(MENTION_TOKEN_RE, (_full, _t, _id, name) => `@${name}`);
}

export function previewForMessage(kind: string, body: string): string {
  const caption = formatMentionsForPreview(String(body || '').trim());
  if (kind === 'IMAGE') return caption ? `Фото: ${caption}` : 'Фото';
  if (kind === 'VIDEO') return caption ? `Видео: ${caption}` : 'Видео';
  if (kind === 'VOICE') return caption ? `Голосовое: ${caption}` : 'Голосовое сообщение';
  return caption || '';
}

export function safeChatStorageName(mime: string): string {
  const ext = extensionForMime(mime);
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
}

export function chatMediaRelativeDir(tenantId: string | null, threadId: string): string {
  const scope = tenantId || 'platform';
  return path.join('chat-media', scope, threadId).replace(/\\/g, '/');
}
