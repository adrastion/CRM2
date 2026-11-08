import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';
import { clearPublicSiteConfigCache } from '../../hooks/usePublicSiteConfig';
import {
  LANDING_VARIANTS,
  normalizeLandingVariant,
  type LandingVariant,
} from '../../content/landingContent';

type SocialLink = {
  key: string;
  label: string;
  url: string;
  enabled: boolean;
  sortOrder: number;
};

type FeedbackRow = {
  id: string;
  name?: string | null;
  contact?: string | null;
  body: string;
  status: string;
  createdAt: string;
};

/**
 * Настройки публичного сайта: вариант лендинга, соцсети, пожелания гостей.
 */
const SaPublicSiteTab: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [landingVariant, setLandingVariant] = useState<LandingVariant>('arena');
  const [feedbackFilter, setFeedbackFilter] = useState<'NEW' | 'READ' | 'ARCHIVED' | ''>('NEW');
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);

  const loadSettings = useCallback(async () => {
    const data = await apiService.adminGetPublicSiteSettings();
    setSocialLinks(data?.socialLinks || []);
    setLandingVariant(normalizeLandingVariant(data?.landingVariant));
  }, []);

  const loadFeedback = useCallback(async () => {
    const data = await apiService.adminListSiteFeedback(
      feedbackFilter ? { status: feedbackFilter } : undefined
    );
    setFeedback(data || []);
  }, [feedbackFilter]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadSettings(), loadFeedback()]);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [loadFeedback, loadSettings]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab === 1) void loadFeedback().catch(() => undefined);
  }, [feedbackFilter, loadFeedback, tab]);

  const saveSocials = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const data = await apiService.adminUpdatePublicSiteSettings({ socialLinks });
      setSocialLinks(data?.socialLinks || socialLinks);
      clearPublicSiteConfigCache();
      setSuccess('Соцсети сохранены');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const saveLandingVariant = async (next: LandingVariant) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const data = await apiService.adminUpdatePublicSiteSettings({ landingVariant: next });
      setLandingVariant(normalizeLandingVariant(data?.landingVariant || next));
      clearPublicSiteConfigCache();
      setSuccess(`Лендинг: ${LANDING_VARIANTS.find((v) => v.id === next)?.label || next}`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить вариант');
    } finally {
      setBusy(false);
    }
  };

  const updateLink = (idx: number, patch: Partial<SocialLink>) => {
    setSocialLinks((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const setFeedbackStatus = async (id: string, status: string) => {
    setBusy(true);
    setError('');
    try {
      await apiService.adminUpdateSiteFeedback(id, status);
      await loadFeedback();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось обновить');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Публичный сайт
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        Вариант лендинга, соцсети и пожелания гостей. Вкладка приложения — в «Мобильное приложение».
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Лендинг" />
        <Tab label="Соцсети" />
        <Tab label="Пожелания" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 2.5, maxWidth: 720 }}>
          <Typography fontWeight={700} gutterBottom>
            Вариант главной страницы
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Переключатель сохранён: активный вариант сразу на публичном `/`. Все варианты в фирменной
            палитре ПРОФСПОРТСРМ.
          </Typography>
          <Button
            size="small"
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mb: 2, textTransform: 'none', fontWeight: 700 }}
          >
            Открыть главную в новой вкладке
          </Button>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {LANDING_VARIANTS.map((v) => (
              <Box
                key={v.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: landingVariant === v.id ? 'primary.main' : 'divider',
                  bgcolor: landingVariant === v.id ? 'action.selected' : 'background.paper',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={800}>{v.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {v.blurb}
                  </Typography>
                </Box>
                <Button
                  variant={landingVariant === v.id ? 'contained' : 'outlined'}
                  disabled={busy || landingVariant === v.id}
                  onClick={() => void saveLandingVariant(v.id)}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {landingVariant === v.id ? 'Активен' : 'Выбрать'}
                </Button>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2.5, maxWidth: 720 }}>
          {socialLinks.map((link, idx) => (
            <Box
              key={link.key || idx}
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1.4fr auto' },
                alignItems: 'center',
                mb: 2,
              }}
            >
              <TextField
                size="small"
                label="Название"
                value={link.label}
                onChange={(e) => updateLink(idx, { label: e.target.value })}
              />
              <TextField
                size="small"
                label="URL"
                value={link.url}
                onChange={(e) => updateLink(idx, { url: e.target.value })}
                placeholder="https://"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={link.enabled}
                    onChange={(_, v) => updateLink(idx, { enabled: v })}
                  />
                }
                label="Вкл"
              />
            </Box>
          ))}
          <Button variant="contained" disabled={busy} onClick={() => void saveSocials()}>
            Сохранить соцсети
          </Button>
        </Paper>
      )}

      {tab === 2 && (
        <Box>
          <Tabs
            value={feedbackFilter}
            onChange={(_, v) => setFeedbackFilter(v)}
            sx={{ mb: 2 }}
          >
            <Tab value="NEW" label="Новые" />
            <Tab value="READ" label="Прочитанные" />
            <Tab value="ARCHIVED" label="Архив" />
            <Tab value="" label="Все" />
          </Tabs>
          {feedback.length === 0 ? (
            <Typography color="text.secondary">Пока пусто</Typography>
          ) : (
            feedback.map((row) => (
              <Paper key={row.id} sx={{ p: 2, mb: 1.5 }}>
                <Box display="flex" justifyContent="space-between" gap={1} flexWrap="wrap">
                  <Box>
                    <Typography fontWeight={700}>
                      {row.name || 'Гость'}
                      {row.contact ? ` · ${row.contact}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(row.createdAt).toLocaleString('ru-RU')}
                    </Typography>
                  </Box>
                  <Chip size="small" label={row.status} />
                </Box>
                <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{row.body}</Typography>
                <Box display="flex" gap={1} mt={1.5} flexWrap="wrap">
                  {row.status !== 'READ' && (
                    <Button size="small" disabled={busy} onClick={() => void setFeedbackStatus(row.id, 'READ')}>
                      Прочитано
                    </Button>
                  )}
                  {row.status !== 'ARCHIVED' && (
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() => void setFeedbackStatus(row.id, 'ARCHIVED')}
                    >
                      В архив
                    </Button>
                  )}
                  {row.status !== 'NEW' && (
                    <Button size="small" disabled={busy} onClick={() => void setFeedbackStatus(row.id, 'NEW')}>
                      Вернуть в новые
                    </Button>
                  )}
                </Box>
              </Paper>
            ))
          )}
        </Box>
      )}
    </Box>
  );
};

export default SaPublicSiteTab;
