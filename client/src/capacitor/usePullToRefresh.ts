import { useEffect, useRef } from 'react';
import { isNativeApp } from './platform';
import { registerPullRefreshHandler } from './pullRefresh';

/**
 * Подписка вкладки на свайп вниз в APK.
 * На вебе no-op.
 */
export function usePullToRefresh(
  onRefresh: () => void | Promise<void>,
  enabled = true
): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || !isNativeApp()) return;
    return registerPullRefreshHandler(() => onRefreshRef.current());
  }, [enabled]);
}
