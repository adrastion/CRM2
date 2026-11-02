import { useEffect, useRef } from 'react';
import { onRealtimeEvent } from './dispatch';
import type { RealtimeEntity, RealtimeEvent } from './types';

/**
 * Подписка на доменные realtime-события. Колбэк дебаунсится, чтобы пачка
 * изменений с другого устройства не устроила шторм refetch.
 */
export function useRealtimeSubscription(
  entities: RealtimeEntity | RealtimeEntity[],
  onEvent: (event: RealtimeEvent) => void,
  opts?: { debounceMs?: number; enabled?: boolean }
): void {
  const list = Array.isArray(entities) ? entities : [entities];
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const debounceMs = opts?.debounceMs ?? 400;
  const enabled = opts?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    const wanted = new Set(list);
    let timer: number | null = null;
    let pending: RealtimeEvent | null = null;

    const flush = () => {
      timer = null;
      const ev = pending;
      pending = null;
      if (ev) onEventRef.current(ev);
    };

    return onRealtimeEvent((event) => {
      if (!wanted.has(event.entity)) return;
      pending = event;
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(flush, debounceMs);
    });
  }, [enabled, debounceMs, list.join('|')]);
}
