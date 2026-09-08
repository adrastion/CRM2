import React from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';
import Panel from '../dashboard/Panel';
import { colors, typography } from '../../theme/tokens';

interface Props {
  clientId?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидается',
  paid: 'Оплачено',
  cancelled: 'Отменено',
  overdue: 'Просрочено',
};

const TYPE_LABELS: Record<string, string> = {
  membership: 'Абонемент',
  monthly: 'Ежемесячный',
  single: 'Разовое',
  fine: 'Штраф',
  other: 'Другое',
};

function formatDate(iso?: string | Date | null): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

const RUB = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const ClientPaymentsPanel: React.FC<Props> = ({ clientId }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [payments, setPayments] = React.useState<any[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const data = await apiService.getClientPayments(clientId);
        if (!cancelled) setPayments(data || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить платежи');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <Panel title="Мои платежи">
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : error ? (
        <Typography sx={{ color: colors.danger, fontSize: typography.label }}>{error}</Typography>
      ) : payments.length === 0 ? (
        <Typography sx={{ fontSize: typography.label, color: colors.textEmpty, py: 2 }}>
          Вам пока не выставлено ни одного платежа
        </Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell>Тип</TableCell>
                <TableCell>Сумма</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Группа / тариф</TableCell>
                <TableCell>Срок оплаты</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{formatDate(p.paidAt || p.createdAt)}</TableCell>
                  <TableCell>
                    {String(p.notes || '').includes('Списание при выдаче')
                      ? 'Списание абонемента'
                      : `${TYPE_LABELS[p.type] || p.type}${p.isMonthlyPayment ? ' · ежемес.' : ''}`}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{RUB.format(Number(p.amount) || 0)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={
                        String(p.notes || '').includes('Списание при выдаче')
                          ? 'Списание'
                          : STATUS_LABELS[p.status] || p.status
                      }
                      color={
                        String(p.notes || '').includes('Списание при выдаче')
                          ? 'default'
                          : p.status === 'paid'
                            ? 'success'
                            : p.status === 'cancelled'
                              ? 'default'
                              : 'warning'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {[p.groupName, p.membershipName, p.branchName].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell>{formatDate(p.dueDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Panel>
  );
};

export default ClientPaymentsPanel;
