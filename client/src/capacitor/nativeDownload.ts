import { isNativeApp } from './platform';

function sanitizeFilename(name: string): string {
  const cleaned = String(name || 'file')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim();
  return cleaned || 'file';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

function webDownloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/**
 * Сохранить файл в приложении (APK): пишет в Cache и открывает системный Share/«Сохранить».
 * В браузере — обычный download через &lt;a&gt;.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const safeName = sanitizeFilename(filename);
  if (!isNativeApp()) {
    webDownloadBlob(blob, safeName);
    return;
  }

  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');

  const base64 = await blobToBase64(blob);
  const path = `downloads/${Date.now()}_${safeName}`;

  await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  });

  await Share.share({
    title: safeName,
    files: [uri],
    dialogTitle: 'Сохранить файл',
  });
}

/** Скачать по URL (с cookies/токеном в query) без открытия браузера. */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const safeName = sanitizeFilename(filename);
  if (!isNativeApp()) {
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Не удалось скачать файл (${res.status})`);
  }
  const blob = await res.blob();
  await downloadBlob(blob, safeName);
}
