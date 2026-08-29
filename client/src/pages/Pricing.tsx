import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  CheckCircle,
  AttachMoney,
  People,
  Person,
  Groups,
  Business,
  CalendarToday,
  Support,
  TrendingUp,
  LocalOffer,
} from '@mui/icons-material';
import PublicFooter from '../components/PublicFooter';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- type reserved for plans display
interface PricingPlan {
  name: string;
  price: string;
  description: string;
  features: {
    trainers: number | string;
    clients: number | string;
    groups: number | string;
    branches: number | string;
    trainings: string;
    support: string;
  };
  popular?: boolean;
}


interface PlanType {
  name: string;
  planType: 'FREE' | 'STARTER' | 'BUSINESS' | 'PROFESSIONAL' | 'ENTERPRISE';
  price: string;
  description: string;
  features: {
    trainers: number | string;
    clients: number | string;
    groups: number | string;
    branches: number | string;
    trainings: string;
    support: string;
  };
  popular?: boolean;
}

const planTypes: PlanType[] = [
  {
    name: 'БЕСПЛАТНЫЙ',
    planType: 'FREE',
    price: '0₽',
    description: 'Для начинающих школ и тестирования системы',
    features: {
      trainers: 1,
      clients: 30,
      groups: 3,
      branches: 1,
      trainings: '10/месяц',
      support: 'Email (48 часов)',
    },
  },
  {
    name: 'СТАРТОВЫЙ',
    planType: 'STARTER',
    price: '990₽',
    description: 'Для небольших школ, 1-2 филиала',
    features: {
      trainers: 3,
      clients: 90,
      groups: 9,
      branches: 2,
      trainings: 'Безлимит',
      support: 'Email (24 часа)',
    },
  },
  {
    name: 'БИЗНЕС',
    planType: 'BUSINESS',
    price: '2,490₽',
    description: 'Для средних школ, сеть филиалов',
    features: {
      trainers: 10,
      clients: 600,
      groups: 30,
      branches: 5,
      trainings: 'Безлимит',
      support: 'Email + Telegram (12 часов)',
    },
    popular: true,
  },
  {
    name: 'ПРОФЕССИОНАЛЬНЫЙ',
    planType: 'PROFESSIONAL',
    price: '4,990₽',
    description: 'Для крупных школ и федераций',
    features: {
      trainers: 25,
      clients: 1500,
      groups: 50,
      branches: 10,
      trainings: 'Безлимит',
      support: 'Email + Telegram + Телефон (4 часа)',
    },
  },
  {
    name: 'КОРПОРАТИВНЫЙ',
    planType: 'ENTERPRISE',
    price: 'По запросу',
    description: 'Для крупных сетей и корпораций',
    features: {
      trainers: 'Безлимит',
      clients: 'Безлимит',
      groups: 'Безлимит',
      branches: 'Безлимит',
      trainings: 'Безлимит',
      support: '24/7 с персональным менеджером',
    },
  },
];

interface PromoCodeData {
  promoCode: string;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  discountType: string;
  discountValue: number;
}

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; plan: PlanType | null }>({
    open: false,
    plan: null,
  });
  const [promoCode, setPromoCode] = useState<string>('');
  const [, setAppliedPromoCode] = useState<PromoCodeData | null>(null);
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null);
  const [validatingPromoCode, setValidatingPromoCode] = useState(false);
  const [promoCodeByPlan, setPromoCodeByPlan] = useState<Record<string, PromoCodeData>>({});

  useEffect(() => {
    if (isAuthenticated && user?.role === 'OWNER') {
      loadSubscription();
    }
  }, [isAuthenticated, user]);

  const loadSubscription = async () => {
    try {
      const data = await apiService.getSubscription();
      setSubscription(data.subscription);
    } catch (err: any) {
      console.error('Error loading subscription:', err);
    }
  };

  const handleApplyPromoCode = async (planType: string) => {
    if (!promoCode.trim()) {
      setPromoCodeError('Введите промокод');
      return;
    }

    setValidatingPromoCode(true);
    setPromoCodeError(null);

    try {
      const result = await apiService.validatePromoCode(promoCode.trim().toUpperCase(), planType);
      
      // Сохраняем примененный промокод для этого тарифа
      setPromoCodeByPlan(prev => ({
        ...prev,
        [planType]: result,
      }));
      
      setAppliedPromoCode(result);
      setPromoCodeError(null);
    } catch (err: any) {
      setPromoCodeError(err.response?.data?.error || 'Неверный промокод');
      setAppliedPromoCode(null);
      // Удаляем промокод для этого тарифа при ошибке
      setPromoCodeByPlan(prev => {
        const newState = { ...prev };
        delete newState[planType];
        return newState;
      });
    } finally {
      setValidatingPromoCode(false);
    }
  };

  const handleRemovePromoCode = (planType: string) => {
    setPromoCodeByPlan(prev => {
      const newState = { ...prev };
      delete newState[planType];
      return newState;
    });
    setPromoCode('');
    setPromoCodeError(null);
  };

  const handleSelectPlan = (plan: PlanType) => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    if (user?.role !== 'OWNER') {
      setError('Только владелец может управлять подпиской');
      return;
    }

    if (plan.planType === 'ENTERPRISE') {
      // Для корпоративного тарифа нужна связь с менеджером
      setError('Для корпоративного тарифа свяжитесь с нами');
      return;
    }

    setConfirmDialog({ open: true, plan });
  };

  const handleConfirmPayment = async () => {
    if (!confirmDialog.plan) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const returnUrl = `${window.location.origin}/subscription/success`;
      const appliedPromo = promoCodeByPlan[confirmDialog.plan.planType];
      const promoCodeToUse = appliedPromo ? appliedPromo.promoCode : undefined;
      
      const payment = await apiService.createSubscriptionPayment(
        confirmDialog.plan.planType,
        returnUrl,
        promoCodeToUse
      );

      if (payment.paymentUrl) {
        // Перенаправляем на страницу оплаты YooKassa
        window.location.href = payment.paymentUrl;
      } else if (payment.status === 'succeeded') {
        // Бесплатный тариф или уже оплачено
        setSuccess('Подписка успешно активирована!');
        await loadSubscription();
        setConfirmDialog({ open: false, plan: null });
        // Очищаем промокод после успешной оплаты
        handleRemovePromoCode(confirmDialog.plan.planType);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка при создании платежа');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPlan = () => {
    if (!subscription) return null;
    return planTypes.find((p) => p.planType === subscription.planType);
  };

  const currentPlan = getCurrentPlan();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Container maxWidth="xl" sx={{ py: 4, flexGrow: 1 }}>
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <AttachMoney sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          Тарифные планы
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Выберите подходящий тариф для вашей спортивной школы
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Все тарифы включают комиссию платежной системы. Оплата производится ежемесячно.
        </Typography>
        {isAuthenticated && user?.role === 'OWNER' && subscription && (
          <Alert severity="info" sx={{ mt: 3, maxWidth: 600, mx: 'auto' }}>
            Текущий тариф: <strong>{subscription.planType}</strong>
            {subscription.status === 'active' && subscription.endDate && (
              <> • Действует до: {new Date(subscription.endDate).toLocaleDateString('ru-RU')}</>
            )}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2, maxWidth: 600, mx: 'auto' }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mt: 2, maxWidth: 600, mx: 'auto' }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
      </Box>

      <Grid container spacing={3}>
        {planTypes.map((plan, index) => {
          const isCurrentPlan = currentPlan?.planType === plan.planType && subscription?.status === 'active';
          const isEnterprise = plan.planType === 'ENTERPRISE';
          
          return (
          <Grid item xs={12} sm={6} md={4} lg={index === 4 ? 12 : undefined} key={plan.name}>
            <Paper
              sx={{
                p: 4,
                boxShadow: plan.popular ? 6 : 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                border: plan.popular ? 2 : 0,
                borderColor: plan.popular ? 'primary.main' : 'transparent',
                '&:hover': {
                  boxShadow: plan.popular ? 8 : 4,
                  transform: 'translateY(-4px)',
                  transition: 'all 0.3s',
                },
              }}
            >
              {plan.popular && (
                <Chip
                  label="ПОПУЛЯРНЫЙ"
                  color="primary"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    fontWeight: 'bold',
                  }}
                />
              )}

              <Box sx={{ mb: 3 }}>
                <Typography variant="h4" component="h2" gutterBottom fontWeight="bold">
                  {plan.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {plan.description}
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography variant="h3" component="div" fontWeight="bold" color="primary.main">
                    {plan.price}
                  </Typography>
                  {plan.price !== 'По запросу' && (
                    <Typography variant="body2" color="text.secondary">
                      /месяц
                    </Typography>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <List sx={{ flexGrow: 1 }}>
                <ListItem>
                  <ListItemIcon>
                    <Person color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Тренеры"
                    secondary={plan.features.trainers}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <People color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Клиенты"
                    secondary={plan.features.clients}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Groups color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Группы"
                    secondary={plan.features.groups}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Business color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Филиалы"
                    secondary={plan.features.branches}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CalendarToday color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Тренировки"
                    secondary={plan.features.trainings}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Support color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Поддержка"
                    secondary={plan.features.support}
                  />
                </ListItem>
              </List>

              <Button
                variant={plan.popular ? 'contained' : 'outlined'}
                fullWidth
                size="large"
                sx={{ mt: 3 }}
                disabled={isEnterprise || loading || isCurrentPlan}
                onClick={() => handleSelectPlan(plan)}
              >
                {loading ? (
                  <CircularProgress size={24} />
                ) : isCurrentPlan ? (
                  'Текущий тариф'
                ) : isEnterprise ? (
                  'Связаться с нами'
                ) : (
                  'Выбрать тариф'
                )}
              </Button>
            </Paper>
          </Grid>
          );
        })}
      </Grid>

      {/* Dialog для подтверждения платежа */}
      <Dialog open={confirmDialog.open} onClose={() => {
        setConfirmDialog({ open: false, plan: null });
        // Очищаем промокод при закрытии диалога
        if (confirmDialog.plan) {
          handleRemovePromoCode(confirmDialog.plan.planType);
        }
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Подтверждение выбора тарифа</DialogTitle>
        <DialogContent>
          {confirmDialog.plan && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Тариф: {confirmDialog.plan.name}
              </Typography>
              
              {/* Поле для ввода промокода */}
              {confirmDialog.plan.planType !== 'FREE' && confirmDialog.plan.planType !== 'ENTERPRISE' && (
                <Box sx={{ mt: 3, mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Введите промокод для получения скидки
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Промокод"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      error={!!promoCodeError}
                      helperText={promoCodeError}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LocalOffer fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => handleApplyPromoCode(confirmDialog.plan!.planType)}
                      disabled={!promoCode.trim() || validatingPromoCode}
                    >
                      {validatingPromoCode ? <CircularProgress size={20} /> : 'Применить'}
                    </Button>
                  </Box>
                  {promoCodeByPlan[confirmDialog.plan.planType] && (
                    <Alert severity="success" sx={{ mt: 1 }}>
                      Промокод <strong>{promoCodeByPlan[confirmDialog.plan.planType].promoCode}</strong> применен!
                    </Alert>
                  )}
                </Box>
              )}

              {/* Отображение цены */}
              <Box sx={{ mt: 2 }}>
                {promoCodeByPlan[confirmDialog.plan.planType] ? (
                  <Box>
                    <Typography variant="body1" gutterBottom>
                      <Box component="span" sx={{ textDecoration: 'line-through', color: 'text.secondary', mr: 1 }}>
                        {confirmDialog.plan.price}/месяц
                      </Box>
                    </Typography>
                    <Typography variant="h6" color="success.main" gutterBottom>
                      Стоимость со скидкой: <strong>{promoCodeByPlan[confirmDialog.plan.planType].finalAmount.toLocaleString('ru-RU')}₽/месяц</strong>
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      Скидка: {promoCodeByPlan[confirmDialog.plan.planType].discountAmount.toLocaleString('ru-RU')}₽
                    </Typography>
                  </Box>
                ) : (
              <Typography variant="body1" gutterBottom>
                Стоимость: <strong>{confirmDialog.plan.price}/месяц</strong>
              </Typography>
                )}
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                После подтверждения вы будете перенаправлены на страницу оплаты YooKassa.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setConfirmDialog({ open: false, plan: null });
            // Очищаем промокод при закрытии диалога
            if (confirmDialog.plan) {
              handleRemovePromoCode(confirmDialog.plan.planType);
            }
          }}>
            Отмена
          </Button>
          <Button
            onClick={handleConfirmPayment}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Оплатить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Дополнительная информация */}
      <Box sx={{ mt: 6 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 4, boxShadow: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <TrendingUp sx={{ fontSize: 40, color: 'primary.main' }} />
                <Typography variant="h5" fontWeight="bold">
                  Изменение тарифа
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Вы можете изменить тариф в любой момент:
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Переход на более дорогой тариф"
                    secondary="Изменения вступают в силу немедленно, оплата производится пропорционально оставшемуся периоду"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Переход на более дешевый тариф"
                    secondary="Изменения вступают в силу в конце текущего оплаченного периода"
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 4, boxShadow: 2, backgroundColor: 'primary.light', color: 'white' }}>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Важная информация
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                • Возврат средств не предусмотрен, так как услуга предоставляется помесячно
              </Typography>
              <Typography variant="body1">
                • При отмене подписки вы можете использовать систему до конца оплаченного периода
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
      </Container>
      <PublicFooter />
    </Box>
  );
};

export default Pricing;

