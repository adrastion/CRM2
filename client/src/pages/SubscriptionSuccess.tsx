import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import AppLayout from '../components/Layout/AppLayout';

const SubscriptionSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user?.role !== 'OWNER') {
      navigate('/dashboard');
      return;
    }

    loadSubscription();
  }, [isAuthenticated, user, navigate]);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getSubscription();
      setSubscription(data.subscription);
      
      // Проверяем статус последнего платежа
      if (data.subscription?.payments && data.subscription.payments.length > 0) {
        const lastPayment = data.subscription.payments[0]; // Самый последний платеж
        // Если платеж не завершен или отменен, показываем ошибку
        if (lastPayment.status === 'pending' || lastPayment.status === 'cancelled') {
          setError('Что-то пошло не так. Платеж не был завершен. Пожалуйста, попробуйте еще раз.');
        }
      } else if (data.subscription?.status !== 'active') {
        // Если нет платежей и подписка не активна, возможно платеж не был завершен
        // Проверяем, есть ли недавние попытки оплаты (в течение последних 10 минут)
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
        
        // Если подписка не активна и мы на странице успеха, вероятно платеж не был завершен
        if (data.subscription?.status === 'expired' || data.subscription?.status === 'cancelled') {
          setError('Что-то пошло не так. Платеж не был завершен. Пожалуйста, попробуйте еще раз.');
        }
      }
    } catch (err: any) {
      console.error('Error loading subscription:', err);
      setError('Что-то пошло не так. Платеж не был завершен. Пожалуйста, попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          {error ? (
            <>
              <ErrorIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
              <Typography variant="h4" gutterBottom>
                Ошибка
              </Typography>
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
              <Button
                variant="contained"
                sx={{ mt: 3 }}
                onClick={() => navigate('/pricing')}
              >
                Вернуться к тарифам
              </Button>
            </>
          ) : error ? (
            <>
              <ErrorIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
              <Typography variant="h4" gutterBottom>
                Что-то пошло не так
              </Typography>
              <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                {error}
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 3 }}>
                Платеж не был завершен. Вы можете попробовать оплатить подписку еще раз.
              </Typography>
              <Box sx={{ mt: 4 }}>
                <Button
                  variant="contained"
                  sx={{ mr: 2 }}
                  onClick={() => navigate('/pricing')}
                >
                  Вернуться к тарифам
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/dashboard')}
                >
                  Перейти в панель управления
                </Button>
              </Box>
            </>
          ) : subscription?.status === 'active' ? (
            <>
              <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
              <Typography variant="h4" gutterBottom>
                Подписка успешно активирована!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                Ваш тариф: <strong>{subscription.planType}</strong>
              </Typography>
              {subscription.endDate && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Действует до: {new Date(subscription.endDate).toLocaleDateString('ru-RU')}
                </Typography>
              )}
              <Box sx={{ mt: 4 }}>
                <Button
                  variant="contained"
                  onClick={() => navigate('/dashboard')}
                  sx={{ mr: 2 }}
                >
                  Перейти в панель управления
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/settings')}
                >
                  Управление подпиской
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Alert severity="warning" sx={{ mt: 2 }}>
                Платеж обрабатывается. Пожалуйста, подождите...
              </Alert>
              <Button
                variant="contained"
                sx={{ mt: 3 }}
                onClick={loadSubscription}
              >
                Обновить статус
              </Button>
            </>
          )}
        </Paper>
      </Container>
    </AppLayout>
  );
};

export default SubscriptionSuccess;

