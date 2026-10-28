import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  Switch,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';
import ActiveSessionsPanel from '../auth/ActiveSessionsPanel';
import PasswordField from '../common/PasswordField';
import {
  browserNotificationPermission,
  checkActorPushStatus,
  subscribeActorPush,
  unsubscribeActorPush,
} from '../../utils/actorPush';
import { colors, radii, typography } from '../../theme/tokens';

const cardSx = {
  bgcolor: colors.card,
  borderRadius: `${radii.panel}px`,
  boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
  border: '1px solid #EEF1F6',
  p: { xs: 2, md: 2.5 },
} as const;

type Props = {
  onLogoutEverywhere: () => void;
};

/**
 * Вкладка «Настройки» ЛК ученика — макет Reference LK clients/Уведомления.png
 */
const ClientSettingsPanel: React.FC<Props> = ({ onLogoutEverywhere }) => {
  const [email2fa, setEmail2fa] = useState(false);
  const [email2faLoading, setEmail2faLoading] = useState(true);
  const [email2faSaving, setEmail2faSaving] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const permission = browserNotificationPermission();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEmail2faLoading(true);
      try {
        const data = await apiService.getLoginSecurity();
        if (!cancelled) setEmail2fa(Boolean(data.email2faEnabled));
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.error || 'Не удалось загрузить настройки входа');
        }
      } finally {
        if (!cancelled) setEmail2faLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const on = await checkActorPushStatus('portal');
        if (!cancelled) setPushOn(on);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle2fa = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setEmail2faSaving(true);
    setError('');
    const prev = email2fa;
    setEmail2fa(checked);
    try {
      const data = await apiService.updateLoginSecurity({ email2faEnabled: checked });
      setEmail2fa(Boolean(data.email2faEnabled));
    } catch (e: any) {
      setEmail2fa(prev);
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setEmail2faSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('Новые пароли не совпадают');
      return;
    }
    if (newPassword.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }
    setPasswordSaving(true);
    try {
      await apiService.changePortalPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Пароль успешно изменён. Другие сессии завершены.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось изменить пароль');
    } finally {
      setPasswordSaving(false);
    }
  };

  const onTogglePush = useCallback(async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setPushBusy(true);
    setError('');
    try {
      if (checked) {
        const ok = await subscribeActorPush('portal');
        if (!ok) {
          setError(
            browserNotificationPermission() === 'denied'
              ? 'Уведомления запрещены в настройках браузера'
              : 'Не удалось включить уведомления'
          );
          return;
        }
        setPushOn(true);
        try {
          await apiService.updatePortalNotificationPrefs({ pushMasterEnabled: true });
        } catch {
          /* ignore */
        }
      } else {
        const ok = await unsubscribeActorPush('portal');
        if (!ok) throw new Error('unsubscribe failed');
        setPushOn(false);
        try {
          await apiService.updatePortalNotificationPrefs({ pushMasterEnabled: false });
        } catch {
          /* ignore */
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось изменить уведомления');
    } finally {
      setPushBusy(false);
    }
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 920 }}>
      <Typography sx={{ fontSize: typography.label, color: colors.textMuted, maxWidth: 720, mt: -0.5 }}>
        Настройте безопасность аккаунта и удобные способы получения уведомлений о важных событиях.
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ borderRadius: `${radii.panel}px` }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ borderRadius: `${radii.panel}px` }}>
          {success}
        </Alert>
      )}

      <Box
        sx={{
          ...cardSx,
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: typography.panelTitle, color: colors.text, mb: 0.5 }}>
            Двухфакторная аутентификация
          </Typography>
          <Typography sx={{ fontSize: typography.label, color: colors.textMuted, lineHeight: 1.5 }}>
            После ввода пароля потребуется код из письма на вашу почту.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {email2faLoading ? (
            <CircularProgress size={22} />
          ) : (
            <>
              <Typography sx={{ fontSize: typography.label, color: colors.textMuted, fontWeight: 600 }}>
                {email2fa ? 'Включена' : 'Выключена'}
              </Typography>
              <Switch
                checked={email2fa}
                onChange={onToggle2fa}
                disabled={email2faSaving}
                color="primary"
              />
            </>
          )}
        </Box>
      </Box>

      <Box sx={cardSx}>
        <Typography sx={{ fontWeight: 800, fontSize: typography.panelTitle, color: colors.text, mb: 0.5 }}>
          Смена пароля
        </Typography>
        <Typography sx={{ fontSize: typography.label, color: colors.textMuted, lineHeight: 1.5, mb: 2 }}>
          После смены пароля вход на других устройствах будет завершён.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
            gap: 1.5,
            mb: 2,
          }}
        >
          <PasswordField
            fullWidth
            size="small"
            label="Текущий пароль"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <PasswordField
            fullWidth
            size="small"
            label="Новый пароль"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            helperText="Минимум 6 символов"
          />
          <PasswordField
            fullWidth
            size="small"
            label="Подтвердите пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Box>
        <Button
          variant="contained"
          onClick={() => void handleChangePassword()}
          disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: `${radii.button}px`,
            bgcolor: colors.primary,
            boxShadow: '0 6px 16px rgba(47, 107, 255, 0.28)',
            px: 2.5,
            py: 1,
            width: { xs: '100%', sm: 'auto' },
            '&:hover': { bgcolor: colors.primaryDark },
          }}
        >
          {passwordSaving ? 'Сохранение…' : 'Изменить пароль'}
        </Button>
      </Box>

      <Box sx={cardSx}>
        <ActiveSessionsPanel paper={false} onLogoutEverywhere={onLogoutEverywhere} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
        }}
      >
        <Box
          sx={{
            ...cardSx,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: typography.panelTitle, color: colors.text, mb: 0.5 }}>
              Браузерные уведомления
            </Typography>
            <Typography sx={{ fontSize: typography.label, color: colors.textMuted, lineHeight: 1.5 }}>
              {permission === 'denied'
                ? 'Разрешение отклонено в браузере. Включите уведомления в настройках сайта.'
                : permission === 'unsupported'
                  ? 'Этот браузер не поддерживает уведомления.'
                  : 'Включите уведомления, чтобы получать сообщения (и изменения) в браузере.'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Typography sx={{ fontSize: typography.label, color: colors.textMuted, fontWeight: 600 }}>
              {pushOn ? 'Включены' : 'Выключены'}
            </Typography>
            <Switch
              checked={pushOn}
              onChange={onTogglePush}
              disabled={pushBusy || permission === 'denied' || permission === 'unsupported'}
              color="primary"
            />
          </Box>
        </Box>

        <Box sx={cardSx}>
          <Typography sx={{ fontWeight: 800, fontSize: typography.panelTitle, color: colors.text, mb: 0.5 }}>
            Уведомления о безопасности
          </Typography>
          <Typography sx={{ fontSize: typography.label, color: colors.textMuted, lineHeight: 1.5, mb: 1.25 }}>
            Выберите, о каких событиях мы будем вас уведомлять.
          </Typography>
          <FormGroup>
            {[
              'Вход с нового устройства',
              'Изменение пароля',
              'Подозрительная активность',
            ].map((label) => (
              <FormControlLabel
                key={label}
                control={<Checkbox checked disabled color="primary" size="small" />}
                label={
                  <Typography sx={{ fontSize: typography.label, color: colors.text, fontWeight: 500 }}>
                    {label}
                  </Typography>
                }
                sx={{ ml: 0, mr: 0, mb: 0.25 }}
              />
            ))}
          </FormGroup>
          <Typography sx={{ mt: 0.5, fontSize: typography.hint, color: colors.textHint }}>
            Эти уведомления всегда включены для защиты аккаунта.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ClientSettingsPanel;
