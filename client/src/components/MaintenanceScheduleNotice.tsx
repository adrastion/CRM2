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

function isHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function applyScheduleFromStatus(status: any): string | null {
  const enabled = Boolean(status?.maintenance?.enabled ?? status?.enabled);
  if (enabled) return null;
  return status?.maintenance?.scheduledAt || null;
}

/** Объявление и полноэкранный таймер за 15 минут до плановых техработ. Супер-админ его не видит.
 *  Не поллит сам — слушает единый `maintenance-status` из MaintenanceGate (App). */
const MaintenanceScheduleNotice: React.FC<{ isSuperAdmin: boolean }> = ({ isSuperAdmin }) => {
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [countdown, setCountdown] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) return;
    let cancelled = false;
    // Один стартовый снимок (если Gate ещё не успел разослать событие).
    void apiService
      .getMaintenanceStatus()
      .then((status) => {
        if (!cancelled) setScheduledAt(applyScheduleFromStatus(status));
      })
      .catch(() => undefined);

    const onStatus = (e: Event) => {
      const status = (e as CustomEvent).detail;
      setScheduledAt(applyScheduleFromStatus(status));
    };
    window.addEventListener('maintenance-status', onStatus as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener('maintenance-status', onStatus as EventListener);
    };
  }, [isSuperAdmin]);

  // Включаем секундный тик только в окне обратного отсчёта.
  useEffect(() => {
    if (isSuperAdmin || !scheduledAt) {
      setCountdown(false);
      return;
    }
    const start = new Date(scheduledAt).getTime();
    if (Number.isNaN(start)) {
      setCountdown(false);
      return;
    }

    let tickId: number | null = null;
    let armId: number | null = null;

    const stopTick = () => {
      if (tickId != null) {
        window.clearInterval(tickId);
        tickId = null;
      }
    };

    const startTick = () => {
      setCountdown(true);
      setNow(Date.now());
      stopTick();
      tickId = window.setInterval(() => {
        if (isHidden()) return;
        const t = Date.now();
        setNow(t);
        if (t >= start) stopTick();
      }, 1000);
    };

    const arm = () => {
      const left = start - Date.now();
      if (left <= 0) {
        setCountdown(false);
        stopTick();
        return;
      }
      if (left <= WARN_MS) {
        startTick();
        return;
      }
      setCountdown(false);
      stopTick();
      armId = window.setTimeout(startTick, left - WARN_MS);
    };

    arm();
    const onVis = () => {
      if (!isHidden()) arm();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stopTick();
      if (armId != null) window.clearTimeout(armId);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isSuperAdmin, scheduledAt]);

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

  if (countdown && left <= WARN_MS) {
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
