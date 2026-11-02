type PullHandler = () => void | Promise<void>;

const handlers = new Set<PullHandler>();

/** Регистрация обработчика свайпа вниз (страница сама рефетчит данные). */
export function registerPullRefreshHandler(handler: PullHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export async function runPullRefreshHandlers(): Promise<boolean> {
  const list = Array.from(handlers);
  if (list.length === 0) return false;
  await Promise.all(
    list.map(async (h) => {
      try {
        await h();
      } catch (e) {
        console.warn('[pull-refresh] handler failed', e);
      }
    })
  );
  return true;
}

/** true, если жест начался у верхнего края скролла (можно тянуть refresh). */
export function isScrollAtTop(startTarget: EventTarget | null): boolean {
  if (typeof window === 'undefined') return true;
  const winY = window.scrollY || document.documentElement.scrollTop || 0;
  if (winY > 2) return false;

  let el: HTMLElement | null =
    startTarget instanceof HTMLElement ? startTarget : null;
  while (el) {
    const style = window.getComputedStyle(el);
    const oy = style.overflowY;
    const scrollable =
      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
      el.scrollHeight > el.clientHeight + 1;
    if (scrollable && el.scrollTop > 2) return false;
    el = el.parentElement;
  }
  return true;
}
