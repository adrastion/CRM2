import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RELOAD_KEY = 'crm2_chunk_reload';

function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '');
  return /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    msg
  );
}

/**
 * React.lazy с повтором при обрыве сети / устаревшем chunk после деплоя.
 * После исчерпания попыток — однократный reload вкладки (типичный фикс для мобильных).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const mod = await factory();
        try {
          sessionStorage.removeItem(RELOAD_KEY);
        } catch {
          /* ignore */
        }
        return mod;
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    }

    if (isChunkLoadError(lastError) && typeof window !== 'undefined') {
      try {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, '1');
          window.location.reload();
          return new Promise(() => {
            /* ждём reload */
          });
        }
      } catch {
        /* ignore */
      }
    }

    throw lastError;
  });
}
