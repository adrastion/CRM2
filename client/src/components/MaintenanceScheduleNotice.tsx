import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { apiService } from '../services/api';

const WARN_MS = 15 * 60 * 1000;

function formatLeft(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Объявление и полноэкранный таймер за 15 минут до плановых техработ. Супер-админ его не видит. */
const MaintenanceScheduleNotice: React.FC<{ isSuperAdmin: boolean }> = ({ isSuperAdmin }) => {
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (isSuperAdmin) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const status = await apiService.getMaintenanceStatus();
        if (cancelled) return;
        const at = status?.maintenance?.scheduledAt || null;
        const enabled = Boolean(status?.maintenance?.enabled ?? status?.enabled);
        setScheduledAt(enabled ? null : at);
        if (enabled) {
          window.dispatchEvent(new CustomEvent('maintenance-mode', { detail: { mode: 'maintenance' } }));
        }
      } catch {
        /* публичный статус может быть недоступен */
      }
    };
    void pull();
    const poll = window.setInterval(pull, 20000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [isSuperAdmin]);

  if (isSuperAdmin || !scheduledAt) return null;
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start) || start <= now) return null;
  const left = start - now;
  const when = new Date(scheduledAt).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (left <= WARN_MS) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 2000,
          bgcolor: 'rgba(18, 18, 18, 0.92)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          px: 3,
        }}
      >
        <Typography variant="h5" sx={{ mb: 2 }}>
          Сайт закроется на технические работы
        </Typography>
        <Typography variant="h2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatLeft(left)}
        </Typography>
        <Typography sx={{ mt: 2, opacity: 0.85 }}>Старт: {when}</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1400,
        bgcolor: 'warning.main',
        color: 'warning.contrastText',
        px: 2,
        py: 1,
        textAlign: 'center',
      }}
    >
      <Typography variant="body2">
        {when} сайт закроют на технические работы.
      </Typography>
    </Box>
  );
};

export default MaintenanceScheduleNotice;
