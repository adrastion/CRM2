import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../services/api';

export type FeatureIdeaSource = 'school' | 'portal' | 'marketer';

interface IdeaRow {
  id: string;
  title: string;
  body: string;
  status: string;
  statusLabel?: string;
  rejectReason?: string | null;
  createdAt: string;
}

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  SUBMITTED: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'error',
};

interface DeveloperFeedbackProps {
  source?: FeatureIdeaSource;
}

/**
 * Форма «Связь с разработчиком» + список своих идей.
 */
const DeveloperFeedback: React.FC<DeveloperFeedbackProps> = ({ source = 'school' }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
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
    load();
  }, [load]);

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
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отправить идею');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box data-onboarding="feedback-page" sx={{ maxWidth: 720 }}>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Опишите пожелание по изменению CRM. Мы рассмотрим предложение и сообщим о решении.
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

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          label="Заголовок"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mb: 2 }}
          inputProps={{ maxLength: 200 }}
        />
        <TextField
          fullWidth
          label="Описание идеи"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          multiline
          minRows={4}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !title.trim() || !body.trim()}
        >
          {saving ? <CircularProgress size={22} /> : 'Отправить'}
        </Button>
      </Paper>

      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
        Мои идеи
      </Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : ideas.length === 0 ? (
        <Typography color="text.secondary">Пока нет отправленных идей</Typography>
      ) : (
        ideas.map((idea) => (
          <Paper key={idea.id} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
            <Box display="flex" justifyContent="space-between" gap={1} alignItems="flex-start">
              <Typography fontWeight={700}>{idea.title}</Typography>
              <Chip
                size="small"
                color={STATUS_COLOR[idea.status] || 'default'}
                label={idea.statusLabel || idea.status}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              {new Date(idea.createdAt).toLocaleString('ru-RU')}
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{idea.body}</Typography>
            {idea.status === 'REJECTED' && idea.rejectReason && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Причина: {idea.rejectReason}
                </Typography>
              </>
            )}
          </Paper>
        ))
      )}
    </Box>
  );
};

export default DeveloperFeedback;
