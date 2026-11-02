import { REALTIME_EVENT, type RealtimeEvent } from './types';

export function dispatchRealtimeEvent(event: RealtimeEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail: event }));
}

export function onRealtimeEvent(
  listener: (event: RealtimeEvent) => void
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<RealtimeEvent>).detail;
    if (detail) listener(detail);
  };
  window.addEventListener(REALTIME_EVENT, handler);
  return () => window.removeEventListener(REALTIME_EVENT, handler);
}
