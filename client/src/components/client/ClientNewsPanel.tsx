import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
  ArticleOutlined,
  CampaignOutlined,
  Download,
  PhoneIphoneOutlined,
  SecurityOutlined,
  SystemUpdateAltOutlined,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import {
  AuthNewsImage,
  formatNewsDate,
  PlatformNewsEntry,
} from '../PlatformNewsFeed';
import { colors, radii, typography } from '../../theme/tokens';

type NewsTag = 'new' | 'important' | 'security' | 'update';

const TAG_META: Record<
  NewsTag,
  { label: string; bg: string; color: string; Icon: React.ElementType; artBg: string }
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

const BODY_PREVIEW = 140;

const isRecent = (createdAt: string) => {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000;
};

const inferTag = (entry: PlatformNewsEntry): NewsTag => {
  const t = `${entry.title || ''} ${entry.body || ''}`.toLowerCase();
  if (/2fa|двухфактор|защит|безопасност|парол|qr.?код|код из письм|push/.test(t)) {
    return 'security';
  }
  if (/техническ|работ|обслуживан|недоступ|перерыв|миграц|важно|срочн|ошибк/.test(t)) {
    return 'important';
  }
  if (isRecent(entry.createdAt)) return 'new';
  return 'update';
};

async function openBlob(loader: () => Promise<Blob>) {
  const blob = await loader();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/**
 * Вкладка «Новости» ЛК ученика — макет Reference LK clients/Новости.png
 */
const ClientNewsPanel: React.FC = () => {
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
        const data = await apiService.listPortalNews();
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
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={32} sx={{ color: colors.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', maxWidth: 920 }}>
      {error && (
        <Alert
          severity="error"
          sx={{ borderRadius: `${radii.panel}px` }}
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}

      {entries.length === 0 ? (
        <Box
          sx={{
            bgcolor: colors.card,
            borderRadius: `${radii.panel}px`,
            boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
            border: '1px solid #EEF1F6',
            p: { xs: 3, md: 4 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '18px',
              bgcolor: '#E8F0FF',
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <ArticleOutlined sx={{ fontSize: 36 }} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.text, mb: 0.5 }}>
            Пока нет новостей
          </Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, maxWidth: 360 }}>
            Когда появятся обновления платформы, они отобразятся здесь.
          </Typography>
        </Box>
      ) : (
        entries.map((entry) => {
          const tag = inferTag(entry);
          const meta = TAG_META[tag];
          const Icon = meta.Icon;
          const expanded = Boolean(expandedIds[entry.id]);
          const needsTruncate = (entry.body || '').length > BODY_PREVIEW;
          const bodyText =
            expanded || !needsTruncate
              ? entry.body
              : `${(entry.body || '').slice(0, BODY_PREVIEW).trim()}…`;

          return (
            <Box
              key={entry.id}
              sx={{
                bgcolor: colors.card,
                borderRadius: `${radii.panel}px`,
                boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
                border: '1px solid #EEF1F6',
                p: { xs: 2, md: 2.25 },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: { xs: 2, sm: 2.5 },
                alignItems: { xs: 'stretch', sm: 'flex-start' },
              }}
            >
              <Box
                aria-hidden={!entry.imageUrl}
                sx={{
                  width: { xs: '100%', sm: 148 },
                  minWidth: { sm: 148 },
                  height: { xs: 140, sm: 132 },
                  borderRadius: '14px',
                  background: meta.artBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {entry.imageUrl ? (
                  <AuthNewsImage
                    id={entry.id}
                    hasImage
                    source="portal"
                    silentFail
                    imgSx={{
                      mt: 0,
                      width: '100%',
                      height: '100%',
                      maxHeight: 'none',
                      objectFit: 'cover',
                      borderRadius: 0,
                      bgcolor: 'transparent',
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '16px',
                      bgcolor: colors.card,
                      color: meta.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px rgba(27, 36, 56, 0.08)',
                    }}
                  >
                    <Icon sx={{ fontSize: 32 }} />
                  </Box>
                )}
              </Box>

              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <Chip
                  size="small"
                  label={meta.label}
                  sx={{
                    alignSelf: 'flex-start',
                    height: 24,
                    mb: 1,
                    fontWeight: 800,
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    borderRadius: `${radii.pill}px`,
                    bgcolor: meta.bg,
                    color: meta.color,
                  }}
                />
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: 15, md: 17 },
                    color: colors.text,
                    lineHeight: 1.3,
                    mb: 0.75,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {entry.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: typography.label,
                    color: colors.textMuted,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    mb: 1.25,
                    flex: 1,
                  }}
                >
                  {bodyText}
                </Typography>

                {expanded && entry.fileUrl && (
                  <Button
                    size="small"
                    startIcon={<Download />}
                    sx={{
                      alignSelf: 'flex-start',
                      mb: 1,
                      textTransform: 'none',
                      borderRadius: `${radii.button}px`,
                      color: colors.primary,
                      fontWeight: 600,
                    }}
                    onClick={() =>
                      void openBlob(() => apiService.downloadPlatformNewsFileBlob(entry.id, 'portal'))
                    }
                  >
                    Скачать файл
                  </Button>
                )}

                <Box
                  sx={{
                    mt: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
                    {formatNewsDate(entry.createdAt)}
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
                    onClick={() =>
                      setExpandedIds((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))
                    }
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: typography.label,
                      color: colors.primary,
                      bgcolor: '#EAF0FF',
                      borderRadius: `${radii.button}px`,
                      px: 1.5,
                      py: 0.75,
                      minWidth: 0,
                      '&:hover': { bgcolor: '#DCE7FF' },
                      '& .MuiButton-endIcon': { ml: 0.5 },
                    }}
                  >
                    {expanded ? 'Свернуть' : 'Подробнее'}
                  </Button>
                </Box>
              </Box>
            </Box>
          );
        })
      )}
    </Box>
  );
};

export default ClientNewsPanel;
