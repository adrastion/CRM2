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
  DarkMode,
  LightMode,
  School,
} from '@mui/icons-material';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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
  
  // Темная тема
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  // Повторное прохождение обучения
  const [restartingOnboarding, setRestartingOnboarding] = useState(false);

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
            standards: true,
            trainers: true,
            trainerEarnings: true,
            allTrainersEarnings: true,
            groups: true,
            branches: true,
            schedule: true,
            payments: true,
            memberships: true,
            clientMemberships: true,
            settings: true,
            faq: true,
          };
          setVisibleTabs(defaultTabs);
        }
      } catch (err: any) {
        console.error('Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Применить темную тему
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
    // Применить тему (будет обработано в App.tsx)
    const event = new CustomEvent('themeChange', { detail: { darkMode } });
    window.dispatchEvent(event);
  }, [darkMode]);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await apiService.updateSettings({
        defaultTrainingDuration,
        membershipFeeResetDate: membershipFeeResetDate || '12-01'
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
    standards: 'Нормативы',
    trainers: 'Тренеры',
    trainerEarnings: 'Мой заработок',
    allTrainersEarnings: 'Заработок тренеров',
    groups: 'Группы',
    branches: 'Филиалы',
    schedule: 'Расписание',
    payments: 'Платежи',
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
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
        <CardContent>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
            <Tab label="Расписание" />
            <Tab label="Аккаунт" />
            <Tab label="Интерфейс" />
          </Tabs>

          {/* Настройки расписания */}
          <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Настройки расписания
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3 }}>
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
                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                      onClick={handleSaveSettings}
                    disabled={saving}
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
                <Paper sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Email sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle1" fontWeight="medium">
                      Смена email
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Текущий email: <strong>{user?.email}</strong>
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => setEmailDialogOpen(true)}
                    sx={{ mt: 2 }}
                  >
                    Изменить email
                  </Button>
                </Paper>
              </Grid>

              {/* Смена пароля */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
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
                    sx={{ mt: 1 }}
                  >
                    {saving ? 'Сохранение...' : 'Изменить пароль'}
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Настройки интерфейса */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
              Настройки интерфейса
            </Typography>

            <Grid container spacing={3}>
              {/* Темная тема */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {darkMode ? <DarkMode sx={{ mr: 1, color: 'primary.main' }} /> : <LightMode sx={{ mr: 1, color: 'primary.main' }} />}
                    <Typography variant="subtitle1" fontWeight="medium">
                      Темная тема
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Переключите между светлой и темной темой интерфейса
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={darkMode}
                        onChange={(e) => setDarkMode(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={darkMode ? 'Темная тема включена' : 'Темная тема выключена'}
                  />
                </Paper>
              </Grid>

              {/* Настройка вкладок */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
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
                  <Paper sx={{ p: 3 }}>
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
