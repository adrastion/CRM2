import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import ActiveSessionsPanel from '../../components/auth/ActiveSessionsPanel';
import Email2faSettingsToggle from '../../components/auth/Email2faSettingsToggle';
import PasswordField from '../../components/common/PasswordField';
import { useMarketerAuth } from '../../contexts/MarketerAuthContext';
import { apiService } from '../../services/api';
import { marketerCardSx } from './marketerUi';

const cardSx = {
  ...marketerCardSx,
  p: { xs: 2, md: 2.5 },
  mb: 2,
} as const;

/**
 * Настройки кабинета маркетолога: сессии, пароль, уведомления.
 */
const MarketerSettings: React.FC = () => {
  const { logout } = useMarketerAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [changelogEnabled, setChangelogEnabled] = useState(true);
  const [pushMasterEnabled, setPushMasterEnabled] = useState(true);
  const [chatMessagesEnabled, setChatMessagesEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPrefsLoading(true);
      try {
        const prefs = await apiService.getMarketerNotificationPrefs();
        if (cancelled) return;
        setChangelogEnabled(Boolean(prefs.changelogEnabled));
        setPushMasterEnabled(Boolean(prefs.pushMasterEnabled));
        setChatMessagesEnabled(Boolean(prefs.chatMessagesEnabled));
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.error || 'Не удалось загрузить настройки уведомлений');
        }
      } finally {
        if (!cancelled) setPrefsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const savePrefs = async (patch: {
    changelogEnabled?: boolean;
    pushMasterEnabled?: boolean;
    chatMessagesEnabled?: boolean;
  }) => {
    setPrefsSaving(true);
    setError('');
    setSuccess('');
    try {
      const prefs = await apiService.updateMarketerNotificationPrefs(patch);
      setChangelogEnabled(Boolean(prefs.changelogEnabled));
      setPushMasterEnabled(Boolean(prefs.pushMasterEnabled));
      setChatMessagesEnabled(Boolean(prefs.chatMessagesEnabled));
      setSuccess('Настройки уведомлений сохранены');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить уведомления');
    } finally {
      setPrefsSaving(false);
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
      await apiService.changeMarketerPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Пароль успешно изменён');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось изменить пароль');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5, color: '#13213a' }}>
        Настройки
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Активные сессии, смена пароля и уведомления
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Box sx={cardSx}>
        <Typography fontWeight={700} sx={{ mb: 1.5 }}>
          Безопасность входа
        </Typography>
        <Email2faSettingsToggle />
      </Box>

      <Box sx={cardSx}>
        <Typography fontWeight={700} sx={{ mb: 1.5 }}>
          Активные сессии
        </Typography>
        <ActiveSessionsPanel
          paper={false}
          onLogoutEverywhere={() => {
            logout();
          }}
        />
      </Box>

      <Box sx={cardSx}>
        <Typography fontWeight={700} sx={{ mb: 1.5 }}>
          Смена пароля
        </Typography>
        <Stack spacing={1.5} sx={{ maxWidth: 420 }}>
          <PasswordField
            label="Текущий пароль"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            size="small"
            fullWidth
          />
          <PasswordField
            label="Новый пароль"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            size="small"
            fullWidth
          />
          <PasswordField
            label="Повторите новый пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            size="small"
            fullWidth
          />
          <Button
            variant="contained"
            disabled={passwordSaving || !currentPassword || !newPassword}
            onClick={() => void handleChangePassword()}
            sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
          >
            {passwordSaving ? <CircularProgress size={20} color="inherit" /> : 'Сменить пароль'}
          </Button>
        </Stack>
      </Box>

      <Box sx={cardSx}>
        <Typography fontWeight={700} sx={{ mb: 1 }}>
          Уведомления
        </Typography>
        {prefsLoading ? (
          <CircularProgress size={24} />
        ) : (
          <Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={changelogEnabled}
                  disabled={prefsSaving}
                  onChange={(_, v) => {
                    setChangelogEnabled(v);
                    void savePrefs({ changelogEnabled: v });
                  }}
                />
              }
              label="Новости и обновления платформы"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={chatMessagesEnabled}
                  disabled={prefsSaving}
                  onChange={(_, v) => {
                    setChatMessagesEnabled(v);
                    void savePrefs({ chatMessagesEnabled: v });
                  }}
                />
              }
              label="Сообщения поддержки"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={pushMasterEnabled}
                  disabled={prefsSaving}
                  onChange={(_, v) => {
                    setPushMasterEnabled(v);
                    void savePrefs({ pushMasterEnabled: v });
                  }}
                />
              }
              label="Push-уведомления (общий переключатель)"
            />
          </Stack>
        )}
      </Box>
    </Box>
  );
};

export default MarketerSettings;
