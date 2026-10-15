import { colors } from '../../theme/tokens';

/** Локальная палитра чата поверх CRM-токенов (светлый мессенджер). */
export const chatTheme = {
  feedBg: '#E8EEF7',
  feedPattern: `radial-gradient(circle at 20% 20%, ${colors.primarySoft}55 0, transparent 42%),
    radial-gradient(circle at 80% 60%, ${colors.primarySoft}40 0, transparent 38%),
    linear-gradient(180deg, #E8EEF7 0%, ${colors.surface} 100%)`,
  outgoingBubble: colors.primary,
  outgoingText: colors.white,
  incomingBubble: colors.card,
  incomingText: colors.text,
  mention: colors.primary,
  listSelected: 'rgba(72, 128, 255, 0.12)',
  listHover: 'rgba(72, 128, 255, 0.06)',
  unreadPill: colors.primary,
  avatarBg: colors.primarySoft,
  avatarText: colors.primaryDark,
  composerBg: colors.card,
  pinBarBg: 'rgba(72, 128, 255, 0.08)',
  dateChipBg: 'rgba(32, 34, 36, 0.45)',
  dateChipText: colors.white,
  timeMutedOwn: 'rgba(255,255,255,0.75)',
  timeMutedOther: colors.textHint,
} as const;

export function chatInitials(title: string): string {
  const parts = String(title || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function formatChatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatChatListTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatDaySeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return 'Сегодня';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return 'Вчера';
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
