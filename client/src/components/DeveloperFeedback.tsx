import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Add, InfoOutlined, KeyboardArrowUp, Lightbulb } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { apiService } from '../services/api';
import { colors, radii, typography } from '../theme/tokens';

export type FeatureIdeaSource = 'school' | 'portal' | 'marketer';

interface IdeaRow {
  id: string;
  title: string;
  body: string;
  status: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | string;
  statusLabel?: string;
  rejectReason?: string | null;
  createdAt: string;
}

type FilterKey = 'all' | 'reviewing' | 'planned' | 'rejected';

const STATUS_META: Record<string, { label: string; bg: string; color: string; filter: FilterKey }> = {
  SUBMITTED: { label: 'Рассматривается', bg: '#EAF0FF', color: '#2F6BFF', filter: 'reviewing' },
  ACCEPTED: { label: 'Запланировано', bg: '#E8F0FF', color: '#3B6EF5', filter: 'planned' },
  REJECTED: { label: 'Отклонено', bg: '#FDECEC', color: '#F93C65', filter: 'rejected' },
};

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Все идеи' },
  { key: 'reviewing', label: 'Рассматривается' },
  { key: 'planned', label: 'Запланировано' },
  { key: 'rejected', label: 'Отклонено' },
];

function formatIdeaDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU');
}

function statusMeta(status: string) {
  return STATUS_META[status] || STATUS_META.SUBMITTED;
}

interface DeveloperFeedbackProps {
  source?: FeatureIdeaSource;
  /** Показать ссылку на FAQ/помощь (школа). */
  helpHref?: string;
}

/**
 * «Связь с разработчиком» — внешний вид по референсу; функционал как раньше (мои идеи).
 */
const DeveloperFeedback: React.FC<DeveloperFeedbackProps> = ({ source = 'school', helpHref }) => {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.listMyFeatureIdeas(source);
      setIdeas(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить идеи');
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const base = { all: ideas.length, reviewing: 0, planned: 0, rejected: 0 };
    ideas.forEach((idea) => {
      const key = statusMeta(idea.status).filter;
      if (key !== 'all') base[key] += 1;
    });
    return base;
  }, [ideas]);

  const filtered = useMemo(() => {
    if (filter === 'all') return ideas;
    return ideas.filter((idea) => statusMeta(idea.status).filter === filter);
  }, [ideas, filter]);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = await apiService.createFeatureIdea(
        { title: title.trim(), body: body.trim() },
        source
      );
      setSuccess(result?.message || 'Идея принята, в ближайшее время мы рассмотрим ваше предложение');
      setTitle('');
      setBody('');
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отправить идею');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box data-onboarding="feedback-page" sx={{ width: '100%', maxWidth: 920 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'flex-start' },
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
          mb: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minWidth: 0 }}>
          <Box
            aria-hidden
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              bgcolor: '#FFF4E5',
              color: '#F5A623',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Lightbulb sx={{ fontSize: 26 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h1"
              sx={{
                fontWeight: 800,
                fontSize: { xs: typography.pageTitle.xs, md: typography.pageTitle.md },
                color: '#1B2438',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                mb: 0.75,
              }}
            >
              Связь с разработчиком
            </Typography>
            <Typography sx={{ fontSize: typography.label, color: colors.textMuted, lineHeight: 1.5, maxWidth: 560 }}>
              Здесь вы можете предложить идею по улучшению ProfSport CRM.
              <br />
              Мы внимательно рассматриваем все предложения и регулярно добавляем новые функции.
            </Typography>
          </Box>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setError('');
            setDialogOpen(true);
          }}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: `${radii.button}px`,
            bgcolor: colors.primary,
            boxShadow: '0 6px 16px rgba(47, 107, 255, 0.28)',
            px: 2.25,
            py: 1.15,
            whiteSpace: 'nowrap',
            alignSelf: { xs: 'stretch', sm: 'flex-start' },
            '&:hover': { bgcolor: colors.primaryDark },
          }}
        >
          Предложить идею
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: `${radii.panel}px` }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2, borderRadius: `${radii.panel}px` }}
          onClose={() => setSuccess('')}
        >
          {success}
        </Alert>
      )}

      <Tabs
        value={filter}
        onChange={(_, v) => setFilter(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2,
          minHeight: 42,
          borderBottom: `1px solid ${colors.divider}`,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 700,
            fontSize: typography.label,
            minHeight: 42,
            color: colors.textMuted,
          },
          '& .Mui-selected': { color: `${colors.primary} !important` },
          '& .MuiTabs-indicator': { bgcolor: colors.primary, height: 3, borderRadius: 2 },
        }}
      >
        {FILTERS.map((f) => (
          <Tab key={f.key} value={f.key} label={`${f.label} (${counts[f.key]})`} />
        ))}
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} sx={{ color: colors.primary }} />
        </Box>
      ) : filtered.length === 0 ? (
        <Box
          sx={{
            bgcolor: colors.card,
            borderRadius: `${radii.panel}px`,
            border: '1px solid #EEF1F6',
            boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
            p: 4,
            textAlign: 'center',
            mb: 2.5,
          }}
        >
          <Typography sx={{ fontWeight: 700, color: colors.text, mb: 0.5 }}>Пока нет идей</Typography>
          <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
            Предложите улучшение — мы рассмотрим его в ближайшее время.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 2.5 }}>
          {filtered.map((idea) => {
            const meta = statusMeta(idea.status);
            return (
              <Box
                key={idea.id}
                sx={{
                  bgcolor: colors.card,
                  borderRadius: `${radii.panel}px`,
                  border: '1px solid #EEF1F6',
                  boxShadow: '0 4px 18px rgba(32, 34, 36, 0.05)',
                  p: { xs: 1.5, md: 2 },
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: { xs: 1.25, md: 2 },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 48,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: colors.surface,
                    borderRadius: '12px',
                    py: 1.1,
                    color: colors.textHint,
                  }}
                >
                  <KeyboardArrowUp sx={{ fontSize: 22 }} />
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: { xs: 14, md: 15 },
                      color: colors.text,
                      lineHeight: 1.3,
                      mb: 0.4,
                    }}
                  >
                    {idea.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: typography.label,
                      color: colors.textMuted,
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {idea.body}
                  </Typography>
                  {idea.status === 'REJECTED' && idea.rejectReason && (
                    <Typography sx={{ mt: 0.75, fontSize: typography.hint, color: colors.danger }}>
                      Причина: {idea.rejectReason}
                    </Typography>
                  )}
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-end', sm: 'center' },
                    gap: { xs: 0.75, sm: 1.5 },
                    flexShrink: 0,
                  }}
                >
                  <Chip
                    size="small"
                    label={idea.statusLabel || meta.label}
                    sx={{
                      height: 26,
                      fontWeight: 700,
                      fontSize: 12,
                      bgcolor: meta.bg,
                      color: meta.color,
                      borderRadius: `${radii.pill}px`,
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: typography.hint,
                      color: colors.textHint,
                      whiteSpace: 'nowrap',
                      minWidth: { sm: 78 },
                      textAlign: 'right',
                    }}
                  >
                    {formatIdeaDate(idea.createdAt)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Box
        sx={{
          bgcolor: '#EEF4FF',
          border: '1px solid #D9E6FF',
          borderRadius: `${radii.panel}px`,
          p: { xs: 1.75, md: 2 },
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            bgcolor: colors.primary,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <InfoOutlined sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.text, mb: 0.35 }}>
            Здесь только идеи по улучшению системы
          </Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, lineHeight: 1.5 }}>
            Если у вас техническая проблема или вопрос по работе системы — обратитесь в поддержку
            {helpHref ? (
              <>
                {' '}
                через раздел{' '}
                <Box
                  component={RouterLink}
                  to={helpHref}
                  sx={{ color: colors.primary, fontWeight: 700, textDecoration: 'none' }}
                >
                  «Помощь»
                </Box>
                .
              </>
            ) : (
              '.'
            )}
          </Typography>
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>Предложить идею</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Заголовок"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            fullWidth
            label="Описание идеи"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            multiline
            minRows={4}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSubmit()}
            disabled={saving || !title.trim() || !body.trim()}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: colors.primary,
              '&:hover': { bgcolor: colors.primaryDark },
            }}
          >
            {saving ? <CircularProgress size={22} color="inherit" /> : 'Отправить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeveloperFeedback;
