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
  Button,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import ChatWorkspace from '../components/chat/ChatWorkspace';
import NotificationSettingsPanel from '../components/notifications/NotificationSettingsPanel';
import { useTesterAuth } from '../contexts/TesterAuthContext';
import { apiService } from '../services/api';

interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
  createdBy?: { firstName?: string; lastName?: string; email?: string };
}

const TesterNewsImage: React.FC<{ id: string; hasImage: boolean }> = ({ id, hasImage }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!hasImage) return;
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await apiService.downloadPlatformNewsImageBlob(id, 'sa');
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
  }, [id, hasImage]);
  if (!hasImage || !url) return null;
  return (
    <Box
      component="img"
      src={url}
      alt=""
      sx={{
        mt: 1.5,
        display: 'block',
        width: '100%',
        maxHeight: 360,
        objectFit: 'contain',
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    />
  );
};

/**
 * Панель тестировщика: платформенные чаты + новости.
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
      setError(e?.response?.data?.error || 'Не удалось загрузить новости');
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
          <Tab label="Новости" />
          <Tab label="Уведомления" />
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
            <Typography color="text.secondary">Пока нет новостей</Typography>
          ) : (
            entries.map((e) => (
              <Paper key={e.id} sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>
                  {e.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(e.createdAt).toLocaleString('ru-RU')}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{e.body}</Typography>
                <TesterNewsImage id={e.id} hasImage={Boolean(e.imageUrl)} />
                {e.fileUrl && (
                  <Button
                    size="small"
                    startIcon={<Download />}
                    sx={{ mt: 1.5, textTransform: 'none' }}
                    onClick={async () => {
                      const blob = await apiService.downloadPlatformNewsFileBlob(e.id, 'sa');
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    }}
                  >
                    Скачать файл
                  </Button>
                )}
              </Paper>
            ))
          )}
        </Box>
      )}

      {tab === 2 && (
        <Box sx={{ maxWidth: 640 }}>
          <NotificationSettingsPanel actor="tester" showChangelog />
        </Box>
      )}
    </Box>
  );
};

export default TesterDashboard;
