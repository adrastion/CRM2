import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Typography,
  Button,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import ChatWorkspace from '../components/chat/ChatWorkspace';
import NotificationSettingsPanel from '../components/notifications/NotificationSettingsPanel';
import Email2faSettingsToggle from '../components/auth/Email2faSettingsToggle';
import ActiveSessionsPanel from '../components/auth/ActiveSessionsPanel';
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
 * Панель тестировщика. Чаты — immersive как у школы; вкладки через shell nav (?tab=).
 */
const TesterDashboard: React.FC = () => {
  const { tester } = useTesterAuth();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'chats';
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
    if (tab === 'news') void loadChangelog();
  }, [tab, loadChangelog]);

  if (!tester) {
    return (
      <Box p={3}>
        <Typography>Требуется вход</Typography>
      </Box>
    );
  }

  if (tab !== 'news' && tab !== 'notifications') {
    return (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          height: { xs: '100%', md: 'calc(100vh - 120px)' },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ChatWorkspace
          mode="platform"
          socketToken={token}
          self={{ kind: 'TESTER', id: tester.id }}
          immersiveMobile
        />
      </Box>
    );
  }

  if (tab === 'news') {
    return (
      <Box>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
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
              <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{e.body}</Typography>
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
    );
  }

  return (
    <Box sx={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Email2faSettingsToggle />
      <ActiveSessionsPanel />
      <NotificationSettingsPanel actor="tester" showChangelog />
    </Box>
  );
};

export default TesterDashboard;
