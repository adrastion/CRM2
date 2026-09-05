import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
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
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Save,
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  ViewList,
  School,
  Notifications,
} from '@mui/icons-material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { setHours, setMinutes } from 'date-fns';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToPushNotifications, unsubscribeFromPushNotifications, checkPushSubscriptionStatus, checkNotificationPermission } from '../utils/pushNotifications';

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
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const Settings: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  
  // Настройки расписания
  const [defaultTrainingDuration, setDefaultTrainingDuration] = useState<number>(60);
  const [membershipFeeResetDate, setMembershipFeeResetDate] = useState<string>('');
  const [salaryPayoutDay, setSalaryPayoutDay] = useState<number>(25);
  const [clientCanViewAllTrainers, setClientCanViewAllTrainers] = useState<boolean>(false);
  const [clientCanViewAllBranches, setClientCanViewAllBranches] = useState<boolean>(false);
  
  // Смена email
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  
  // Смена пароля
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
    reminderBeforeMinutes: 30,
    timezone: 'UTC',
  });
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(true);

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
          setDefaultTrainingDuration(response.data.defaultTrainingDuration || 60);
          setMembershipFeeResetDate(response.data.membershipFeeResetDate || '12-01');
          setSalaryPayoutDay(response.data.salaryPayoutDay || 25);
          setClientCanViewAllTrainers(response.data.clientCanViewAllTrainers || false);
          setClientCanViewAllBranches(response.data.clientCanViewAllBranches || false);
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
            payments: true,
            finance: true,
            memberships: true,
            clientMemberships: true,
            settings: true,
            faq: true,
          };
          setVisibleTabs(defaultTabs);
        }

        // Загрузить настройки уведомлений для тренеров
        if (user?.role === 'TRAINER') {
          await loadNotificationSettings();
          // Проверяем статус подписки на push
          const isSubscribed = await checkPushSubscriptionStatus();
          setPushSubscribed(isSubscribed);
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
        reminderBeforeMinutes: notificationSettingsData.reminderBeforeMinutes || 30,
        timezone: notificationSettingsData.timezone || 'UTC',
      });

      // Проверяем статус подписки на push и разрешение
      const isSubscribed = await checkPushSubscriptionStatus();
      const permission = checkNotificationPermission();
      setPushSubscribed(isSubscribed);
      // Показываем плашку только если не подписан или разрешение не granted
      setShowPushBanner(!isSubscribed || permission !== 'granted');
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

  const handleSubscribePush = async () => {
    try {
      setSubscribing(true);
      setError(null);
      const success = await subscribeToPushNotifications();
      if (success) {
        setPushSubscribed(true);
        setShowPushBanner(false); // Скрываем плашку после успешной подписки
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError('Не удалось подписаться на уведомления. Проверьте разрешения браузера.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка подписки на уведомления');
      console.error('Error subscribing to push:', err);
    } finally {
      setSubscribing(false);
    }
  };

  const handleUnsubscribePush = async () => {
    try {
      setSubscribing(true);
      setError(null);
      const success = await unsubscribeFromPushNotifications();
      if (success) {
        setPushSubscribed(false);
        setShowPushBanner(true); // Показываем плашку после отписки
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка отписки от уведомлений');
      console.error('Error unsubscribing from push:', err);
    } finally {
      setSubscribing(false);
    }
  };

  // Периодическая проверка статуса разрешения (на случай, если пользователь изменил настройки в браузере)
  useEffect(() => {
    if (user?.role !== 'TRAINER') return;

    const checkPermission = () => {
      const permission = checkNotificationPermission();
      const shouldShow = !pushSubscribed || permission !== 'granted';
      setShowPushBanner(shouldShow);
      
      // Если разрешение отозвано, обновляем статус подписки
      if (permission !== 'granted' && pushSubscribed) {
        checkPushSubscriptionStatus().then(isSubscribed => {
          setPushSubscribed(isSubscribed);
        });
      }
    };

    // Проверяем при загрузке
    checkPermission();

    // Проверяем каждые 5 секунд (на случай изменения настроек браузера)
    const interval = setInterval(checkPermission, 5000);

    return () => clearInterval(interval);
  }, [user, pushSubscribed]);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await apiService.updateSettings({
        defaultTrainingDuration,
        membershipFeeResetDate: membershipFeeResetDate || '12-01',
        salaryPayoutDay,
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

  const handleChangeEmail = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await apiService.changeEmail({
        newEmail,
        password: emailPassword
      });

      // Обновить email в контексте
      if (updateUser && user) {
        updateUser({ ...user, email: newEmail });
      }

      setSuccess(true);
      setEmailDialogOpen(false);
      setNewEmail('');
      setEmailPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось изменить email');
      console.error('Error changing email:', err);
    } finally {
      setSaving(false);
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
    clients: 'Клиенты',
    clientCategories: 'Категории клиентов',
    trainers: 'Тренеры',
    trainerEarnings: 'Мой заработок',
    allTrainersEarnings: 'Заработок тренеров',
    groups: 'Группы',
    branches: 'Филиалы',
    schedule: 'Расписание',
    payments: 'Платежи',
    finance: 'Финансы',
    memberships: 'Тарифы',
    clientMemberships: 'Выданные тарифы',
    settings: 'Настройки',
    faq: 'FAQ',
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
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: 20, md: 24 } }}>
          Настройки
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
          Настройки успешно сохранены
        </Alert>
      )}

      <Card>
        <CardContent sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
          <Tabs
            value={tabValue}
            onChange={(e, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ mb: 3 }}
          >
            <Tab label="Расписание" sx={{ textTransform: 'none', minWidth: { xs: 'auto', sm: 120 } }} />
            <Tab label="Аккаунт" sx={{ textTransform: 'none', minWidth: { xs: 'auto', sm: 120 } }} />
            {user?.role === 'TRAINER' && (
              <Tab label="Уведомления" sx={{ textTransform: 'none', minWidth: { xs: 'auto', sm: 120 } }} />
            )}
            <Tab label="Интерфейс" sx={{ textTransform: 'none', minWidth: { xs: 'auto', sm: 120 } }} />
          </Tabs>

          {/* Настройки расписания */}
          <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Настройки расписания
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                  Длительность тренировки по умолчанию
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  При создании тренировки время окончания будет автоматически устанавливаться на указанное количество минут после времени начала.
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  label="Длительность (минуты)"
                  value={defaultTrainingDuration}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (value >= 15 && value <= 480) {
                      setDefaultTrainingDuration(value);
                    }
                  }}
                  inputProps={{ min: 15, max: 480, step: 15 }}
                  helperText="Минимум: 15 минут, максимум: 480 минут (8 часов)"
                  sx={{ mb: 2 }}
                />
                {(user?.role === 'OWNER' || user?.role === 'ADMIN') && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                      День выплаты зарплаты
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      День месяца (1–28), когда выплачивается зарплата. Напоминание OWNER/ADMIN появится за 5 дней.
                    </Typography>
                    <TextField
                      fullWidth
                      type="number"
                      label="День месяца"
                      value={salaryPayoutDay}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (value >= 1 && value <= 28) setSalaryPayoutDay(value);
                      }}
                      inputProps={{ min: 1, max: 28 }}
                      helperText="По умолчанию: 25"
                      sx={{ mb: 2 }}
                    />
                  </Box>
                )}
                {/* Настройка даты сброса членского взноса */}
                {(user?.role === 'OWNER' || user?.role === 'ADMIN') && (
                  <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                      Автоматический сброс отметок членского взноса
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Укажите дату, когда автоматически будут сбрасываться все отметки о членском взносе (формат: ММ-ДД, например 12-01 для 1 декабря)
                    </Typography>
                    <TextField
                      fullWidth
                      label="Дата сброса (ММ-ДД)"
                      value={membershipFeeResetDate}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Разрешаем только формат MM-DD
                        if (value === '' || /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])?$/.test(value)) {
                          setMembershipFeeResetDate(value);
                        }
                      }}
                      placeholder="12-01"
                      helperText="Формат: ММ-ДД (например, 12-01 для 1 декабря). По умолчанию: 1 декабря"
                      sx={{ mb: 2 }}
                    />
                  </Box>
                )}
                {/* Настройки личного кабинета клиента */}
                {(user?.role === 'OWNER' || user?.role === 'ADMIN') && (
                  <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                      Настройки личного кабинета клиента
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Управляйте тем, какую информацию видят клиенты в своем личном кабинете. Эти настройки влияют на отображение данных в расписании и профиле клиента.
                    </Typography>
                    
                    <Paper variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: 'rgba(72, 128, 255, 0.04)' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={clientCanViewAllTrainers}
                            onChange={(e) => setClientCanViewAllTrainers(e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1" fontWeight="medium">
                              Клиенты могут видеть всех тренеров
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {clientCanViewAllTrainers 
                                ? 'Клиенты видят всех тренеров школы в своем расписании и профиле'
                                : 'Клиенты видят только своего тренера (тренера из их группы)'}
                            </Typography>
                          </Box>
                        }
                        sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', m: 0 }}
                      />
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'rgba(72, 128, 255, 0.04)' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={clientCanViewAllBranches}
                            onChange={(e) => setClientCanViewAllBranches(e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1" fontWeight="medium">
                              Клиенты могут видеть все филиалы
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {clientCanViewAllBranches 
                                ? 'Клиенты видят все филиалы школы в своем расписании и профиле'
                                : 'Клиенты видят только свой филиал (филиал из их группы)'}
                            </Typography>
                          </Box>
                        }
                        sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', m: 0 }}
                      />
                    </Paper>
                  </Box>
                )}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mt: 3 }}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                      onClick={handleSaveSettings}
                    disabled={saving}
                    sx={{ width: { xs: '100%', sm: 'auto' }, textTransform: 'none' }}
                  >
                    {saving ? 'Сохранение...' : 'Сохранить настройки'}
                  </Button>
                </Box>
              </Paper>
            </Grid>
          </Grid>
          </TabPanel>

          {/* Настройки аккаунта */}
          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
              Настройки аккаунта
            </Typography>

            <Grid container spacing={3}>
              {/* Смена email */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Email sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle1" fontWeight="medium">
                      Смена email
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, overflowWrap: 'anywhere' }}>
                    Текущий email: <strong>{user?.email}</strong>
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => setEmailDialogOpen(true)}
                    sx={{ mt: 2, width: { xs: '100%', sm: 'auto' }, textTransform: 'none' }}
                  >
                    Изменить email
                  </Button>
                </Paper>
              </Grid>

              {/* Смена пароля */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Lock sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle1" fontWeight="medium">
                      Смена пароля
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth
                    type={showCurrentPassword ? 'text' : 'password'}
                    label="Текущий пароль"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    sx={{ mb: 2 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            edge="end"
                          >
                            {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    fullWidth
                    type={showNewPassword ? 'text' : 'password'}
                    label="Новый пароль"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    sx={{ mb: 2 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            edge="end"
                          >
                            {showNewPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    fullWidth
                    type={showConfirmPassword ? 'text' : 'password'}
                    label="Подтвердите новый пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    sx={{ mb: 2 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleChangePassword}
                    disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                    sx={{ mt: 1, width: { xs: '100%', sm: 'auto' }, textTransform: 'none' }}
                  >
                    {saving ? 'Сохранение...' : 'Изменить пароль'}
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Настройки уведомлений (только для тренеров) */}
          {user?.role === 'TRAINER' && (
            <TabPanel value={tabValue} index={2}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                  Настройки уведомлений
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Настройте уведомления о тренировках
                </Typography>

                {/* Подписка на push уведомления - показываем только если нужно */}
                {showPushBanner && (
                  <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, backgroundColor: pushSubscribed ? 'warning.light' : 'info.light' }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 2,
                        mb: 2,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight="medium">
                          Push уведомления на устройство
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {checkNotificationPermission() === 'denied'
                            ? 'Уведомления отключены в настройках браузера. Включите их, чтобы получать push уведомления.'
                            : pushSubscribed
                            ? 'Вы подписаны, но уведомления отключены в браузере. Включите их в настройках браузера.'
                            : 'Подпишитесь на push уведомления, чтобы получать их прямо на ваше устройство.'}
                        </Typography>
                      </Box>
                      <Button
                        variant={pushSubscribed ? "outlined" : "contained"}
                        color={pushSubscribed ? "error" : "primary"}
                        onClick={pushSubscribed ? handleUnsubscribePush : handleSubscribePush}
                        disabled={subscribing || checkNotificationPermission() === 'denied'}
                        sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0, textTransform: 'none' }}
                      >
                        {subscribing ? 'Обработка...' : pushSubscribed ? 'Отписаться' : 'Подписаться'}
                      </Button>
                    </Box>
                  </Paper>
                )}

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Notifications sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="subtitle1" fontWeight="medium">
                          Уведомления о всех тренировках
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Получайте ежедневное уведомление о всех тренировках на выбранное время
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
                        sx={{ mb: 2 }}
                      />

                      {notificationSettings.allTrainingsEnabled && (
                        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <TimePicker
                            label="Время уведомления"
                            value={notificationSettings.allTrainingsTime}
                            onChange={(newTime) => setNotificationSettings(prev => ({ ...prev, allTrainingsTime: newTime }))}
                            ampm={false}
                            format="HH:mm"
                            slotProps={{
                              textField: {
                                fullWidth: true,
                              },
                            }}
                          />
                          <FormControl fullWidth>
                            <InputLabel>Период уведомлений</InputLabel>
                            <Select
                              value={notificationSettings.notificationPeriod}
                              label="Период уведомлений"
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
                              <MenuItem value="UTC">UTC (Всемирное координированное время)</MenuItem>
                              <MenuItem value="Europe/Moscow">Europe/Moscow (Москва, UTC+3)</MenuItem>
                              <MenuItem value="Europe/Kiev">Europe/Kiev (Киев, UTC+2)</MenuItem>
                              <MenuItem value="Europe/Minsk">Europe/Minsk (Минск, UTC+3)</MenuItem>
                              <MenuItem value="Europe/Kaliningrad">Europe/Kaliningrad (Калининград, UTC+2)</MenuItem>
                              <MenuItem value="Europe/Samara">Europe/Samara (Самара, UTC+4)</MenuItem>
                              <MenuItem value="Asia/Yekaterinburg">Asia/Yekaterinburg (Екатеринбург, UTC+5)</MenuItem>
                              <MenuItem value="Asia/Omsk">Asia/Omsk (Омск, UTC+6)</MenuItem>
                              <MenuItem value="Asia/Krasnoyarsk">Asia/Krasnoyarsk (Красноярск, UTC+7)</MenuItem>
                              <MenuItem value="Asia/Irkutsk">Asia/Irkutsk (Иркутск, UTC+8)</MenuItem>
                              <MenuItem value="Asia/Yakutsk">Asia/Yakutsk (Якутск, UTC+9)</MenuItem>
                              <MenuItem value="Asia/Vladivostok">Asia/Vladivostok (Владивосток, UTC+10)</MenuItem>
                              <MenuItem value="Asia/Magadan">Asia/Magadan (Магадан, UTC+11)</MenuItem>
                              <MenuItem value="Asia/Kamchatka">Asia/Kamchatka (Камчатка, UTC+12)</MenuItem>
                              <MenuItem value="America/New_York">America/New_York (Нью-Йорк, UTC-5)</MenuItem>
                              <MenuItem value="America/Chicago">America/Chicago (Чикаго, UTC-6)</MenuItem>
                              <MenuItem value="America/Denver">America/Denver (Денвер, UTC-7)</MenuItem>
                              <MenuItem value="America/Los_Angeles">America/Los_Angeles (Лос-Анджелес, UTC-8)</MenuItem>
                              <MenuItem value="Europe/London">Europe/London (Лондон, UTC+0)</MenuItem>
                              <MenuItem value="Europe/Paris">Europe/Paris (Париж, UTC+1)</MenuItem>
                              <MenuItem value="Europe/Berlin">Europe/Berlin (Берлин, UTC+1)</MenuItem>
                              <MenuItem value="Asia/Tokyo">Asia/Tokyo (Токио, UTC+9)</MenuItem>
                              <MenuItem value="Asia/Shanghai">Asia/Shanghai (Шанхай, UTC+8)</MenuItem>
                              <MenuItem value="Asia/Dubai">Asia/Dubai (Дубай, UTC+4)</MenuItem>
                              <MenuItem value="Australia/Sydney">Australia/Sydney (Сидней, UTC+10)</MenuItem>
                            </Select>
                          </FormControl>
                        </Box>
                      )}
                    </Paper>
                  </Grid>

                  <Grid item xs={12}>
                    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Notifications sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="subtitle1" fontWeight="medium">
                          Напоминания перед тренировкой
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Получайте напоминание о предстоящей тренировке за указанное время до начала
                      </Typography>
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={notificationSettings.reminderEnabled}
                            onChange={(e) => setNotificationSettings(prev => ({ ...prev, reminderEnabled: e.target.checked }))}
                            color="primary"
                          />
                        }
                        label="Включить напоминания"
                        sx={{ mb: 2 }}
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
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                      <Button
                        variant="contained"
                        startIcon={<Save />}
                        onClick={handleSaveNotificationSettings}
                        disabled={saving || loadingNotifications}
                        sx={{ width: { xs: '100%', sm: 'auto' }, textTransform: 'none' }}
                      >
                        {saving ? 'Сохранение...' : 'Сохранить настройки уведомлений'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </LocalizationProvider>
            </TabPanel>
          )}

          {/* Настройки интерфейса */}
          <TabPanel value={tabValue} index={user?.role === 'TRAINER' ? 3 : 2}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
              Настройки интерфейса
            </Typography>

            <Grid container spacing={3}>
              {/* Настройка вкладок */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ViewList sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle1" fontWeight="medium">
                      Отображаемые вкладки
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Выберите, какие разделы отображать в боковом меню
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
              {user?.role === 'OWNER' && (
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <School sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="subtitle1" fontWeight="medium">
                        Интерактивное обучение
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Пройдите обучение еще раз, чтобы освежить знания о системе
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<School />}
                      onClick={handleRestartOnboarding}
                      disabled={restartingOnboarding}
                      fullWidth
                      sx={{ textTransform: 'none' }}
                    >
                      {restartingOnboarding ? 'Запуск обучения...' : 'Повторить обучение'}
                    </Button>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Диалог смены email */}
      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} maxWidth="sm" fullWidth>
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
          <TextField
            fullWidth
            label="Подтвердите паролем"
            type={showEmailPassword ? 'text' : 'password'}
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            margin="normal"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowEmailPassword(!showEmailPassword)}
                    edge="end"
                  >
                    {showEmailPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>Отмена</Button>
          <Button
            onClick={handleChangeEmail}
            variant="contained"
            disabled={saving || !newEmail || !emailPassword}
          >
            {saving ? 'Сохранение...' : 'Изменить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
