import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import { apiService } from '../services/api';
import { colors, radii } from '../theme/tokens';

export type PlatformNewsSource = 'school' | 'sa' | 'portal' | 'marketer';

export interface PlatformNewsEntry {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  /** new | important | security | update */
  tag?: string | null;
  imageUrl?: string | null;
  fileUrl?: string | null;
  audienceRoles?: string[];
  createdBy?: { firstName?: string; lastName?: string; email?: string };
}

export const AuthNewsImage: React.FC<{
  id: string;
  hasImage: boolean;
  source: PlatformNewsSource;
  /** Стили картинки (лента / миниатюра карточки). */
  imgSx?: object;
  /** Скрыть текст ошибки (для компактного превью). */
  silentFail?: boolean;
}> = ({ id, hasImage, source, imgSx, silentFail }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!hasImage) return;
    let revoked: string | null = null;
    let cancelled = false;
    setFailed(false);
    setUrl(null);
    (async () => {
      try {
        const blob = await apiService.downloadPlatformNewsImageBlob(id, source);
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        revoked = u;
        setUrl(u);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id, hasImage, source]);
  if (!hasImage) return null;
  if (failed) {
    if (silentFail) return null;
    return (
      <Typography variant="caption" color="error" sx={{ mt: 1.5, display: 'block' }}>
        Не удалось загрузить изображение
      </Typography>
    );
  }
  if (!url) return null;
  return (
    <Box
      component="img"
      src={url}
      alt=""
      sx={{
        mt: 1.5,
        display: 'block',
        width: '100%',
        maxHeight: 480,
        height: 'auto',
        objectFit: 'contain',
        borderRadius: `${radii.cell}px`,
        bgcolor: colors.surface,
        ...imgSx,
      }}
    />
  );
};

async function openBlob(loader: () => Promise<Blob>) {
  const blob = await loader();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export const ROLE_LABELS_NEWS: Record<string, string> = {
  SUPER_ADMIN: 'Супер-админ',
  TESTER: 'Тестировщик',
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  TRAINER: 'Тренер',
  PROMOTER: 'Промоутер',
  CLIENT: 'Клиент',
  PARENT: 'Родитель',
  MARKETER: 'Маркетолог',
  PLATFORM_STAFF: 'Сотрудник платформы',
  PROMO_CODE_ADMIN: 'Админ промокодов',
};

interface PlatformNewsFeedProps {
  /** Как загружать список. */
  loadEntries: () => Promise<PlatformNewsEntry[]>;
  /** Источник для скачивания вложений. */
  source: PlatformNewsSource;
  /** Показывать чипы аудитории (для SA). */
  showAudience?: boolean;
  /** Показывать автора — только кабинет супер-админа. */
  showAuthor?: boolean;
  emptyText?: string;
}

/**
 * Лента новостей платформы в стиле вертикальной ленты (карточки вниз).
 */
const BODY_PREVIEW_LEN = 160;

export const formatNewsDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/** Дата/время как на макете ленты: 16.10.2026, 06:23 */
export const formatNewsDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
};

const PlatformNewsFeed: React.FC<PlatformNewsFeedProps> = ({
  loadEntries,
  source,
  showAudience = false,
  showAuthor = false,
  emptyText = 'Пока нет новостей',
}) => {
  const [entries, setEntries] = useState<PlatformNewsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await loadEntries();
        if (!cancelled) setEntries(data || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить новости');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadEntries]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress sx={{ color: colors.primary }} />
      </Box>
    );
  }

  const isRecent = (createdAt: string) => {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    return ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000;
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', width: '100%', pb: { xs: 10, md: 2 } }}>
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: `${radii.panel}px` }}
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}
      {entries.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: `${radii.panel}px`,
            border: `1px solid ${colors.divider}`,
            bgcolor: colors.card,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: colors.textEmpty }}>{emptyText}</Typography>
        </Paper>
      ) : (
        entries.map((e) => {
          const expanded = Boolean(expandedIds[e.id]);
          const needsTruncate = (e.body || '').length > BODY_PREVIEW_LEN;
          const bodyText =
            expanded || !needsTruncate
              ? e.body
              : `${(e.body || '').slice(0, BODY_PREVIEW_LEN).trim()}…`;

          return (
            <Paper
              key={e.id}
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                mb: 2,
                border: `1px solid ${colors.divider}`,
                borderRadius: `${radii.panel}px`,
                bgcolor: colors.card,
                boxShadow: '0 2px 10px rgba(32, 34, 36, 0.05)',
              }}
            >
              {isRecent(e.createdAt) && (
                <Chip
                  label="НОВОЕ"
                  size="small"
                  sx={{
                    mb: 1.25,
                    height: 24,
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    borderRadius: `${radii.pill}px`,
                    bgcolor: colors.primarySoft,
                    color: colors.primaryDark,
                  }}
                />
              )}
              <Typography
                variant="h6"
                sx={{ mb: 0.75, fontWeight: 800, color: colors.text, fontSize: { xs: 16, sm: 18 } }}
              >
                {e.title}
              </Typography>
              {showAuthor && e.createdBy && (
                <Typography variant="caption" display="block" sx={{ mb: 1, color: colors.textHint }}>
                  {[e.createdBy.lastName, e.createdBy.firstName].filter(Boolean).join(' ') ||
                    e.createdBy.email}
                </Typography>
              )}
              {showAudience && e.audienceRoles && e.audienceRoles.length > 0 && (
                <Typography
                  variant="caption"
                  display="block"
                  sx={{ mb: 1, color: colors.textHint }}
                >
                  Аудитория:{' '}
                  {e.audienceRoles.map((r) => ROLE_LABELS_NEWS[r] || r).join(', ')}
                </Typography>
              )}
              <Typography sx={{ whiteSpace: 'pre-wrap', color: colors.textMuted, lineHeight: 1.6 }}>
                {bodyText}
              </Typography>
              {(expanded || !needsTruncate) && (
                <AuthNewsImage id={e.id} hasImage={Boolean(e.imageUrl)} source={source} />
              )}
              {(expanded || !needsTruncate) && e.fileUrl && (
                <Button
                  size="small"
                  startIcon={<Download />}
                  sx={{
                    mt: 1.5,
                    textTransform: 'none',
                    borderRadius: `${radii.button}px`,
                    color: colors.primary,
                    fontWeight: 600,
                  }}
                  onClick={() =>
                    void openBlob(() => apiService.downloadPlatformNewsFileBlob(e.id, source))
                  }
                >
                  Скачать файл
                </Button>
              )}
              <Box
                sx={{
                  mt: 1.75,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Typography sx={{ fontSize: 12, color: colors.textHint }}>
                  {formatNewsDate(e.createdAt)}
                </Typography>
                {needsTruncate && (
                  <Button
                    size="small"
                    onClick={() =>
                      setExpandedIds((prev) => ({ ...prev, [e.id]: !prev[e.id] }))
                    }
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      color: colors.primary,
                      minWidth: 0,
                      px: 0,
                      '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                    }}
                  >
                    {expanded ? 'Свернуть ←' : 'Подробнее →'}
                  </Button>
                )}
              </Box>
            </Paper>
          );
        })
      )}
    </Box>
  );
};

export default PlatformNewsFeed;
