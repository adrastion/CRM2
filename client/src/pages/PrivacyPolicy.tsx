import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ArrowBack, PrivacyTip } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PublicFooter from '../components/PublicFooter';
import { apiService } from '../services/api';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiService.getPublicPrivacy();
        if (cancelled) return;
        setContent(data.content || '');
        setUpdatedAt(data.updatedAt);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.error || 'Не удалось загрузить политику');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dateLabel = updatedAt
    ? new Date(updatedAt).toLocaleDateString('ru-RU')
    : new Date().toLocaleDateString('ru-RU');

  const goBack = () => {
    const accessBlocked =
      sessionStorage.getItem('maintenanceMode') === '1' ||
      sessionStorage.getItem('closedTestingMode') === '1' ||
      (sessionStorage.getItem('testingMode') === '1' &&
        sessionStorage.getItem('testingModeAccess') !== '1' &&
        !localStorage.getItem('superAdminToken'));
    if (accessBlocked) {
      navigate('/maintenance');
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/auth');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Container maxWidth="lg" sx={{ py: 3, flexGrow: 1 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={goBack}
          sx={{ textTransform: 'none', mb: 2 }}
        >
          Назад
        </Button>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <PrivacyTip sx={{ fontSize: 36, color: 'primary.main', mb: 1.5 }} />
          <Typography variant="h5" component="h1" gutterBottom fontWeight="bold">
            Политика конфиденциальности
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Обработка персональных данных ПРОФСПОРТСРМ
          </Typography>
        </Box>

        <Paper sx={{ p: 4, boxShadow: 2 }}>
          {loading && (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          )}
          {!loading && error && <Alert severity="error">{error}</Alert>}
          {!loading && !error && (
            <Typography variant="body1" sx={{ lineHeight: 1.8, whiteSpace: 'pre-line' }}>
              {content}
              {`\n\nДата последнего обновления: ${dateLabel}`}
            </Typography>
          )}
        </Paper>
      </Container>
      <PublicFooter />
    </Box>
  );
};

export default PrivacyPolicy;
