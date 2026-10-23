import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Paper,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AccountCircleOutlined,
  CalendarMonthOutlined,
  ExtensionOutlined,
  LockOutlined,
  NotificationsNoneOutlined,
  PaletteOutlined,
  PolicyOutlined,
  Save,
  School,
  StorefrontOutlined,
} from '@mui/icons-material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { setHours, setMinutes } from 'date-fns';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { canEditSchoolFinanceSettings, isOwnerOrAdmin } from '../utils/roles';
import NotificationSettingsPanel from '../components/notifications/NotificationSettingsPanel';
import Email2faSettingsToggle from '../components/auth/Email2faSettingsToggle';
import ActiveSessionsPanel from '../components/auth/ActiveSessionsPanel';
import PasswordField from '../components/common/PasswordField';
import UnsavedChangesDialog from '../components/common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../hooks/useUnsavedClose';
import { colors, radii, typography } from '../theme/tokens';
import SettingsSchedulePanel from '../components/settings/SettingsSchedulePanel';
import { ScheduleConfig } from '../components/settings/scheduleConfig';

const sectionPaperSx = {
  p: { xs: 2, sm: 2.5 },
  borderRadius: `${radii.panel}px`,
  border: `1px solid ${colors.divider}`,
  boxShadow: '0 2px 10px rgba(32, 34, 36, 0.05)',
  bgcolor: colors.card,
};

const btnPrimarySx = {
  textTransform: 'none' as const,
  borderRadius: `${radii.button}px`,
  bgcolor: colors.primary,
  fontWeight: 600,
  boxShadow: 'none',
  '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>}
    </div>
  );
}

const Settings: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canEditFinanceSettings = canEditSchoolFinanceSettings(user?.role);
  const canEditSchoolSettings = isOwnerOrAdmin(user?.role);
  const showNotificationsTab =
    user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'TRAINER';
  const TAB = {
    schedule: 0,
    account: 1,
    notifications: 2,
    interface: 3,
    branches: 4,
    roles: 5,
    integrations: 6,
    security: 7,
  } as const;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'notifications' && showNotificationsTab) {
      setTabValue(TAB.notifications);
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, showNotificationsTab]);
  
  // Настройки расписания
  const [defaultTrainingDuration, setDefaultTrainingDuration] = useState<number>(90);
  const [membershipFeeResetDate, setMembershipFeeResetDate] = useState<string>('');
  const [salaryPayoutDay, setSalaryPayoutDay] = useState<number>(25);
  const [clientCanViewAllTrainers, setClientCanViewAllTrainers] = useState<boolean>(false);
  const [clientCanViewAllBranches, setClientCanViewAllBranches] = useState<boolean>(false);
  const [chatMessageEditLimitMinutes, setChatMessageEditLimitMinutes] = useState<number>(15);
  const [chatMessageDeleteLimitMinutes, setChatMessageDeleteLimitMinutes] = useState<number>(15);
  const [staffTaskColor, setStaffTaskColor] = useState<string>('#6A1B9A');
  const [scheduleConfigRaw, setScheduleConfigRaw] = useState<unknown>(null);
  
  // Смена email
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailFormBaseline, setEmailFormBaseline] = useState({ newEmail: '', emailPassword: '' });

  // Подтверждение email
  const [verifyCode, setVerifyCode] = useState('');
  const [verifySending, setVerifySending] = useState(false);
  const [verifyChecking, setVerifyChecking] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  
  // Смена пароля
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Настройка вкладок
  const [visibleTabs, setVisibleTabs] = useState<{ [key: string]: boolean }>({});

  // Повторное прохождение обучения
  const [restartingOnboarding, setRestartingOnboarding] = useState(false);

  // Настройки уведомлений (только для тренеров)
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState({
    allTrainingsEnabled: false,
    allTrainingsTime: null as Date | null,
    notificationPeriod: 'tomorrow' as 'tomorrow' | 'week' | 'month',
    reminderEnabled: false,
    reminderBeforeMinutes: 60,
    timezone: 'UTC',
  });
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const handleRestartOnboarding = async () => {
    try {
      setRestartingOnboarding(true);
      setError(null);
      
      // Сбрасываем статус обучения
      await apiService.updateOnboardingStatus({
        hasCompletedOnboarding: false,
        onboardingDeclined: false,
      });
      
      // Отправляем событие для открытия обучения
      const event = new CustomEvent('restartOnboarding');
      window.dispatchEvent(event);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Не удалось сбросить статус обучения');
      console.error('Error restarting onboarding:', err);
    } finally {
      setRestartingOnboarding(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await apiService.getSettings();
        if (response.data) {
          setDefaultTrainingDuration(response.data.defaultTrainingDuration || 90);
          setMembershipFeeResetDate(response.data.membershipFeeResetDate || '12-01');
          setSalaryPayoutDay(response.data.salaryPayoutDay || 25);
          setClientCanViewAllTrainers(response.data.clientCanViewAllTrainers || false);
          setClientCanViewAllBranches(response.data.clientCanViewAllBranches || false);
          setChatMessageEditLimitMinutes(
            typeof response.data.chatMessageEditLimitMinutes === 'number'
              ? response.data.chatMessageEditLimitMinutes
              : 15
          );
          setChatMessageDeleteLimitMinutes(
            typeof response.data.chatMessageDeleteLimitMinutes === 'number'
              ? response.data.chatMessageDeleteLimitMinutes
              : 15
          );
          setStaffTaskColor(
            typeof response.data.staffTaskColor === 'string' && response.data.staffTaskColor
              ? response.data.staffTaskColor
              : '#6A1B9A'
          );
          setScheduleConfigRaw(response.data.scheduleConfig ?? null);
        }
        
        // Загрузить настройки видимых вкладок
        const savedTabs = localStorage.getItem('visibleTabs');
        if (savedTabs) {
          setVisibleTabs(JSON.parse(savedTabs));
        } else {
          // По умолчанию все вкладки видимы
          const defaultTabs: { [key: string]: boolean } = {
            dashboard: true,
            clients: true,
            clientCategories: true,
            trainers: true,
            trainerEarnings: true,
            allTrainersEarnings: true,
            groups: true,
            branches: true,
            schedule: true,
            memberships: true,
            payments: true,
            finance: true,
            settings: true,
            faq: true,
            news: true,
            feedback: true,
          };
          setVisibleTabs(defaultTabs);
        }

        // Загрузить настройки уведомлений для тренеров (дайджест тренировок)
        if (user?.role === 'TRAINER') {
          await loadNotificationSettings();
        }
      } catch (err: any) {
        console.error('Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadNotificationSettings = async () => {
    try {
      setLoadingNotifications(true);
      
      // Получаем ID тренера из текущего пользователя
      const trainersRes = await apiService.getTrainers();
      const currentTrainer = trainersRes.data.find((t: any) => 
        t.userId === user?.id || (t.user && t.user.id === user?.id)
      );
      
      if (!currentTrainer) {
        return;
      }

      const trainerIdValue = currentTrainer.id || currentTrainer.userId;
      setTrainerId(trainerIdValue);

      // Получаем настройки уведомлений
      const notificationSettingsData = await apiService.getTrainerNotificationSettings(trainerIdValue);
      
      // Преобразуем время из минут в Date объект
      let allTrainingsTime: Date | null = null;
      if (notificationSettingsData.allTrainingsTime !== null && notificationSettingsData.allTrainingsTime !== undefined) {
        const minutes = notificationSettingsData.allTrainingsTime;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        allTrainingsTime = setHours(setMinutes(new Date(), mins), hours);
      }

      setNotificationSettings({
        allTrainingsEnabled: notificationSettingsData.allTrainingsEnabled || false,
        allTrainingsTime,
        notificationPeriod: (notificationSettingsData.notificationPeriod || 'tomorrow') as 'tomorrow' | 'week' | 'month',
        reminderEnabled: notificationSettingsData.reminderEnabled || false,
        reminderBeforeMinutes: notificationSettingsData.reminderBeforeMinutes || 60,
        timezone: notificationSettingsData.timezone || 'UTC',
      });
    } catch (err: any) {
      console.error('Error loading notification settings:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    if (!trainerId) {
      setError('ID тренера не найден');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Преобразуем время в минуты от начала дня
      let allTrainingsTimeMinutes: number | null = null;
      if (notificationSettings.allTrainingsTime) {
        const hours = notificationSettings.allTrainingsTime.getHours();
        const minutes = notificationSettings.allTrainingsTime.getMinutes();
        allTrainingsTimeMinutes = hours * 60 + minutes;
      }

      await apiService.updateTrainerNotificationSettings(trainerId, {
        allTrainingsEnabled: notificationSettings.allTrainingsEnabled,
        allTrainingsTime: allTrainingsTimeMinutes,
        notificationPeriod: notificationSettings.notificationPeriod,
        reminderEnabled: notificationSettings.reminderEnabled,
        reminderBeforeMinutes: notificationSettings.reminderBeforeMinutes,
        timezone: notificationSettings.timezone,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения настроек уведомлений');
      console.error('Error saving notification settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await apiService.updateSettings({
        defaultTrainingDuration,
        ...(canEditFinanceSettings
          ? {
              membershipFeeResetDate: membershipFeeResetDate || '12-01',
              salaryPayoutDay,
              chatMessageEditLimitMinutes,
              chatMessageDeleteLimitMinutes,
              staffTaskColor,
            }
          : {}),
        clientCanViewAllTrainers,
        clientCanViewAllBranches
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось сохранить настройки');
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchedule = async (payload: {
    defaultTrainingDuration: number;
    salaryPayoutDay?: number;
    staffTaskColor?: string;
    scheduleConfig: ScheduleConfig;
  }) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      await apiService.updateSettings({
        defaultTrainingDuration: payload.defaultTrainingDuration,
        ...(canEditFinanceSettings
          ? {
              salaryPayoutDay: payload.salaryPayoutDay,
              staffTaskColor: payload.staffTaskColor,
            }
          : {}),
        ...(canEditSchoolSettings ? { scheduleConfig: payload.scheduleConfig } : {}),
      });
      setDefaultTrainingDuration(payload.defaultTrainingDuration);
      if (payload.salaryPayoutDay != null) setSalaryPayoutDay(payload.salaryPayoutDay);
      if (payload.staffTaskColor) setStaffTaskColor(payload.staffTaskColor);
      setScheduleConfigRaw(payload.scheduleConfig);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось сохранить настройки расписания');
      console.error('Error saving schedule settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const discardEmailForm = () => {
    setEmailDialogOpen(false);
    setNewEmail('');
    setEmailPassword('');
    setEmailFormBaseline({ newEmail: '', emailPassword: '' });
  };

  const openEmailDialog = () => {
    const initial = { newEmail: '', emailPassword: '' };
    setNewEmail('');
    setEmailPassword('');
    setEmailFormBaseline(initial);
    setEmailDialogOpen(true);
  };

  const handleChangeEmail = async (): Promise<boolean> => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await apiService.changeEmail({
        newEmail,
        password: emailPassword
      });

      // Обновить email в контексте — после смены нужна повторная верификация
      if (updateUser && user) {
        updateUser({ ...user, email: newEmail, emailVerified: false });
      }
      setVerifyCode('');
      setVerifyNotice(null);

      setSuccess(true);
      discardEmailForm();
      setTimeout(() => setSuccess(false), 3000);
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось изменить email');
      console.error('Error changing email:', err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const emailDirty =
    emailDialogOpen && isDirtyValue({ newEmail, emailPassword }, emailFormBaseline);
  const emailUnsaved = useUnsavedClose({
    isDirty: Boolean(emailDirty),
    onDiscard: discardEmailForm,
    onSave: handleChangeEmail,
  });

  const handleSendVerificationCode = async () => {
    try {
      setVerifySending(true);
      setError(null);
      setVerifyNotice(null);
      const result = await apiService.sendEmailVerification();
      if (result.alreadyVerified) {
        if (updateUser && user) {
          updateUser({ ...user, emailVerified: true });
        }
        setVerifyNotice('Email уже подтверждён');
      } else {
        setVerifyNotice(result.message || 'Код отправлен на почту');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось отправить код');
    } finally {
      setVerifySending(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    if (!/^\d{6}$/.test(verifyCode.trim())) {
      setError('Введите 6-значный код');
      return;
    }
    try {
      setVerifyChecking(true);
      setError(null);
      const result = await apiService.verifyEmailCode(verifyCode.trim());
      if (updateUser && user) {
        updateUser({ ...user, emailVerified: true });
      }
      setVerifyCode('');
      setVerifyNotice(result.message || 'Email подтверждён');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Неверный код');
    } finally {
      setVerifyChecking(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Новые пароли не совпадают');
      return;
    }

    if (newPassword.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await apiService.changePassword({
        currentPassword,
        newPassword
      });

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось изменить пароль');
      console.error('Error changing password:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTab = (tabKey: string) => {
    const newVisibleTabs = {
      ...visibleTabs,
      [tabKey]: !visibleTabs[tabKey]
    };
    setVisibleTabs(newVisibleTabs);
    localStorage.setItem('visibleTabs', JSON.stringify(newVisibleTabs));
    
    // Отправить событие для обновления навигации
    const event = new CustomEvent('tabsVisibilityChange', { detail: { visibleTabs: newVisibleTabs } });
    window.dispatchEvent(event);
  };

  const tabLabels: { [key: string]: string } = {
    dashboard: 'Панель управления',
    chats: 'Чаты',
    staffWorkspace: 'Заметки и задачи',
    clients: 'Клиенты',
    clientCategories: 'Категории клиентов',
    trainers: 'Тренеры',
    trainerEarnings: 'Мой заработок',
    trainerProfile: 'Мой профиль',
    allTrainersEarnings: 'Заработок тренеров',
    groups: 'Филиалы и группы',
    schedule: 'Расписание',
    trainingPlan: 'Тренировочный план',
    memberships: 'Абонементы',
    payments: 'Платежи',
    finance: 'Финансы',
    settings: 'Настройки',
    faq: 'FAQ',
    news: 'Новости',
    feedback: 'Связь с разработчиком',
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box data-onboarding="settings-page">
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1.5,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontWeight: 800, fontSize: { xs: typography.pageTitle.xs, md: typography.pageTitle.md }, color: '#1B2438', letterSpacing: '-0.02em' }}
          >
            Настройки
          </Typography>
          <Typography sx={{ fontSize: typography.label, color: colors.textHint, mt: 0.25 }}>
            Настройте систему под задачи вашей организации
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: `${radii.panel}px` }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: `${radii.panel}px` }} onClose={() => setSuccess(false)}>
          Настройки успешно сохранены
        </Alert>
      )}

      <Tabs
        value={tabValue}
        onChange={(e, newValue) => setTabValue(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          mb: 2.5,
          borderBottom: `1px solid ${colors.divider}`,
          '& .MuiTab-root': { gap: 0.75 },
        }}
      >
        <Tab icon={<CalendarMonthOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Расписание" />
        <Tab icon={<AccountCircleOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Аккаунт" />
        <Tab icon={<NotificationsNoneOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Уведомления" />
        <Tab icon={<PaletteOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Интерфейс" />
        <Tab icon={<StorefrontOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Филиалы" />
        <Tab icon={<PolicyOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Роли и права" />
        <Tab icon={<ExtensionOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Интеграции" />
        <Tab icon={<LockOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Безопасность" />
      </Tabs>

          {/* Настройки расписания */}
          <TabPanel value={tabValue} index={TAB.schedule}>
            <SettingsSchedulePanel
              defaultTrainingDuration={defaultTrainingDuration}
              salaryPayoutDay={salaryPayoutDay}
              staffTaskColor={staffTaskColor}
              scheduleConfigRaw={scheduleConfigRaw}
              canEditFinance={canEditFinanceSettings}
              canEditSchedule={canEditSchoolSettings}
              saving={saving}
              onSave={handleSaveSchedule}
            />
          </TabPanel>

          {/* Настройки аккаунта */}
          <TabPanel value={tabValue} index={TAB.account}>
            <Grid container spacing={2}>
              {/* Подтверждение email */}
              <Grid item xs={12}>
                <Paper elevation={0} sx={sectionPaperSx}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text, mb: 2 }}>
                    Подтверждение email
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
                    {user?.email || 'Email не указан'}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Статус:{' '}
                    <strong>
                      {user?.emailVerified ? 'подтверждён' : 'не подтверждён'}
                    </strong>
                  </Typography>
                  {verifyNotice && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      {verifyNotice}
                    </Alert>
                  )}
                  {!user?.emailVerified && user?.email && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 420 }}>
                      <Button
                        variant="outlined"
                        onClick={handleSendVerificationCode}
                        disabled={verifySending}
                        sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                      >
                        {verifySending ? 'Отправка…' : 'Отправить код'}
                      </Button>
                      <TextField
                        label="Код из письма"
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value)}
                        inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                      />
                      <Button
                        variant="contained"
                        onClick={handleVerifyEmailCode}
                        disabled={verifyChecking || verifyCode.trim().length !== 6}
                        sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                      >
                        {verifyChecking ? 'Проверка…' : 'Подтвердить'}
                      </Button>
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* Смена email */}
              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={sectionPaperSx}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text, mb: 2 }}>
                    Смена email
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, overflowWrap: 'anywhere' }}>
                    Текущий email: <strong>{user?.email}</strong>
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={openEmailDialog}
                    sx={{ mt: 2, width: { xs: '100%', sm: 'auto' }, textTransform: 'none' }}
                  >
                    Изменить email
                  </Button>
                </Paper>
              </Grid>

              {/* Смена пароля */}
              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={sectionPaperSx}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text, mb: 2 }}>
                    Смена пароля
                  </Typography>
                  <PasswordField
                    fullWidth
                    label="Текущий пароль"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <PasswordField
                    fullWidth
                    label="Новый пароль"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <PasswordField
                    fullWidth
                    label="Подтвердите новый пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleChangePassword}
                    disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                    sx={{ mt: 1, width: { xs: '100%', sm: 'auto' }, ...btnPrimarySx }}
                  >
                    {saving ? 'Сохранение...' : 'Изменить пароль'}
                  </Button>
                </Paper>
              </Grid>

            </Grid>
          </TabPanel>

          {/* Настройки уведомлений */}
          <TabPanel value={tabValue} index={TAB.notifications}>
            {showNotificationsTab ? (
              <>
              <NotificationSettingsPanel
                actor="school"
                showSchedule={user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'TRAINER'}
                schoolRole={user?.role}
              />

              {user?.role === 'TRAINER' && (
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Paper elevation={0} sx={sectionPaperSx}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text, mb: 1 }}>
                          Уведомления о всех тренировках
                        </Typography>
                        <Typography variant="body2" sx={{ color: colors.textHint, mb: 2 }}>
                          Ежедневный дайджест тренировок
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={notificationSettings.allTrainingsEnabled}
                              onChange={(e) => setNotificationSettings(prev => ({ ...prev, allTrainingsEnabled: e.target.checked }))}
                              color="primary"
                            />
                          }
                          label="Включить ежедневные уведомления"
                        />
                        {notificationSettings.allTrainingsEnabled && (
                          <Box sx={{ mt: 2 }}>
                            <TimePicker
                              label="Время уведомления"
                              value={notificationSettings.allTrainingsTime}
                              onChange={(newValue) => setNotificationSettings(prev => ({ ...prev, allTrainingsTime: newValue }))}
                              slotProps={{ textField: { fullWidth: true, sx: { mb: 2 } } }}
                            />
                            <FormControl fullWidth sx={{ mb: 2 }}>
                              <InputLabel>Период</InputLabel>
                              <Select
                                value={notificationSettings.notificationPeriod}
                                label="Период"
                                onChange={(e) => setNotificationSettings(prev => ({ ...prev, notificationPeriod: e.target.value as 'tomorrow' | 'week' | 'month' }))}
                              >
                                <MenuItem value="tomorrow">На завтра</MenuItem>
                                <MenuItem value="week">На неделю</MenuItem>
                                <MenuItem value="month">На месяц</MenuItem>
                              </Select>
                            </FormControl>
                            <FormControl fullWidth>
                              <InputLabel>Часовой пояс</InputLabel>
                              <Select
                                value={notificationSettings.timezone}
                                label="Часовой пояс"
                                onChange={(e) => setNotificationSettings(prev => ({ ...prev, timezone: e.target.value }))}
                              >
                                <MenuItem value="UTC">UTC</MenuItem>
                                <MenuItem value="Europe/Moscow">Europe/Moscow</MenuItem>
                              </Select>
                            </FormControl>
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                    <Grid item xs={12}>
                      <Paper elevation={0} sx={sectionPaperSx}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={notificationSettings.reminderEnabled}
                              onChange={(e) => setNotificationSettings(prev => ({ ...prev, reminderEnabled: e.target.checked }))}
                              color="primary"
                            />
                          }
                          label="Напоминание перед тренировкой"
                        />
                        {notificationSettings.reminderEnabled && (
                          <Box sx={{ mt: 2 }}>
                            <TextField
                              fullWidth
                              label="За сколько минут напоминать"
                              type="number"
                              value={notificationSettings.reminderBeforeMinutes}
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                if (!isNaN(value) && value >= 0) {
                                  setNotificationSettings(prev => ({ ...prev, reminderBeforeMinutes: value }));
                                }
                              }}
                              inputProps={{ min: 0 }}
                              helperText="Например: 30 (за 30 минут до начала тренировки)"
                            />
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="contained"
                        startIcon={<Save />}
                        onClick={handleSaveNotificationSettings}
                        disabled={saving || loadingNotifications}
                        sx={{ width: { xs: '100%', sm: 'auto' }, ...btnPrimarySx }}
                      >
                        {saving ? 'Сохранение...' : 'Сохранить настройки тренировок'}
                      </Button>
                    </Grid>
                  </Grid>
                </LocalizationProvider>
              )}
              </>
            ) : (
              <Paper elevation={0} sx={sectionPaperSx}>
                <Typography sx={{ color: colors.textHint }}>
                  Уведомления доступны владельцу, администратору и тренеру.
                </Typography>
              </Paper>
            )}
          </TabPanel>

          {/* Настройки интерфейса */}
          <TabPanel value={tabValue} index={TAB.interface}>
            <Grid container spacing={2}>
              {/* Настройка вкладок */}
              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={sectionPaperSx}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text, mb: 1 }}>
                    Отображаемые вкладки
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.textHint, mb: 2 }}>
                    Какие разделы показывать в меню
                  </Typography>
                  <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                    {Object.keys(tabLabels).map((tabKey) => (
                      <FormControlLabel
                        key={tabKey}
                        control={
                          <Switch
                            checked={visibleTabs[tabKey] !== false}
                            onChange={() => handleToggleTab(tabKey)}
                            color="primary"
                          />
                        }
                        label={tabLabels[tabKey]}
                        sx={{ display: 'block', mb: 1 }}
                      />
                    ))}
                  </Box>
                </Paper>
              </Grid>

              {/* Повторное прохождение обучения */}
              {user && ['OWNER', 'ADMIN', 'TRAINER', 'PROMOTER'].includes(user.role) && (
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={sectionPaperSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text, mb: 1 }}>
                      Интерактивное обучение
                    </Typography>
                    <Typography variant="body2" sx={{ color: colors.textHint, mb: 2 }}>
                      Пройдите обучение ещё раз
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<School />}
                      onClick={handleRestartOnboarding}
                      disabled={restartingOnboarding}
                      fullWidth
                      sx={{
                        textTransform: 'none',
                        borderRadius: `${radii.button}px`,
                        borderColor: colors.primary,
                        color: colors.primary,
                        fontWeight: 600,
                      }}
                    >
                      {restartingOnboarding ? 'Запуск обучения...' : 'Повторить обучение'}
                    </Button>
                  </Paper>
                </Grid>
              )}

              {canEditFinanceSettings && (
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={sectionPaperSx}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700, color: colors.text }}>
                      Членский взнос
                    </Typography>
                    <TextField
                      fullWidth
                      label="Дата сброса (ММ-ДД)"
                      value={membershipFeeResetDate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])?$/.test(value)) {
                          setMembershipFeeResetDate(value);
                        }
                      }}
                      placeholder="12-01"
                      helperText="По умолчанию: 1 декабря"
                      sx={{ mt: 1 }}
                    />
                  </Paper>
                </Grid>
              )}

              {canEditFinanceSettings && (
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={sectionPaperSx}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700, color: colors.text }}>
                      Чаты
                    </Typography>
                    <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
                      <InputLabel id="chat-edit-limit-label">Лимит редактирования</InputLabel>
                      <Select
                        labelId="chat-edit-limit-label"
                        label="Лимит редактирования"
                        value={chatMessageEditLimitMinutes}
                        onChange={(e) => setChatMessageEditLimitMinutes(Number(e.target.value))}
                      >
                        <MenuItem value={5}>5 минут</MenuItem>
                        <MenuItem value={15}>15 минут</MenuItem>
                        <MenuItem value={30}>30 минут</MenuItem>
                        <MenuItem value={60}>1 час</MenuItem>
                        <MenuItem value={180}>3 часа</MenuItem>
                        <MenuItem value={1440}>24 часа</MenuItem>
                        <MenuItem value={0}>Без ограничения</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl fullWidth>
                      <InputLabel id="chat-delete-limit-label">Лимит удаления</InputLabel>
                      <Select
                        labelId="chat-delete-limit-label"
                        label="Лимит удаления"
                        value={chatMessageDeleteLimitMinutes}
                        onChange={(e) => setChatMessageDeleteLimitMinutes(Number(e.target.value))}
                      >
                        <MenuItem value={5}>5 минут</MenuItem>
                        <MenuItem value={15}>15 минут</MenuItem>
                        <MenuItem value={30}>30 минут</MenuItem>
                        <MenuItem value={60}>1 час</MenuItem>
                        <MenuItem value={180}>3 часа</MenuItem>
                        <MenuItem value={1440}>24 часа</MenuItem>
                        <MenuItem value={0}>Без ограничения</MenuItem>
                      </Select>
                    </FormControl>
                  </Paper>
                </Grid>
              )}

              {canEditSchoolSettings && (
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={sectionPaperSx}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700, color: colors.text }}>
                      Личный кабинет клиента
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        py: 1,
                        borderBottom: `1px solid ${colors.divider}`,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: colors.text }}>
                          Клиенты могут видеть всех тренеров
                        </Typography>
                        <Typography variant="caption" sx={{ color: colors.textHint }}>
                          {clientCanViewAllTrainers
                            ? 'Видят всех тренеров школы'
                            : 'Только тренер из своей группы'}
                        </Typography>
                      </Box>
                      <Switch
                        checked={clientCanViewAllTrainers}
                        onChange={(e) => setClientCanViewAllTrainers(e.target.checked)}
                        color="primary"
                      />
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        py: 1,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: colors.text }}>
                          Клиенты могут видеть все филиалы
                        </Typography>
                        <Typography variant="caption" sx={{ color: colors.textHint }}>
                          {clientCanViewAllBranches
                            ? 'Видят все филиалы школы'
                            : 'Только филиал из своей группы'}
                        </Typography>
                      </Box>
                      <Switch
                        checked={clientCanViewAllBranches}
                        onChange={(e) => setClientCanViewAllBranches(e.target.checked)}
                        color="primary"
                      />
                    </Box>
                  </Paper>
                </Grid>
              )}

              {(canEditFinanceSettings || canEditSchoolSettings) && (
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveSettings}
                    disabled={saving}
                    sx={{ ...btnPrimarySx }}
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={TAB.branches}>
            <Paper elevation={0} sx={sectionPaperSx}>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Филиалы</Typography>
              <Typography sx={{ color: colors.textHint, fontSize: typography.label }}>
                Раздел в подготовке. Управление филиалами доступно в меню «Филиалы и группы».
              </Typography>
            </Paper>
          </TabPanel>

          <TabPanel value={tabValue} index={TAB.roles}>
            <Paper elevation={0} sx={sectionPaperSx}>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Роли и права</Typography>
              <Typography sx={{ color: colors.textHint, fontSize: typography.label }}>
                Раздел в подготовке.
              </Typography>
            </Paper>
          </TabPanel>

          <TabPanel value={tabValue} index={TAB.integrations}>
            <Paper elevation={0} sx={sectionPaperSx}>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Интеграции</Typography>
              <Typography sx={{ color: colors.textHint, fontSize: typography.label }}>
                Раздел в подготовке.
              </Typography>
            </Paper>
          </TabPanel>

          <TabPanel value={tabValue} index={TAB.security}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Email2faSettingsToggle />
              </Grid>
              <Grid item xs={12}>
                <ActiveSessionsPanel onLogoutEverywhere={logout} />
              </Grid>
            </Grid>
          </TabPanel>

      {/* Диалог смены email */}
      <Dialog
        open={emailDialogOpen}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            emailUnsaved.requestClose(reason);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Смена email</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Текущий email: <strong>{user?.email}</strong>
          </Typography>
          <TextField
            fullWidth
            label="Новый email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            sx={{ mb: 2 }}
            margin="normal"
          />
          <PasswordField
            fullWidth
            label="Подтвердите паролем"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={discardEmailForm}>Отмена</Button>
          <Button
            onClick={handleChangeEmail}
            variant="contained"
            disabled={saving || !newEmail || !emailPassword}
          >
            {saving ? 'Сохранение...' : 'Изменить'}
          </Button>
        </DialogActions>
      </Dialog>

      <UnsavedChangesDialog
        open={emailUnsaved.confirmOpen}
        saving={emailUnsaved.saving}
        onSave={emailUnsaved.save}
        onDiscard={emailUnsaved.discard}
        onStay={emailUnsaved.stay}
      />
    </Box>
  );
};

export default Settings;
