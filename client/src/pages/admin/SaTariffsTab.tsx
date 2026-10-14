import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  Button,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Add, Edit } from '@mui/icons-material';
import type { SubscriptionPlanItem } from '../../types';

export type SaTariffsTabProps = {
  canWrite: boolean;
  planPrices: SubscriptionPlanItem[];
  planPricesLoading: boolean;
  formatPlanPrice: (plan: { price: number | null; isNegotiable?: boolean }) => string;
  onCreatePlan: () => void;
  onEditPlan: (plan: SubscriptionPlanItem) => void;
};

const SaTariffsTab: React.FC<SaTariffsTabProps> = ({
  canWrite,
  planPrices,
  planPricesLoading,
  formatPlanPrice,
  onCreatePlan,
  onEditPlan,
}) => {
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Управление тарифами
        </Typography>
        {canWrite && (
          <Button variant="contained" startIcon={<Add />} onClick={onCreatePlan}>
            Создать тариф
          </Button>
        )}
      </Box>

      {planPricesLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : planPrices && planPrices.length > 0 ? (
        <Grid container spacing={3}>
          {planPrices.map((plan) => (
            <Grid item xs={12} md={6} lg={4} key={plan.code || plan.planType}>
              <Card
                sx={{
                  cursor: canWrite ? 'pointer' : 'default',
                  opacity: plan.isActive ? 1 : 0.7,
                  '&:hover': canWrite ? { boxShadow: 6 } : undefined,
                  transition: 'box-shadow 0.3s',
                }}
                onClick={() => canWrite && onEditPlan(plan)}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        {plan.name || plan.planType}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {plan.code || plan.planType}
                      </Typography>
                    </Box>
                    {canWrite && <Edit fontSize="small" color="action" />}
                  </Box>
                  <Box display="flex" flexWrap="wrap" gap={0.5} mb={1}>
                    <Chip
                      label={plan.isPublic ? 'Публичный' : 'Индивидуальный'}
                      size="small"
                      color={plan.isPublic ? 'primary' : 'default'}
                      variant="outlined"
                    />
                    <Chip
                      label={plan.isActive ? 'Активен' : 'Архив'}
                      size="small"
                      color={plan.isActive ? 'success' : 'warning'}
                    />
                    <Chip
                      label={`Подписок: ${plan.subscriptionsCount ?? 0}`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom>
                    {formatPlanPrice(plan)}
                  </Typography>
                  {plan.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {plan.description}
                    </Typography>
                  )}
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Лимиты:
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Порядок отображения: {plan.sortOrder ?? 0}
                    </Typography>
                    <Typography variant="body2">
                      Тренеры: {plan.limits.trainers === 'unlimited' ? 'Безлимит' : plan.limits.trainers}
                    </Typography>
                    <Typography variant="body2">
                      Доп. сотрудники:{' '}
                      {plan.limits.extraStaff === 'unlimited'
                        ? 'Безлимит'
                        : plan.limits.extraStaff ?? 'Безлимит'}
                    </Typography>
                    <Typography variant="body2">
                      Клиенты: {plan.limits.clients === 'unlimited' ? 'Безлимит' : plan.limits.clients}
                    </Typography>
                    <Typography variant="body2">
                      Группы: {plan.limits.groups === 'unlimited' ? 'Безлимит' : plan.limits.groups}
                    </Typography>
                    <Typography variant="body2">
                      Филиалы: {plan.limits.branches === 'unlimited' ? 'Безлимит' : plan.limits.branches}
                    </Typography>
                    <Typography variant="body2">
                      Тренировки:{' '}
                      {plan.limits.trainings === 'unlimited' ? 'Безлимит' : `${plan.limits.trainings}/мес`}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">Тарифы не найдены</Alert>
      )}
    </Box>
  );
};

export default SaTariffsTab;
