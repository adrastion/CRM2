import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';
import AuthButton from '../components/auth/AuthButton';
import { apiService } from '../services/api';
import { hasAnySession, currentSessionDestination } from '../utils/authSession';
import { colors, typography } from '../theme/tokens';

/**
 * Подтверждение входа по QR с уже авторизованного устройства.
 */
const DeviceApprove: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const challengeToken = params.get('challenge') || '';
  const secret = params.get('secret') || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'approved' | 'denied' | null>(null);

  const loggedIn = useMemo(() => hasAnySession(), []);

  useEffect(() => {
    if (!challengeToken || !secret) {
      setError('Некорректная ссылка');
    }
  }, [challengeToken, secret]);

  const approve = async () => {
    setLoading(true);
    setError('');
    try {
      await apiService.approveQrLogin({ challengeToken, secret });
      setDone('approved');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось подтвердить');
    } finally {
      setLoading(false);
    }
  };

  const deny = async () => {
    setLoading(true);
    setError('');
    try {
      await apiService.denyQrLogin({ challengeToken, secret });
      setDone('denied');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отклонить');
    } finally {
      setLoading(false);
    }
  };

  if (!loggedIn) {
    return (
      <AuthShell title="Подтверждение входа">
        <Typography sx={{ color: colors.textMuted, textAlign: 'center', mb: 2 }}>
          Откройте эту ссылку в браузере, где вы уже вошли в аккаунт.
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <AuthButton onClick={() => navigate('/auth')}>Войти</AuthButton>
        </Box>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Подтверждение входа">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        {done === 'approved' && (
          <Typography sx={{ color: colors.text, textAlign: 'center' }}>
            Вход подтверждён. Можно вернуться к устройству, на котором показывали QR.
          </Typography>
        )}
        {done === 'denied' && (
          <Typography sx={{ color: colors.text, textAlign: 'center' }}>
            Вход отклонён.
          </Typography>
        )}
        {!done && (
          <>
            <Typography sx={{ color: colors.textMuted, fontSize: typography.label, textAlign: 'center' }}>
              Разрешить вход на другом устройстве под этим аккаунтом?
            </Typography>
            {error ? (
              <Typography sx={{ color: colors.danger, fontSize: typography.hint }}>{error}</Typography>
            ) : null}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <AuthButton onClick={approve} loading={loading}>
                Разрешить
              </AuthButton>
              <AuthButton variant="dark" onClick={deny} loading={loading}>
                Отклонить
              </AuthButton>
            </Box>
          </>
        )}
        <Typography
          component="button"
          type="button"
          onClick={() => {
            const dest = currentSessionDestination() || '/dashboard';
            navigate(dest);
          }}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: colors.primary,
            fontSize: typography.hint,
          }}
        >
          В кабинет
        </Typography>
      </Box>
    </AuthShell>
  );
};

export default DeviceApprove;
