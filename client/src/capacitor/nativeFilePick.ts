import { isNativeApp } from './platform';

export type PickedNativeFile = {
  file: File;
  kind?: 'image' | 'video';
};

async function blobToFile(blob: Blob, name: string, mime: string): Promise<File> {
  return new File([blob], name, { type: mime || blob.type || 'application/octet-stream' });
}

/**
 * Выбор фото/видео внутри APK (галерея), без ухода в браузер.
 * На вебе возвращает null — вызывающий код использует &lt;input type="file"&gt;.
 */
export async function pickNativeMedia(opts?: {
  images?: boolean;
  videos?: boolean;
}): Promise<PickedNativeFile | null> {
  if (!isNativeApp()) return null;
  const wantImages = opts?.images !== false;
  const wantVideos = opts?.videos !== false;

  try {
    const { FilePicker } = await import('@capawesome/capacitor-file-picker');

    if (wantImages && wantVideos) {
      const res = await FilePicker.pickMedia({ limit: 1, readData: true });
      const item = res.files?.[0];
      if (!item?.data) return null;
      const mime = item.mimeType || 'application/octet-stream';
      const name = item.name || (mime.startsWith('video/') ? 'video.mp4' : 'image.jpg');
      const bin = Uint8Array.from(atob(item.data), (c) => c.charCodeAt(0));
      const file = await blobToFile(new Blob([bin], { type: mime }), name, mime);
      const kind = mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : undefined;
      return { file, kind };
    }

    if (wantVideos && !wantImages) {
      const res = await FilePicker.pickVideos({ limit: 1, readData: true });
      const item = res.files?.[0];
      if (!item?.data) return null;
      const mime = item.mimeType || 'video/mp4';
      const name = item.name || 'video.mp4';
      const bin = Uint8Array.from(atob(item.data), (c) => c.charCodeAt(0));
      const file = await blobToFile(new Blob([bin], { type: mime }), name, mime);
      return { file, kind: 'video' };
    }

    const res = await FilePicker.pickImages({ limit: 1, readData: true });
    const item = res.files?.[0];
    if (!item?.data) return null;
    const mime = item.mimeType || 'image/jpeg';
    const name = item.name || 'image.jpg';
    const bin = Uint8Array.from(atob(item.data), (c) => c.charCodeAt(0));
    const file = await blobToFile(new Blob([bin], { type: mime }), name, mime);
    return { file, kind: 'image' };
  } catch (e: any) {
    // пользователь отменил
    if (String(e?.message || e).toLowerCase().includes('cancel')) return null;
    console.warn('[capacitor] pickNativeMedia', e);
    return null;
  }
}

/** Произвольный файл (документы, xlsx, apk…) внутри APK. */
export async function pickNativeFile(opts?: {
  types?: string[];
}): Promise<File | null> {
  if (!isNativeApp()) return null;
  try {
    const { FilePicker } = await import('@capawesome/capacitor-file-picker');
    const res = await FilePicker.pickFiles({
      limit: 1,
      readData: true,
      types: opts?.types,
    });
    const item = res.files?.[0];
    if (!item?.data) return null;
    const mime = item.mimeType || 'application/octet-stream';
    const name = item.name || 'file';
    const bin = Uint8Array.from(atob(item.data), (c) => c.charCodeAt(0));
    return blobToFile(new Blob([bin], { type: mime }), name, mime);
  } catch (e: any) {
    if (String(e?.message || e).toLowerCase().includes('cancel')) return null;
    console.warn('[capacitor] pickNativeFile', e);
    return null;
  }
}
