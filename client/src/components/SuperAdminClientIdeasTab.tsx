import React, { useCallback, useEffect, useState } from 'react';
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
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../services/api';

type FilterStatus = '' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';

interface IdeaAdminRow {
  id: string;
  title: string;
  body: string;
  status: string;
  actorType: string;
  authorName?: string | null;
  authorEmail?: string | null;
  tenantName?: string | null;
  rejectReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  devNote?: { id: string; title: string; status: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Новые',
  ACCEPTED: 'Приняты',
  REJECTED: 'Отклонены',
};

/**
 * Очередь идей клиентов для супер-админа.
 */
const SuperAdminClientIdeasTab: React.FC = () => {
  const [filter, setFilter] = useState<FilterStatus>('SUBMITTED');
  const [items, setItems] = useState<IdeaAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.adminListFeatureIdeas(
        filter ? { status: filter } : undefined
      );
      setItems(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить идеи');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      await apiService.adminAcceptFeatureIdea(id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось принять');
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (id: string) => {
    setRejectId(id);
    setRejectReason('');
    setRejectOpen(true);
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setBusyId(rejectId);
    setError('');
    try {
      await apiService.adminRejectFeatureIdea(rejectId, rejectReason.trim() || undefined);
      setRejectOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отклонить');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        Идеи клиентов
      </Typography>

      <Tabs
        value={filter}
        onChange={(_, v) => setFilter(v)}
        sx={{ mb: 2 }}
      >
        <Tab value="SUBMITTED" label="Новые" />
        <Tab value="ACCEPTED" label="Приняты" />
        <Tab value="REJECTED" label="Отклонены" />
        <Tab value="" label="Все" />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Typography color="text.secondary">Нет идей</Typography>
      ) : (
        items.map((idea) => (
          <Paper key={idea.id} sx={{ p: 2, mb: 2 }}>
            <Box display="flex" justifyContent="space-between" gap={1} alignItems="flex-start">
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {idea.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {new Date(idea.createdAt).toLocaleString('ru-RU')}
                  {' · '}
                  {[idea.authorName, idea.authorEmail, idea.actorType, idea.tenantName]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
              <Chip size="small" label={STATUS_LABEL[idea.status] || idea.status} />
            </Box>
            <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1.5, mb: 1.5 }}>{idea.body}</Typography>
            {idea.status === 'SUBMITTED' && (
              <Box display="flex" gap={1}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={busyId === idea.id}
                  onClick={() => handleAccept(idea.id)}
                >
                  Принять
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  disabled={busyId === idea.id}
                  onClick={() => openReject(idea.id)}
                >
                  Отклонить
                </Button>
              </Box>
            )}
            {idea.status === 'ACCEPTED' && idea.devNote && (
              <Button
                size="small"
                sx={{ textTransform: 'none' }}
                onClick={() => {
                  window.location.assign('/admin/dashboard?section=development');
                }}
              >
                Открыть в «Разработка»
              </Button>
            )}
            {idea.status === 'REJECTED' && idea.rejectReason && (
              <Typography variant="body2" color="text.secondary">
                Причина: {idea.rejectReason}
              </Typography>
            )}
          </Paper>
        ))
      )}

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Отклонить идею</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Причина (необязательно)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            multiline
            minRows={2}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Отмена</Button>
          <Button color="error" variant="contained" onClick={handleReject} disabled={!!busyId}>
            Отклонить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuperAdminClientIdeasTab;
