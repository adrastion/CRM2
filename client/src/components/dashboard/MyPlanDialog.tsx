import React from 'react';
import {
  Apartment,
  CalendarToday,
  CheckCircle,
  Close,
  Groups,
  InfoOutlined,
  PeopleAlt,
  PersonAddAlt1,
  PersonOutline,
  SyncAlt,
  WorkspacePremium,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  LinearProgress,
  Typography,
} from '@mui/material';
import { colors, radii } from '../../theme/tokens';

export interface PlanUsageData {
  subscription: {
    planType?: string;
    planName?: string;
    status?: string;
    endDate?: string | null;
  };
  limits: Record<string, number | 'unlimited'>;
  usage: Record<string, number>;
  remaining: Record<string, number | 'unlimited'>;
  usagePercent: Record<string, number>;
}

interface MyPlanDialogProps {
  open: boolean;
  loading: boolean;
  data: PlanUsageData | null;
  onClose: () => void;
  onChangePlan: () => void;
}

const RESOURCES = [
  {
    key: 'clients',
    label: 'Клиенты',
    color: '#2F6BFF',
    soft: '#E8F0FF',
    Icon: PeopleAlt,
  },
  {
    key: 'trainers',
    label: 'Тренеры',
    color: '#00B69B',
    soft: '#E6F8F5',
    Icon: PersonOutline,
  },
  {
    key: 'extraStaff',
    label: 'Доп. сотрудники',
    color: '#F06292',
    soft: '#FDE8F0',
    Icon: PersonAddAlt1,
  },
  {
    key: 'groups',
    label: 'Группы',
    color: '#FF8A4C',
    soft: '#FFF0E6',
    Icon: Groups,
  },
  {
    key: 'branches',
    label: 'Филиалы',
    color: '#7E57C2',
    soft: '#F1E9FF',
    Icon: Apartment,
  },
] as const;

const BENEFITS = [
  'Максимальные лимиты для роста вашего центра',
  'Все функции системы доступны',
  'Приоритетная поддержка наших специалистов',
  'Регулярные обновления и новые возможности',
];

const formatLimit = (value: number | 'unlimited' | undefined) =>
  value === 'unlimited' || value == null ? '∞' : String(value);

const MyPlanDialog: React.FC<MyPlanDialogProps> = ({
  open,
  loading,
  data,
  onClose,
  onChangePlan,
}) => {
  const planName = data?.subscription?.planName || data?.subscription?.planType || 'Тариф';
  const isActive = data?.subscription?.status === 'active';
  const endDate = data?.subscription?.endDate
    ? new Date(data.subscription.endDate).toLocaleDateString('ru-RU')
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(27, 36, 56, 0.22)',
          maxWidth: 760,
        },
      }}
      BackdropProps={{
        sx: { bgcolor: 'rgba(27, 36, 56, 0.45)', backdropFilter: 'blur(2px)' },
      }}
    >
      <Box sx={{ position: 'relative', p: { xs: 2.5, md: 3.25 } }}>
        <IconButton
          aria-label="Закрыть"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 14,
            right: 14,
            color: colors.textHint,
            '&:hover': { bgcolor: colors.surface },
          }}
        >
          <Close />
        </IconButton>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : !data ? (
          <Typography sx={{ color: colors.danger, py: 4, textAlign: 'center' }}>
            Не удалось загрузить информацию о тарифе
          </Typography>
        ) : (
          <>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2,
                pr: 4,
                mb: 2,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: colors.textHint,
                    mb: 0.75,
                  }}
                >
                  МОЙ ТАРИФ
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: 24, md: 30 },
                    fontWeight: 800,
                    color: '#1B2438',
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {planName}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.25 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1.1,
                      py: 0.45,
                      borderRadius: '999px',
                      bgcolor: isActive ? '#E8F8F1' : colors.surface,
                      color: isActive ? '#16A34A' : colors.textMuted,
                    }}
                  >
                    <CheckCircle sx={{ fontSize: 15 }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                      {isActive ? 'Активна' : 'Неактивна'}
                    </Typography>
                  </Box>
                  {endDate && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1.1,
                        py: 0.45,
                        borderRadius: '999px',
                        bgcolor: '#F1F3F7',
                        color: colors.textMuted,
                      }}
                    >
                      <CalendarToday sx={{ fontSize: 13 }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                        Действует до: {endDate}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              <Box
                aria-hidden
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '18px',
                  flexShrink: 0,
                  background: 'linear-gradient(145deg, #7B5CFF 0%, #2F6BFF 100%)',
                  boxShadow: '0 10px 28px rgba(91, 90, 255, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <WorkspacePremium sx={{ fontSize: 36, color: '#FFD56A' }} />
              </Box>
            </Box>

            {/* Info banner */}
            <Box
              sx={{
                display: 'flex',
                gap: 1.25,
                alignItems: 'flex-start',
                bgcolor: '#EAF2FF',
                borderRadius: '14px',
                px: 1.75,
                py: 1.4,
                mb: 2.25,
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: colors.primary,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  mt: 0.1,
                }}
              >
                <InfoOutlined sx={{ fontSize: 16 }} />
              </Box>
              <Typography sx={{ fontSize: 13, color: '#2A3A55', lineHeight: 1.45 }}>
                Здесь вы можете посмотреть текущие лимиты вашего тарифа и использование.
                Контролируйте количество клиентов, сотрудников, групп и других возможностей.
              </Typography>
            </Box>

            {/* Usage rows */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, mb: 2.5 }}>
              {RESOURCES.map((resource) => {
                const limit = data.limits[resource.key];
                const used = data.usage[resource.key] ?? 0;
                const remaining = data.remaining[resource.key];
                const percent =
                  limit === 'unlimited' ? 0 : Math.min(100, data.usagePercent[resource.key] ?? 0);
                const Icon = resource.Icon;

                return (
                  <Box
                    key={resource.key}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                      gap: { xs: 1, sm: 1.5 },
                      alignItems: 'center',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: '12px',
                          bgcolor: resource.soft,
                          color: resource.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: colors.text }}>
                          {resource.label}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: colors.textMuted, mb: 0.6 }}>
                          Использовано {used} из {formatLimit(limit)}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={percent}
                          sx={{
                            height: 8,
                            borderRadius: 999,
                            bgcolor: '#EEF1F6',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: resource.color,
                              borderRadius: 999,
                            },
                          }}
                        />
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        justifySelf: { xs: 'stretch', sm: 'end' },
                        minWidth: { sm: 118 },
                        px: 1.25,
                        py: 0.85,
                        borderRadius: '12px',
                        bgcolor: '#F5F6FA',
                        textAlign: 'center',
                      }}
                    >
                      <Typography sx={{ fontSize: 10, color: colors.textHint, fontWeight: 600 }}>
                        Осталось
                      </Typography>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: colors.text, lineHeight: 1.2 }}>
                        {formatLimit(remaining)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* Benefits */}
            <Box
              sx={{
                bgcolor: '#F4F0FF',
                borderRadius: '16px',
                px: 2,
                py: 1.75,
                mb: 2.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
                <WorkspacePremium sx={{ fontSize: 18, color: '#C9A227' }} />
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#1B2438' }}>
                  Преимущества вашего тарифа
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.1,
                }}
              >
                {BENEFITS.map((text) => (
                  <Box key={text} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.85 }}>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        bgcolor: colors.primary,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        mt: 0.15,
                      }}
                    >
                      <CheckCircle sx={{ fontSize: 14 }} />
                    </Box>
                    <Typography sx={{ fontSize: 13, color: '#2A3A55', lineHeight: 1.35, fontWeight: 500 }}>
                      {text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Footer */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.25, flexWrap: 'wrap' }}>
              <Button
                onClick={onClose}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 2.25,
                  height: 42,
                  borderRadius: `${radii.button}px`,
                  color: colors.text,
                  border: '1px solid #E1E4EC',
                  bgcolor: colors.card,
                  '&:hover': { bgcolor: colors.surface },
                }}
              >
                Закрыть
              </Button>
              <Button
                onClick={onChangePlan}
                startIcon={<SyncAlt />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 2.25,
                  height: 42,
                  borderRadius: `${radii.button}px`,
                  color: '#fff',
                  background: 'linear-gradient(90deg, #2F6BFF 0%, #7B5CFF 100%)',
                  boxShadow: '0 8px 18px rgba(47, 107, 255, 0.28)',
                  '&:hover': {
                    background: 'linear-gradient(90deg, #265CE6 0%, #6A4DE8 100%)',
                    boxShadow: '0 10px 22px rgba(47, 107, 255, 0.34)',
                  },
                }}
              >
                Изменить тариф
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Dialog>
  );
};

export default MyPlanDialog;
