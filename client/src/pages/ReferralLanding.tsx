import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../services/api';

const REF_CODE_KEY = 'refCode';

/** Публичный лендинг /ref/:code — трек клика, сохранение кода, редирект. */
const ReferralLanding: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        navigate('/', { replace: true });
        return;
      }
      try {
        const data = await apiService.trackReferralClick(code);
        const stored = (data?.code || code).toString();
        localStorage.setItem(REF_CODE_KEY, stored);
        try {
          document.cookie = `refCode=${encodeURIComponent(stored)};path=/;max-age=${60 * 60 * 24 * 90};SameSite=Lax`;
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        const target = data?.url && String(data.url).trim() ? String(data.url).trim() : '/';
        if (/^https?:\/\//i.test(target)) {
          window.location.replace(target);
        } else {
          navigate(target.startsWith('/') ? target : `/${target}`, { replace: true });
        }
      } catch {
        if (!cancelled) {
          localStorage.setItem(REF_CODE_KEY, code);
          setError('Ссылка недоступна. Перенаправляем…');
          setTimeout(() => navigate('/', { replace: true }), 1200);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="50vh" gap={2}>
      <CircularProgress />
      <Typography color="text.secondary">{error || 'Переход по реферальной ссылке…'}</Typography>
    </Box>
  );
};

export default ReferralLanding;
export { REF_CODE_KEY };
