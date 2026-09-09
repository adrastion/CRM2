import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Tab,
  Tabs,
  Typography,
  Divider,
} from '@mui/material';
import ChatWorkspace from '../components/chat/ChatWorkspace';
import { useTesterAuth } from '../contexts/TesterAuthContext';
import { apiService } from '../services/api';

interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  createdBy?: { firstName?: string; lastName?: string; email?: string };
}

/**
 * Панель тестировщика: платформенные чаты + список изменений.
 */
const TesterDashboard: React.FC = () => {
  const { tester } = useTesterAuth();
  const [tab, setTab] = useState(0);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('testerToken');

  const loadChangelog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.listPlatformChangelog();
      setEntries(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить изменения');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 1) loadChangelog();
  }, [tab, loadChangelog]);

  if (!tester) {
    return (
      <Box p={3}>
        <Typography>Требуется вход</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Чаты" />
          <Tab label="Изменения" />
        </Tabs>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {tab === 0 && (
        <ChatWorkspace
          mode="platform"
          socketToken={token}
          self={{ kind: 'TESTER', id: tester.id }}
        />
      )}

      {tab === 1 && (
        <Box>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : entries.length === 0 ? (
            <Typography color="text.secondary">Пока нет записей об изменениях</Typography>
          ) : (
            entries.map((e) => (
              <Paper key={e.id} sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>
                  {e.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(e.createdAt).toLocaleString('ru-RU')}
                  {e.createdBy
                    ? ` · ${[e.createdBy.lastName, e.createdBy.firstName].filter(Boolean).join(' ') || e.createdBy.email}`
                    : ''}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{e.body}</Typography>
              </Paper>
            ))
          )}
        </Box>
      )}
    </Box>
  );
};

export default TesterDashboard;
