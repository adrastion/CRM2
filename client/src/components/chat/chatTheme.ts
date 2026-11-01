import { colors } from '../../theme/tokens';

/** Локальная палитра чата поверх CRM-токенов (светлый мессенджер, макет Чаты). */
export const chatTheme = {
  feedBg: '#F3F6FB',
  feedPattern: `radial-gradient(circle at 18% 12%, ${colors.primarySoft}40 0, transparent 40%),
    radial-gradient(circle at 82% 70%, rgba(191, 211, 255, 0.35) 0, transparent 36%),
    linear-gradient(180deg, #F3F6FB 0%, #EEF2F8 100%)`,
  /** Исходящие — светло-голубые, тёмный текст (как в макете) */
  outgoingBubble: '#DCE8FF',
  outgoingText: '#1B2438',
  incomingBubble: colors.card,
  incomingText: colors.text,
  mention: colors.primary,
  listSelected: '#EAF0FF',
  listHover: 'rgba(72, 128, 255, 0.06)',
  listCardBorder: '#EEF1F6',
  unreadPill: colors.primary,
  avatarBg: colors.primarySoft,
  avatarText: colors.primaryDark,
  typeChipBg: '#EEE8FF',
  typeChipText: '#6B5CE0',
  composerBg: colors.card,
  pinBarBg: 'rgba(72, 128, 255, 0.08)',
  dateChipBg: 'rgba(32, 34, 36, 0.55)',
  dateChipText: colors.white,
  timeMutedOwn: '#6B7280',
  timeMutedOther: colors.textHint,
  checkOwn: colors.primary,
  recDot: colors.danger,
  lockPillBg: 'rgba(32, 34, 36, 0.78)',
  recordBtn: colors.primary,
  fab: colors.primary,
} as const;

const AVATAR_PALETTE = [
  { bg: '#D6E4FF', fg: '#2F6BFF' },
  { bg: '#E8D5FF', fg: '#7B3FE4' },
  { bg: '#D5F5E8', fg: '#0D9F6E' },
  { bg: '#FFE4CC', fg: '#D97706' },
  { bg: '#FFD6E5', fg: '#DB2777' },
  { bg: '#D5F0FF', fg: '#0284C7' },
  { bg: '#FFF0C2', fg: '#B45309' },
  { bg: '#E2E8F0', fg: '#475569' },
] as const;

const AUTHOR_NAME_COLORS = [
  '#7B3FE4',
  '#DB2777',
  '#0284C7',
  '#0D9F6E',
  '#D97706',
  '#2F6BFF',
  '#C026D3',
] as const;

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function chatAvatarColors(seed: string): { bg: string; fg: string } {
  const i = hashStr(String(seed || '?')) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[i];
}

export function chatAuthorNameColor(seed: string): string {
  const i = hashStr(String(seed || '?')) % AUTHOR_NAME_COLORS.length;
  return AUTHOR_NAME_COLORS[i];
}

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

/** Как в макете: «Сегодня, 26 апреля 2026» */
export function formatDaySeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const datePart = d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `Сегодня, ${datePart}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return `Вчера, ${datePart}`;
  return datePart;
}

export function threadTypeLabel(type: string): string | null {
  if (type === 'STAFF_TASK') return 'Задача';
  if (type === 'GROUP' || type === 'TRAINERS') return 'Группа';
  if (
    type === 'CLIENT_ADMIN' ||
    type === 'CLIENT_TRAINER' ||
    type === 'TRAINER_ADMIN' ||
    type === 'DIRECT' ||
    type === 'SA_DIRECT'
  ) {
    return 'Личное';
  }
  return null;
}
