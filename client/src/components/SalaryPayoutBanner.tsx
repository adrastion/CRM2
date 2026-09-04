import React, { useEffect, useState } from 'react';
import { Alert, Button, Collapse } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

/**
 * Баннер OWNER/ADMIN: за 5 дней до дня выплаты зарплаты.
 */
const SalaryPayoutBanner: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reminder, setReminder] = useState<{
    show: boolean;
    daysLeft: number;
    payoutDay: number;
    totalBalance: number;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (user?.role !== 'OWNER' && user?.role !== 'ADMIN') return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiService.getSalaryPayoutReminder();
        if (!cancelled) setReminder(data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  if (!reminder?.show || dismissed) return null;

  const text =
    reminder.daysLeft === 0
      ? `Сегодня день выплаты зарплат (до ${reminder.payoutDay}-го числа). К выплате: ${Number(
          reminder.totalBalance
        ).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}.`
      : `До выплаты зарплат осталось ${reminder.daysLeft} дн. К выплате: ${Number(
          reminder.totalBalance
        ).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}.`;

  return (
    <Collapse in={!dismissed}>
      <Alert
        severity="warning"
        sx={{ borderRadius: 0 }}
        onClose={() => setDismissed(true)}
        action={
          <Button color="inherit" size="small" onClick={() => navigate('/finance')}>
            К зарплатам
          </Button>
        }
      >
        {text}
      </Alert>
    </Collapse>
  );
};

export default SalaryPayoutBanner;
