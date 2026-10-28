import {
  CampaignOutlined,
  PhoneIphoneOutlined,
  SecurityOutlined,
  SystemUpdateAltOutlined,
} from '@mui/icons-material';
import type { ElementType } from 'react';

export type NewsTag = 'new' | 'important' | 'security' | 'update';

export const NEWS_TAGS: NewsTag[] = ['new', 'important', 'security', 'update'];

export const TAG_META: Record<
  NewsTag,
  { label: string; bg: string; color: string; Icon: ElementType; artBg: string }
> = {
  new: {
    label: 'НОВОЕ',
    bg: '#E8F0FF',
    color: '#2F6BFF',
    Icon: PhoneIphoneOutlined,
    artBg: 'linear-gradient(145deg, #E8F0FF 0%, #D6E4FF 100%)',
  },
  important: {
    label: 'ВАЖНОЕ',
    bg: '#F3EEFF',
    color: '#7C5CFC',
    Icon: CampaignOutlined,
    artBg: 'linear-gradient(145deg, #F3EEFF 0%, #E8E0FF 100%)',
  },
  security: {
    label: 'БЕЗОПАСНОСТЬ',
    bg: '#E6F8F3',
    color: '#00B69B',
    Icon: SecurityOutlined,
    artBg: 'linear-gradient(145deg, #E6F8F3 0%, #D4F3EA 100%)',
  },
  update: {
    label: 'ОБНОВЛЕНИЕ',
    bg: '#E8F8F2',
    color: '#12B76A',
    Icon: SystemUpdateAltOutlined,
    artBg: 'linear-gradient(145deg, #E8F8F2 0%, #D4F3E5 100%)',
  },
};

export function parseNewsTag(raw: unknown): NewsTag | null {
  const v = String(raw || '').trim().toLowerCase();
  if ((NEWS_TAGS as string[]).includes(v)) return v as NewsTag;
  return null;
}

const isRecent = (createdAt: string) => {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000;
};

/** Fallback для старых записей без tag. */
export function inferNewsTag(entry: {
  title?: string;
  body?: string;
  createdAt: string;
  tag?: string | null;
}): NewsTag {
  const stored = parseNewsTag(entry.tag);
  if (stored) return stored;
  const t = `${entry.title || ''} ${entry.body || ''}`.toLowerCase();
  if (/2fa|двухфактор|защит|безопасност|парол|qr.?код|код из письм|push/.test(t)) {
    return 'security';
  }
  if (/техническ|работ|обслуживан|недоступ|перерыв|миграц|важно|срочн|ошибк/.test(t)) {
    return 'important';
  }
  if (isRecent(entry.createdAt)) return 'new';
  return 'update';
}
