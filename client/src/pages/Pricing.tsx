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
import type { PublicPlanItem, PlanLimitValue } from '../types';

interface PricingPlanCard {
  code: string;
  name: string;
  planType: string;
  priceLabel: string;
  priceValue: number | null;
  isNegotiable: boolean;
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

interface PromoCodeData {
  promoCode: string;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  discountType: string;
  discountValue: number;
}

const formatLimit = (value: PlanLimitValue | undefined): string | number => {
  if (value === undefined || value === null) return '—';
  return value === 'unlimited' ? 'Безлимит' : value;
};

const formatTrainings = (value: PlanLimitValue | undefined): string => {
  if (value === undefined || value === null) return '—';
  return value === 'unlimited' ? 'Безлимит' : `${value}/месяц`;
};

const mapPublicPlan = (plan: PublicPlanItem, index: number): PricingPlanCard => {
  const isNegotiable = plan.isNegotiable || plan.price == null;
  return {
    code: plan.code || plan.planType,
    name: plan.name,
    planType: plan.planType || plan.code,
    priceLabel: isNegotiable
      ? 'Цена договорная'
      : `${Number(plan.price).toLocaleString('ru-RU')}₽`,
    priceValue: plan.price,
    isNegotiable,
    description: plan.description || '',
    features: {
      trainers: formatLimit(plan.limits?.trainers),
      clients: formatLimit(plan.limits?.clients),
      groups: formatLimit(plan.limits?.groups),
      branches: formatLimit(plan.limits?.branches),
      trainings: formatTrainings(plan.limits?.trainings),
      support: plan.supportLevel || 'Email',
    },
    // Помечаем средний тариф как популярный, если в каталоге ≥ 3 позиций
    popular: index === 2,
  };
};

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);
  const [planTypes, setPlanTypes] = useState<PricingPlanCard[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; plan: PricingPlanCard | null }>({
    open: false,
    plan: null,
  });
  const [promoCode, setPromoCode] = useState<string>('');
  const [, setAppliedPromoCode] = useState<PromoCodeData | null>(null);
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null);
  const [validatingPromoCode, setValidatingPromoCode] = useState(false);
  const [promoCodeByPlan, setPromoCodeByPlan] = useState<Record<string, PromoCodeData>>({});

  useEffect(() => {
    loadPublicPlans();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'OWNER') {
      loadSubscription();
    }
  }, [isAuthenticated, user]);

  const loadPublicPlans = async () => {
    try {
      setPlansLoading(true);
      const data = await apiService.getPublicPlans();
      const sorted = [...(data || [])].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      );
      setPlanTypes(sorted.map(mapPublicPlan));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки тарифов');
    } finally {
      setPlansLoading(false);
    }
  };

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

  const handleSelectPlan = (plan: PricingPlanCard) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user?.role !== 'OWNER') {
      setError('Только владелец может управлять подпиской');
      return;
    }

    if (plan.isNegotiable) {
      setError('Для тарифа с договорной ценой свяжитесь с нами');
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
      const planKey = confirmDialog.plan.planType || confirmDialog.plan.code;
      const appliedPromo = promoCodeByPlan[planKey];
      const promoCodeToUse = appliedPromo ? appliedPromo.promoCode : undefined;
      
      const payment = await apiService.createSubscriptionPayment(
        planKey,
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
        handleRemovePromoCode(planKey);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка при создании платежа');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPlan = () => {
    if (!subscription) return null;
    return planTypes.find(
      (p) =>
        p.planType === subscription.planType ||
        p.code === subscription.planType
    );
  };

  const currentPlan = getCurrentPlan();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Container maxWidth="xl" sx={{ py: 3, flexGrow: 1 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <AttachMoney sx={{ fontSize: 40, color: 'primary.main', mb: 1.5 }} />
        <Typography variant="h5" component="h1" gutterBottom fontWeight="bold">
          Тарифные планы
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5 }}>
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

      {plansLoading ? (
        <Box display="flex" justifyContent="center" p={6}>
          <CircularProgress />
        </Box>
      ) : planTypes.length === 0 ? (
        <Alert severity="info">Тарифы временно недоступны</Alert>
      ) : (
      <Grid container spacing={3}>
        {planTypes.map((plan, index) => {
          const isCurrentPlan =
            (currentPlan?.planType === plan.planType || currentPlan?.code === plan.code) &&
            subscription?.status === 'active';
          const isNegotiable = plan.isNegotiable;
          
          return (
          <Grid item xs={12} sm={6} md={4} lg={index === 4 ? 12 : undefined} key={plan.code || plan.planType}>
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
                <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
                  {plan.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {plan.description}
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography variant="h4" component="div" fontWeight="bold" color="primary.main">
                    {plan.priceLabel}
                  </Typography>
                  {!isNegotiable && (
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
                disabled={isNegotiable || loading || isCurrentPlan}
                onClick={() => handleSelectPlan(plan)}
              >
                {loading ? (
                  <CircularProgress size={24} />
                ) : isCurrentPlan ? (
                  'Текущий тариф'
                ) : isNegotiable ? (
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
      )}

      {/* Dialog для подтверждения платежа */}
      <Dialog open={confirmDialog.open} onClose={() => {
        setConfirmDialog({ open: false, plan: null });
        // Очищаем промокод при закрытии диалога
        if (confirmDialog.plan) {
          handleRemovePromoCode(confirmDialog.plan.planType || confirmDialog.plan.code);
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
              {!confirmDialog.plan.isNegotiable && confirmDialog.plan.priceValue !== 0 && (
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
                      onClick={() =>
                        handleApplyPromoCode(
                          confirmDialog.plan!.planType || confirmDialog.plan!.code
                        )
                      }
                      disabled={!promoCode.trim() || validatingPromoCode}
                    >
                      {validatingPromoCode ? <CircularProgress size={20} /> : 'Применить'}
                    </Button>
                  </Box>
                  {promoCodeByPlan[confirmDialog.plan.planType || confirmDialog.plan.code] && (
                    <Alert severity="success" sx={{ mt: 1 }}>
                      Промокод{' '}
                      <strong>
                        {
                          promoCodeByPlan[
                            confirmDialog.plan.planType || confirmDialog.plan.code
                          ].promoCode
                        }
                      </strong>{' '}
                      применен!
                    </Alert>
                  )}
                </Box>
              )}

              {/* Отображение цены */}
              <Box sx={{ mt: 2 }}>
                {promoCodeByPlan[confirmDialog.plan.planType || confirmDialog.plan.code] ? (
                  <Box>
                    <Typography variant="body1" gutterBottom>
                      <Box component="span" sx={{ textDecoration: 'line-through', color: 'text.secondary', mr: 1 }}>
                        {confirmDialog.plan.priceLabel}/месяц
                      </Box>
                    </Typography>
                    <Typography variant="h6" color="success.main" gutterBottom>
                      Стоимость со скидкой:{' '}
                      <strong>
                        {promoCodeByPlan[
                          confirmDialog.plan.planType || confirmDialog.plan.code
                        ].finalAmount.toLocaleString('ru-RU')}
                        ₽/месяц
                      </strong>
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      Скидка:{' '}
                      {promoCodeByPlan[
                        confirmDialog.plan.planType || confirmDialog.plan.code
                      ].discountAmount.toLocaleString('ru-RU')}
                      ₽
                    </Typography>
                  </Box>
                ) : (
              <Typography variant="body1" gutterBottom>
                Стоимость:{' '}
                <strong>
                  {confirmDialog.plan.isNegotiable
                    ? confirmDialog.plan.priceLabel
                    : `${confirmDialog.plan.priceLabel}/месяц`}
                </strong>
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
              handleRemovePromoCode(confirmDialog.plan.planType || confirmDialog.plan.code);
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
