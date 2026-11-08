import React, { useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Typography,
} from '@mui/material';
import { Android, PhoneIphone } from '@mui/icons-material';
import { Navigate } from 'react-router-dom';
import PublicSiteNav from '../components/PublicSiteNav';
import PublicFooter from '../components/PublicFooter';
import { usePublicSiteConfig } from '../hooks/usePublicSiteConfig';
import { apiService } from '../services/api';
import { colors, radii } from '../theme/tokens';

/** Страница скачивания Android / инструкция iOS. */
const PublicDownload: React.FC = () => {
  const { config, loading, error } = usePublicSiteConfig();

  useEffect(() => {
    document.title = 'Приложение — ПРОФСПОРТСРМ';
  }, []);

  if (loading) {
    return (
      <Box minHeight="60vh" display="flex" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  if (!config?.download.tabEnabled) {
    return <Navigate to="/" replace />;
  }

  const d = config.download;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: colors.surface }}>
      <PublicSiteNav />
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 }, flex: 1 }}>
        <Typography
          component="h1"
          sx={{ fontWeight: 800, fontSize: { xs: 28, md: 36 }, mb: 1, color: colors.text }}
        >
          Мобильное приложение
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 560 }}>
          Кабинет школы и ученика всегда под рукой — скачайте Android или добавьте сайт на рабочий
          стол на iPhone.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: `${radii.panel}px`,
              border: `1px solid ${colors.divider}`,
              background: `linear-gradient(160deg, ${colors.white} 0%, #EEF3FF 100%)`,
            }}
          >
            <Android sx={{ fontSize: 36, color: colors.primary, mb: 1 }} />
            <Typography fontWeight={800} variant="h6" gutterBottom>
              Android
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Установите из RuStore или скачайте APK напрямую
              {d.apkLabel ? ` (${d.apkLabel})` : ''}.
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {d.rustoreUrl && (
                <Button
                  variant="contained"
                  href={d.rustoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Открыть в RuStore
                </Button>
              )}
              {d.publicApkEnabled && (
                <Button
                  variant="outlined"
                  href={apiService.getPublicApkDownloadUrl()}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Скачать APK
                </Button>
              )}
              {!d.rustoreUrl && !d.publicApkEnabled && (
                <Typography variant="body2" color="text.secondary">
                  Ссылки скоро появятся — следите за новостями.
                </Typography>
              )}
            </Box>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: `${radii.panel}px`,
              border: `1px solid ${colors.divider}`,
            }}
          >
            <PhoneIphone sx={{ fontSize: 36, color: colors.primary, mb: 1 }} />
            <Typography fontWeight={800} variant="h6" gutterBottom>
              iOS / на рабочий стол
            </Typography>
            {d.iosInstructionEnabled ? (
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {d.iosInstructionText}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Инструкция временно скрыта.
              </Typography>
            )}
          </Paper>
        </Box>
      </Container>
      <PublicFooter />
    </Box>
  );
};

export default PublicDownload;
