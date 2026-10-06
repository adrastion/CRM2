import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import { apiService } from '../services/api';

export type PlatformNewsSource = 'school' | 'sa' | 'portal' | 'marketer';

export interface PlatformNewsEntry {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
  audienceRoles?: string[];
  createdBy?: { firstName?: string; lastName?: string; email?: string };
}

const AuthNewsImage: React.FC<{
  id: string;
  hasImage: boolean;
  source: PlatformNewsSource;
}> = ({ id, hasImage, source }) => {
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
        borderRadius: 1,
        bgcolor: 'action.hover',
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
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {entries.length === 0 ? (
        <Typography color="text.secondary">{emptyText}</Typography>
      ) : (
        entries.map((e) => (
          <Paper
            key={e.id}
            elevation={0}
            sx={{
              p: 2.5,
              mb: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
              {e.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              {new Date(e.createdAt).toLocaleString('ru-RU')}
              {showAuthor && e.createdBy
                ? ` · ${
                    [e.createdBy.lastName, e.createdBy.firstName].filter(Boolean).join(' ') ||
                    e.createdBy.email
                  }`
                : ''}
            </Typography>
            {showAudience && e.audienceRoles && e.audienceRoles.length > 0 && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Аудитория:{' '}
                {e.audienceRoles.map((r) => ROLE_LABELS_NEWS[r] || r).join(', ')}
              </Typography>
            )}
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{e.body}</Typography>
            <AuthNewsImage id={e.id} hasImage={Boolean(e.imageUrl)} source={source} />
            {e.fileUrl && (
              <Button
                size="small"
                startIcon={<Download />}
                sx={{ mt: 1.5, textTransform: 'none' }}
                onClick={() =>
                  void openBlob(() => apiService.downloadPlatformNewsFileBlob(e.id, source))
                }
              >
                Скачать файл
              </Button>
            )}
          </Paper>
        ))
      )}
    </Box>
  );
};

export default PlatformNewsFeed;
