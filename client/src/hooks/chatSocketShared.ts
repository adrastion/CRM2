import { io, Socket } from 'socket.io-client';
import { getWsBaseUrl } from '../utils/getWsBaseUrl';

/**
 * Общий Socket.IO `/chat` на вкладку: бейдж непрочитанных и ChatWorkspace
 * не открывают два независимых соединения.
 */
let shared: Socket | null = null;
let sharedToken: string | null = null;
let refs = 0;

export function acquireChatSocket(token: string): Socket {
  if (shared && sharedToken === token) {
    refs += 1;
    return shared;
  }

  if (shared) {
    shared.removeAllListeners();
    shared.disconnect();
    shared = null;
    sharedToken = null;
    refs = 0;
  }

  shared = io(`${getWsBaseUrl()}/chat`, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  sharedToken = token;
  refs = 1;
  return shared;
}

export function releaseChatSocket(socket?: Socket | null): void {
  if (!shared) return;
  if (socket && socket !== shared) return;
  refs = Math.max(0, refs - 1);
  if (refs === 0) {
    shared.removeAllListeners();
    shared.disconnect();
    shared = null;
    sharedToken = null;
  }
}
