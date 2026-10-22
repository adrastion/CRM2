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
  Badge,
} from '@mui/icons-material';
import PublicFooter from '../components/PublicFooter';
import PublicSiteNav from '../components/PublicSiteNav';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import type { PublicPlanItem, PlanLimitValue } from '../types';
import { hasAnySession } from '../utils/authSession';
import { colors, radii } from '../theme/tokens';

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
    extraStaff: number | string;
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
      extraStaff: formatLimit(plan.limits?.extraStaff),
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
  const [expandedPlanCodes, setExpandedPlanCodes] = useState<Record<string, boolean>>({});

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
      // Гость: сначала регистрация школы, затем возврат к тарифам
      navigate('/register', { state: { next: '/pricing', from: 'pricing' } });
      return;
    }

    if (user?.role !== 'OWNER') {
      setError('Только владелец может управлять подпиской');
      return;
    }

    if (plan.isNegotiable) {
      setError('Для тарифа с договорной ценой свяжитесь с нами через страницу «Контакты»');
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
  const inCabinet = isAuthenticated;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: inCabinet ? 'auto' : '100vh',
      }}
    >
      {!isAuthenticated && !hasAnySession() && <PublicSiteNav />}
      <Container maxWidth={inCabinet ? 'md' : 'xl'} sx={{ py: inCabinet ? 0 : 3, flexGrow: 1, px: inCabinet ? { xs: 0, sm: 2 } : undefined }}>
      <Box sx={{ mb: inCabinet ? 2.5 : 4, textAlign: inCabinet ? 'left' : 'center' }}>
        {!inCabinet && (
          <AttachMoney sx={{ fontSize: 40, color: colors.primary, mb: 1.5 }} />
        )}
        <Typography
          variant="h5"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            fontSize: { xs: 20, md: 24 },
            color: colors.text,
            letterSpacing: '-0.02em',
          }}
        >
          {inCabinet ? 'Тарифы' : 'Тарифные планы'}
        </Typography>
        {inCabinet ? (
          <Typography sx={{ fontSize: 13, color: colors.textHint, mb: 2 }}>
            Панель управления / Подписка
          </Typography>
        ) : (
          <>
            <Typography variant="body1" sx={{ color: colors.textHint, mb: 1.5 }}>
              Шаг 2 из пути: регистрация → тарифы → контакты
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textMuted, mb: 2 }}>
              Все тарифы включают комиссию платежной системы. Оплата производится ежемесячно.
            </Typography>
          </>
        )}
        {!isAuthenticated && (
          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/register')}
              sx={{
                textTransform: 'none',
                borderRadius: `${radii.button}px`,
                borderColor: colors.primary,
                color: colors.primary,
                fontWeight: 600,
              }}
            >
              1. Регистрация
            </Button>
            <Button
              variant="contained"
              disabled
              sx={{
                textTransform: 'none',
                borderRadius: `${radii.button}px`,
                bgcolor: colors.primary,
                fontWeight: 700,
              }}
            >
              2. Тарифы
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/contacts')}
              sx={{
                textTransform: 'none',
                borderRadius: `${radii.button}px`,
                borderColor: colors.primary,
                color: colors.primary,
                fontWeight: 600,
              }}
            >
              3. Контакты
            </Button>
          </Box>
        )}
        {inCabinet && user?.role === 'OWNER' && subscription && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2,
              borderRadius: `${radii.panel}px`,
              border: `1px solid ${colors.divider}`,
              bgcolor: colors.card,
              boxShadow: '0 2px 10px rgba(32, 34, 36, 0.05)',
            }}
          >
            <Chip
              label="Текущий тариф"
              size="small"
              sx={{
                mb: 1,
                height: 24,
                fontWeight: 700,
                fontSize: 11,
                borderRadius: `${radii.pill}px`,
                bgcolor: colors.primarySoft,
                color: colors.primaryDark,
              }}
            />
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: colors.text }}>
              {currentPlan?.name || subscription.planName || subscription.planType}
            </Typography>
            {subscription.status === 'active' && subscription.endDate && (
              <Typography sx={{ fontSize: 13, color: colors.textHint, mt: 0.5 }}>
                Активен до {new Date(subscription.endDate).toLocaleDateString('ru-RU')}
              </Typography>
            )}
          </Paper>
        )}
        {inCabinet && (
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.text, mb: 1.5 }}>
            Выберите тариф
          </Typography>
        )}
        {error && (
          <Alert
            severity="error"
            sx={{ mt: inCabinet ? 0 : 2, mb: inCabinet ? 2 : 0, maxWidth: inCabinet ? '100%' : 600, mx: inCabinet ? 0 : 'auto', borderRadius: `${radii.panel}px` }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert
            severity="success"
            sx={{ mt: inCabinet ? 0 : 2, mb: inCabinet ? 2 : 0, maxWidth: inCabinet ? '100%' : 600, mx: inCabinet ? 0 : 'auto', borderRadius: `${radii.panel}px` }}
            onClose={() => setSuccess(null)}
          >
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
      <Grid container spacing={inCabinet ? 1.5 : 3} justifyContent={inCabinet ? 'flex-start' : 'center'}>
        {planTypes.map((plan) => {
          const planKey = plan.code || plan.planType;
          const isCurrentPlan =
            (currentPlan?.planType === plan.planType || currentPlan?.code === plan.code) &&
            subscription?.status === 'active';
          const isNegotiable = plan.isNegotiable;
          const expanded = Boolean(expandedPlanCodes[planKey]);

          if (inCabinet) {
            return (
              <Grid item xs={12} key={planKey}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: `${radii.panel}px`,
                    border: `1px solid ${colors.divider}`,
                    bgcolor: colors.card,
                    boxShadow: '0 2px 10px rgba(32, 34, 36, 0.05)',
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: colors.text }}>
                    {plan.name}
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 18, color: colors.primary, mt: 0.5 }}>
                    {plan.priceLabel}
                    {!isNegotiable && (
                      <Typography component="span" sx={{ fontSize: 13, fontWeight: 500, color: colors.textHint }}>
                        {' '}/ мес
                      </Typography>
                    )}
                  </Typography>
                  {plan.description && (
                    <Typography sx={{ fontSize: 13, color: colors.textHint, mt: 0.75 }}>
                      {plan.description}
                    </Typography>
                  )}
                  <Button
                    onClick={() =>
                      setExpandedPlanCodes((prev) => ({ ...prev, [planKey]: !prev[planKey] }))
                    }
                    sx={{
                      mt: 1,
                      px: 0,
                      minWidth: 0,
                      textTransform: 'none',
                      fontWeight: 600,
                      color: colors.primary,
                      '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                    }}
                  >
                    {expanded ? 'Скрыть ←' : 'Подробнее →'}
                  </Button>
                  {expanded && (
                    <List dense sx={{ mt: 0.5 }}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="Тренеры" secondary={plan.features.trainers} />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="Доп. сотрудники" secondary={plan.features.extraStaff} />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="Клиенты" secondary={plan.features.clients} />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="Группы" secondary={plan.features.groups} />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="Филиалы" secondary={plan.features.branches} />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="Тренировки" secondary={plan.features.trainings} />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="Поддержка" secondary={plan.features.support} />
                      </ListItem>
                    </List>
                  )}
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      mt: 1.5,
                      borderRadius: `${radii.panel}px`,
                      textTransform: 'none',
                      fontWeight: 700,
                      bgcolor: colors.primary,
                      boxShadow: 'none',
                      '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
                    }}
                    disabled={isNegotiable || loading || isCurrentPlan}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {loading ? (
                      <CircularProgress size={22} />
                    ) : isCurrentPlan ? (
                      'Текущий тариф'
                    ) : isNegotiable ? (
                      'Связаться с нами'
                    ) : (
                      'Управлять подпиской'
                    )}
                  </Button>
                </Paper>
              </Grid>
            );
          }

          return (
          <Grid item xs={12} sm={6} md={4} key={planKey}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 4 },
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                borderRadius: `${radii.panel}px`,
                border: plan.popular ? `2px solid ${colors.primary}` : `1px solid ${colors.divider}`,
                boxShadow: plan.popular
                  ? '0 8px 24px rgba(47, 107, 255, 0.18)'
                  : '0 2px 12px rgba(32, 34, 36, 0.06)',
                bgcolor: colors.card,
                '&:hover': {
                  boxShadow: plan.popular
                    ? '0 12px 28px rgba(47, 107, 255, 0.22)'
                    : '0 6px 18px rgba(32, 34, 36, 0.1)',
                  transform: 'translateY(-4px)',
                  transition: 'all 0.3s',
                },
              }}
            >
              {plan.popular && (
                <Chip
                  label="ПОПУЛЯРНЫЙ"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    fontWeight: 700,
                    bgcolor: colors.primary,
                    color: colors.white,
                    borderRadius: `${radii.button}px`,
                  }}
                />
              )}

              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 800, color: colors.text }}>
                  {plan.name}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textHint, mb: 2 }}>
                  {plan.description}
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 800, color: colors.primary }}>
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
                    <Badge color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Доп. сотрудники"
                    secondary={plan.features.extraStaff}
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
                sx={{
                  mt: 3,
                  borderRadius: `${radii.button}px`,
                  textTransform: 'none',
                  fontWeight: 700,
                  ...(plan.popular
                    ? {
                        bgcolor: colors.primary,
                        boxShadow: '0 4px 14px rgba(47, 107, 255, 0.35)',
                        '&:hover': { bgcolor: colors.primaryDark },
                      }
                    : {
                        borderColor: colors.primary,
                        color: colors.primary,
                        '&:hover': {
                          borderColor: colors.primaryDark,
                          bgcolor: 'rgba(47, 107, 255, 0.06)',
                        },
                      }),
                }}
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
      <Dialog
        open={confirmDialog.open}
        onClose={() => {
          setConfirmDialog({ open: false, plan: null });
          // Очищаем промокод при закрытии диалога
          if (confirmDialog.plan) {
            handleRemovePromoCode(confirmDialog.plan.planType || confirmDialog.plan.code);
          }
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: `${radii.panel}px`,
            border: `1px solid ${colors.divider}`,
            boxShadow: '0 8px 28px rgba(32, 34, 36, 0.12)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: colors.text }}>Подтверждение выбора тарифа</DialogTitle>
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
                      sx={{
                        borderRadius: `${radii.button}px`,
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: colors.primary,
                        color: colors.primary,
                      }}
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
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => {
              setConfirmDialog({ open: false, plan: null });
              // Очищаем промокод при закрытии диалога
              if (confirmDialog.plan) {
                handleRemovePromoCode(confirmDialog.plan.planType || confirmDialog.plan.code);
              }
            }}
            sx={{ textTransform: 'none', borderRadius: `${radii.button}px`, color: colors.textMuted }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleConfirmPayment}
            variant="contained"
            disabled={loading}
            sx={{
              textTransform: 'none',
              borderRadius: `${radii.button}px`,
              bgcolor: colors.primary,
              fontWeight: 700,
              boxShadow: 'none',
              '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
            }}
          >
            {loading ? <CircularProgress size={24} /> : 'Оплатить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Дополнительная информация (только публичный экран) */}
      {!inCabinet && (
      <Box sx={{ mt: 6 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 4 },
                borderRadius: `${radii.panel}px`,
                border: `1px solid ${colors.divider}`,
                boxShadow: '0 2px 12px rgba(32, 34, 36, 0.06)',
                bgcolor: colors.card,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <TrendingUp sx={{ fontSize: 40, color: colors.primary }} />
                <Typography variant="h5" sx={{ fontWeight: 800, color: colors.text }}>
                  Изменение тарифа
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ mb: 2, color: colors.textMuted }}>
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
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 4 },
                borderRadius: `${radii.panel}px`,
                bgcolor: colors.primary,
                color: colors.white,
                boxShadow: '0 8px 24px rgba(47, 107, 255, 0.28)',
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 800 }} gutterBottom>
                Важная информация
              </Typography>
              <Typography variant="body1" sx={{ mb: 2, opacity: 0.95 }}>
                • Возврат средств не предусмотрен, так как услуга предоставляется помесячно
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.95 }}>
                • При отмене подписки вы можете использовать систему до конца оплаченного периода
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
      )}
      </Container>
      {!isAuthenticated && (
        <Box sx={{ bgcolor: colors.surface, borderTop: `1px solid ${colors.divider}`, py: 4 }}>
          <Container maxWidth="md" sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: colors.text }} gutterBottom>
              Дальше по пути
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textHint, mb: 2 }}>
              Нет школы — сначала регистрация. Вопросы по тарифу — в контакты.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Button
                variant="contained"
                onClick={() => navigate('/register')}
                sx={{
                  textTransform: 'none',
                  borderRadius: `${radii.button}px`,
                  bgcolor: colors.primary,
                  fontWeight: 700,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
                }}
              >
                1. Регистрация
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/contacts')}
                sx={{
                  textTransform: 'none',
                  borderRadius: `${radii.button}px`,
                  borderColor: colors.primary,
                  color: colors.primary,
                  fontWeight: 600,
                }}
              >
                3. Контакты
              </Button>
            </Box>
          </Container>
        </Box>
      )}
      {!isAuthenticated && <PublicFooter />}
    </Box>
  );
};

export default Pricing;
