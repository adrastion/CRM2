import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Container, Paper, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../services/api';
import PublicSiteNav from '../components/PublicSiteNav';
import { colors } from '../theme/tokens';

const MarketerJoin: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await apiService.resolveMarketerInvite(token);
        if (!cancelled) setInfo(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Приглашение недействительно');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const goRegister = () => {
    navigate(`/marketer/register?ref=${encodeURIComponent(token)}`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: colors.surface }}>
      <PublicSiteNav />
      <Container maxWidth="sm" sx={{ py: 5, flexGrow: 1 }}>
        <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
              <Button component={RouterLink} to="/marketer/register" variant="contained" sx={{ textTransform: 'none' }}>
                Регистрация без приглашения
              </Button>
            </>
          ) : (
            <>
              <Typography variant="overline" color="primary" fontWeight={800}>
                Приглашение в команду
              </Typography>
              <Typography variant="h4" fontWeight={800} sx={{ mt: 1, mb: 1.5 }}>
                Вас пригласил {info?.inviterName || 'партнёр'}
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                {info?.rule ||
                  'Разовая комиссия 5% с первой оплаченной подписки каждой школы, которую вы приведёте. Один уровень.'}
              </Typography>
              <Alert severity="info" sx={{ mb: 3 }}>
                После регистрации вы попадёте в кабинет маркетолога. Связь с пригласившим сохранится автоматически.
              </Alert>
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={goRegister}
                sx={{ textTransform: 'none', fontWeight: 800, mb: 1.5 }}
              >
                Зарегистрироваться
              </Button>
              <Button component={RouterLink} to="/auth" fullWidth sx={{ textTransform: 'none' }}>
                Уже есть аккаунт — войти
              </Button>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default MarketerJoin;
