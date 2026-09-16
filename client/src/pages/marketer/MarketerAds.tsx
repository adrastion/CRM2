import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { apiService } from '../../services/api';

const TYPE_LABELS: Record<string, string> = {
  NEWS: 'Новость',
  PROMO: 'Акция',
  BANNER: 'Баннер',
  POSTER: 'Афиша',
  UPDATE: 'Обновление',
};

/** How many newest items stay open by default */
const DEFAULT_EXPANDED = 2;

const AuthImage: React.FC<{ id: string; hasImage: boolean; active: boolean }> = ({
  id,
  hasImage,
  active,
}) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!hasImage || !active) return;
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await apiService.downloadMarketerPublicationImageBlob(id);
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        revoked = u;
        setUrl(u);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id, hasImage, active]);
  if (!hasImage || !active || !url) return null;
  return (
    <Box
      component="img"
      src={url}
      alt=""
      sx={{
        mt: 1.5,
        display: 'block',
        width: '100%',
        maxHeight: 420,
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

const PublicationCard: React.FC<{
  item: any;
  expanded: boolean;
  onToggle: () => void;
}> = ({ item, expanded, onToggle }) => {
  const hasImage = Boolean(item.imageUrl);
  const hasFile = Boolean(item.fileUrl);
  const preview =
    item.body && String(item.body).length > 120
      ? `${String(item.body).slice(0, 120).trim()}…`
      : item.body;

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ pb: expanded ? 2 : 1.5 }}>
        <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="small" label={TYPE_LABELS[item.type] || item.type} />
              <Typography variant="caption" color="text.secondary">
                {new Date(item.publishedAt).toLocaleDateString('ru-RU')}
              </Typography>
              {!expanded && hasImage && (
                <Chip size="small" variant="outlined" label="Есть фото" />
              )}
              {!expanded && hasFile && (
                <Chip size="small" variant="outlined" label="Файл" />
              )}
            </Stack>
            <Typography sx={{ fontWeight: 600, mt: 1 }}>{item.title}</Typography>
          </Box>
          <IconButton
            size="small"
            onClick={onToggle}
            aria-label={expanded ? 'Свернуть' : 'Развернуть'}
            aria-expanded={expanded}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>

        {!expanded && preview && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {preview}
          </Typography>
        )}

        <Collapse in={expanded} timeout="auto" unmountOnExit={false}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {item.body}
          </Typography>
          <AuthImage id={item.id} hasImage={hasImage} active={expanded} />
        </Collapse>
      </CardContent>

      {(hasFile || !expanded) && (
        <CardActions sx={{ pt: 0, flexWrap: 'wrap', gap: 0.5 }}>
          {!expanded && (
            <Button size="small" sx={{ textTransform: 'none' }} onClick={onToggle}>
              Развернуть
            </Button>
          )}
          {expanded && hasFile && (
            <Button
              size="small"
              sx={{ textTransform: 'none' }}
              onClick={() =>
                void openBlob(() => apiService.downloadMarketerPublicationFileBlob(item.id))
              }
            >
              Скачать файл
            </Button>
          )}
          {expanded && (
            <Button size="small" sx={{ textTransform: 'none' }} onClick={onToggle}>
              Свернуть
            </Button>
          )}
        </CardActions>
      )}
    </Card>
  );
};

const MarketerAds: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [pubs, closing] = await Promise.all([
          apiService.getMarketerPublications(),
          apiService.getMarketerClosingDocs(),
        ]);
        setItems(pubs);
        setDocs(closing);
        setExpandedIds(new Set(pubs.slice(0, DEFAULT_EXPANDED).map((p: any) => p.id)));
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Реклама
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Материалы публикует платформа. Здесь — обновления, акции, баннеры и афиши. Старые
        публикации можно развернуть, чтобы посмотреть фото и вложения.
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {items.map((p) => (
          <Grid item xs={12} md={6} key={p.id}>
            <PublicationCard
              item={p}
              expanded={expandedIds.has(p.id)}
              onToggle={() => toggle(p.id)}
            />
          </Grid>
        ))}
        {items.length === 0 && (
          <Grid item xs={12}>
            <Typography color="text.secondary">Публикаций пока нет</Typography>
          </Grid>
        )}
      </Grid>

      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
        Закрывающие документы
      </Typography>
      <Stack spacing={1}>
        {docs.map((d) => (
          <Card key={d.id} variant="outlined">
            <CardContent
              sx={{
                py: 1.5,
                '&:last-child': { pb: 1.5 },
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{d.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {d.periodLabel || new Date(d.createdAt).toLocaleDateString('ru-RU')}
                </Typography>
              </Box>
              <Button
                sx={{ textTransform: 'none' }}
                onClick={() => void openBlob(() => apiService.downloadMarketerClosingDocBlob(d.id))}
              >
                Скачать
              </Button>
            </CardContent>
          </Card>
        ))}
        {docs.length === 0 && <Typography color="text.secondary">Документов нет</Typography>}
      </Stack>
    </Box>
  );
};

export default MarketerAds;
