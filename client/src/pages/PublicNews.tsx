import React, { useEffect, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, Container, Paper, Typography } from '@mui/material';
import PublicSiteNav from '../components/PublicSiteNav';
import PublicFooter from '../components/PublicFooter';
import { apiService } from '../services/api';
import { colors, radii } from '../theme/tokens';
import { TAG_META, inferNewsTag } from '../components/news/newsTags';

type NewsItem = {
  id: string;
  title: string;
  body: string;
  tag?: string | null;
  imageUrl?: string | null;
  publishedAt: string;
  createdAt?: string;
};

/** Публичная лента новостей платформы. */
const PublicNews: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        setItems((await apiService.getPublicNews()) || []);
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Не удалось загрузить новости');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: colors.surface }}>
      <PublicSiteNav />
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 }, flex: 1 }}>
        <Typography
          component="h1"
          sx={{ fontWeight: 800, fontSize: { xs: 28, md: 36 }, mb: 1, color: colors.text }}
        >
          Новости
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Обновления платформы ПРОФСПОРТСРМ для спортивных секций
        </Typography>

        {loading && (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && items.length === 0 && (
          <Typography color="text.secondary">Пока нет опубликованных новостей</Typography>
        )}

        {items.map((item) => {
          const tag = inferNewsTag({
            ...item,
            createdAt: item.createdAt || item.publishedAt,
          });
          const meta = TAG_META[tag];
          return (
            <Paper
              key={item.id}
              elevation={0}
              sx={{
                p: { xs: 2, md: 2.5 },
                mb: 2,
                borderRadius: `${radii.panel}px`,
                border: `1px solid ${colors.divider}`,
              }}
            >
              <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" mb={1}>
                <Chip
                  size="small"
                  label={meta.label}
                  sx={{ height: 22, fontWeight: 800, bgcolor: meta.bg, color: meta.color }}
                />
                <Typography variant="caption" color="text.secondary">
                  {new Date(item.publishedAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Typography>
              </Box>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
                {item.title}
              </Typography>
              {item.imageUrl && (
                <Box
                  component="img"
                  src={apiService.getPublicNewsImageUrl(item.id)}
                  alt=""
                  sx={{
                    width: '100%',
                    maxHeight: 320,
                    objectFit: 'cover',
                    borderRadius: 2,
                    mb: 1.5,
                  }}
                />
              )}
              <Typography sx={{ whiteSpace: 'pre-wrap', color: colors.textMuted }}>{item.body}</Typography>
            </Paper>
          );
        })}
      </Container>
      <PublicFooter />
    </Box>
  );
};

export default PublicNews;
