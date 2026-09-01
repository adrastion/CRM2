import React, { useState, useRef } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Link,
  Divider,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { LoginForm, UnifiedStaffLoginResponse } from '../types';
import { apiService } from '../services/api';
import PublicFooter from '../components/PublicFooter';

/** Перед записью новой сессии убираем все staff-токены, чтобы контексты не конфликтовали. */
function clearAllNonClientAuthStorage(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('tenant');
  localStorage.removeItem('marketerToken');
  localStorage.removeItem('marketer');
  localStorage.removeItem('marketerTenant');
  sessionStorage.removeItem('marketerLoggedOut');
  localStorage.removeItem('promoCodeAdminToken');
  localStorage.removeItem('promoCodeAdmin');
  localStorage.removeItem('promoCodeAdminTenant');
  localStorage.removeItem('superAdminToken');
  localStorage.removeItem('superAdmin');
  localStorage.removeItem('platformStaffToken');
  localStorage.removeItem('platformStaff');
}

function applyUnifiedStaffLogin(data: UnifiedStaffLoginResponse): string {
  clearAllNonClientAuthStorage();
  switch (data.accountType) {
    case 'TENANT_USER':
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('tenant', JSON.stringify(data.tenant));
      return '/dashboard';
    case 'MARKETER':
      localStorage.setItem('marketerToken', data.token);
      localStorage.setItem('marketer', JSON.stringify(data.marketer));
      localStorage.setItem('marketerTenant', JSON.stringify(data.tenant));
      return '/marketer/panel';
    case 'PROMO_CODE_ADMIN':
      localStorage.setItem('promoCodeAdminToken', data.token);
      localStorage.setItem('promoCodeAdmin', JSON.stringify(data.admin));
      localStorage.setItem('promoCodeAdminTenant', JSON.stringify(data.tenant));
      return '/admin/promo-codes';
    case 'SUPER_ADMIN':
      localStorage.setItem('superAdminToken', data.token);
      localStorage.setItem('superAdmin', JSON.stringify(data.superAdmin));
      return '/admin/dashboard';
    case 'PLATFORM_STAFF':
      localStorage.setItem('platformStaffToken', data.token);
      localStorage.setItem('platformStaff', JSON.stringify(data.staff));
      return data.staff.mustChangePassword ? '/platform-staff/change-password' : '/platform-staff/desk';
    default:
      return '/dashboard';
  }
}

const Login: React.FC = () => {
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>(() => {
    // Восстанавливаем ошибки из sessionStorage при монтировании
    try {
      const saved = sessionStorage.getItem('loginFieldErrors');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('Restored field errors from sessionStorage:', parsed);
        return parsed;
      }
    } catch (e) {
      console.error('Error restoring field errors:', e);
    }
    return {};
  });
  // Инициализируем ref из sessionStorage
  const getInitialRefValue = (): Record<string, string> => {
    try {
      const saved = sessionStorage.getItem('loginFieldErrors');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('Restored fieldErrorsRef from sessionStorage:', parsed);
        return parsed;
      }
    } catch (e) {
      console.error('Error restoring fieldErrorsRef:', e);
    }
    return {};
  };
  const fieldErrorsRef = useRef<Record<string, string>>(getInitialRefValue());
  const isSubmittingRef = useRef<boolean>(false);
  const [forceUpdate, setForceUpdate] = useState(0); // Для принудительного обновления
  
  // НЕ синхронизируем ref с state автоматически - это очищает sessionStorage когда state пустой
  // Вместо этого обновляем ref и sessionStorage только когда устанавливаем ошибки
  // useEffect(() => {
  //   fieldErrorsRef.current = fieldErrors;
  //   if (Object.keys(fieldErrors).length > 0) {
  //     sessionStorage.setItem('loginFieldErrors', JSON.stringify(fieldErrors));
  //   } else {
  //     sessionStorage.removeItem('loginFieldErrors');
  //   }
  // }, [fieldErrors]);

  // НЕ синхронизируем ref с state автоматически - это очищает ref когда state пустой
  // Вместо этого обновляем ref только когда устанавливаем ошибки
  // useEffect(() => {
  //   fieldErrorsRef.current = fieldErrors;
  //   console.log('fieldErrors state updated:', fieldErrors);
  // }, [fieldErrors]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Приводим email к нижнему регистру
    const processedValue = name === 'email' ? value.toLowerCase() : value;
    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
    if (error) setError('');
    // НЕ очищаем ошибку поля при вводе - пусть пользователь видит ошибку до исправления
    // Это поможет понять, что именно неверно
    // Ошибка будет очищена только при успешной отправке формы или при новой попытке входа
  };

  const handleSubmit = async () => {
    // Предотвращаем повторную отправку
    if (isLoading || isSubmittingRef.current) {
      console.log('Already submitting, ignoring');
      return;
    }
    
    isSubmittingRef.current = true;
    setIsLoading(true);
    setError('');
    // Очищаем предыдущие ошибки полей при новой попытке входа
    // Это гарантирует, что ошибка будет показана только для текущей попытки
    setFieldErrors({});
    fieldErrorsRef.current = {};
    sessionStorage.removeItem('loginFieldErrors');

    // Basic validation
    const errors: Record<string, string> = {};
    if (!formData.email || formData.email.trim() === '') {
      errors.email = 'Email обязателен для заполнения';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Введите корректный адрес электронной почты';
      }
    }
    if (!formData.password || formData.password.length === 0) {
      errors.password = 'Пароль обязателен для заполнения';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      fieldErrorsRef.current = errors; // Обновляем ref
      setIsLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    try {
      // Приводим email к нижнему регистру перед отправкой
      const normalizedEmail = formData.email.trim().toLowerCase();
      const data = await apiService.unifiedStaffLogin({
        email: normalizedEmail,
        password: formData.password,
      });
      setFieldErrors({});
      fieldErrorsRef.current = {};
      sessionStorage.removeItem('loginFieldErrors');
      const dest = applyUnifiedStaffLogin(data);
      window.location.assign(dest);
    } catch (err: any) {
      // КРИТИЧЕСКИ ВАЖНО: предотвращаем любую перезагрузку или навигацию при ошибке
      console.log('Error caught, preventing navigation');
      console.error('Login error:', err); // Логируем ошибку для отладки
      console.error('Error response:', err.response); // Логируем полный ответ
      console.error('Error response data:', err.response?.data); // Логируем данные ответа
      
      // Показываем точное сообщение об ошибке с сервера
      const errorMessage = err.response?.data?.error || err.message || 'Ошибка входа. Попробуйте еще раз.';
      console.error('Extracted error message:', errorMessage);
      
      // Привязываем ошибки к конкретным полям
      const serverErrors: Record<string, string> = {};
      const lowerErrorMessage = errorMessage.toLowerCase();
      
      // Проверяем, есть ли детализированные ошибки валидации в data
      const validationErrors = err.response?.data?.data;
      if (Array.isArray(validationErrors) && validationErrors.length > 0) {
        // Обрабатываем ошибки валидации из массива data
        validationErrors.forEach((validationError: any) => {
          if (validationError.field && validationError.message) {
            // Преобразуем сообщения валидации в понятные для пользователя
            let userMessage = validationError.message;
            if (validationError.field === 'email') {
              if (userMessage.includes('valid email')) {
                userMessage = 'Введите корректный адрес электронной почты';
              }
              serverErrors.email = userMessage;
            } else if (validationError.field === 'password') {
              serverErrors.password = userMessage;
            }
          }
        });
      } else if (lowerErrorMessage.includes('аккаунт не существует')) {
        serverErrors.email = 'Аккаунт не существует';
      } else if (lowerErrorMessage.includes('неверный пароль')) {
        serverErrors.password = 'Неверный пароль';
      } else {
        // Если ошибка не связана с конкретным полем, показываем общее сообщение
        setError(errorMessage);
      }
      
      // Устанавливаем ошибки полей
      if (Object.keys(serverErrors).length > 0) {
        console.log('Setting field errors:', serverErrors);
        console.log('Current fieldErrors before update:', fieldErrors);
        console.log('Current fieldErrorsRef:', fieldErrorsRef.current);
        
        // ВАЖНО: полностью заменяем ошибки, а не мержим их
        // Это гарантирует, что старые ошибки не остаются при новой попытке входа
        const newFieldErrors = { ...serverErrors };
        
        console.log('New field errors to set (replacing all previous):', newFieldErrors);
        
        // Обновляем ref СРАЗУ перед обновлением state
        fieldErrorsRef.current = newFieldErrors;
        console.log('fieldErrorsRef set to:', fieldErrorsRef.current);
        
        // Сохраняем в sessionStorage для восстановления при перемонтировании
        sessionStorage.setItem('loginFieldErrors', JSON.stringify(newFieldErrors));
        console.log('Saved to sessionStorage:', newFieldErrors);
        
        // Затем обновляем state
        setFieldErrors(newFieldErrors);
        console.log('setFieldErrors called with:', newFieldErrors);
        
        // Принудительно обновляем компонент
        setForceUpdate(prev => prev + 1);
        
        // Принудительно проверяем и восстанавливаем через несколько таймаутов
        // Это гарантирует, что ошибки будут отображены даже если что-то их очистит
        const restoreErrors = () => {
          setFieldErrors(prev => {
            const refErrors = fieldErrorsRef.current;
            const saved = sessionStorage.getItem('loginFieldErrors');
            let savedErrors = {};
            try {
              if (saved) {
                savedErrors = JSON.parse(saved);
              }
            } catch (e) {
              console.error('Error parsing saved errors:', e);
            }
            
            if (Object.keys(prev).length === 0 && (Object.keys(refErrors).length > 0 || Object.keys(savedErrors).length > 0)) {
              const toRestore = Object.keys(refErrors).length > 0 ? refErrors : savedErrors;
              console.warn('Field errors were cleared! Restoring...', toRestore);
              fieldErrorsRef.current = toRestore;
              sessionStorage.setItem('loginFieldErrors', JSON.stringify(toRestore));
              setForceUpdate(prev => prev + 1); // Принудительно обновляем
              return { ...toRestore };
            }
            if (Object.keys(prev).length > 0) {
              console.log('Field errors still present:', prev);
            }
            return prev;
          });
        };
        
        setTimeout(restoreErrors, 50);
        setTimeout(restoreErrors, 100);
        setTimeout(restoreErrors, 200);
        setTimeout(restoreErrors, 500);
      }
      
      // ВАЖНО: НЕ очищаем formData, чтобы сохранить введенные значения
      // Пароль можно очистить для безопасности, но email оставляем
      // setFormData(prev => ({ ...prev, password: '' }));
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Container component="main" maxWidth="sm" sx={{ flexGrow: 1, py: 4 }}>
      <Box
        sx={{
            marginTop: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              ПрофСпортСРМ
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Войдите в свой аккаунт
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box 
            component="div"
            sx={{ mt: 1 }}
            key={`login-form-${forceUpdate}`}
          >
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Адрес электронной почты"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
              error={!!(fieldErrors.email || fieldErrorsRef.current.email)}
              helperText={fieldErrors.email || fieldErrorsRef.current.email || ''}
              FormHelperTextProps={{
                style: { 
                  color: (fieldErrors.email || fieldErrorsRef.current.email) ? '#d32f2f' : undefined,
                  display: (fieldErrors.email || fieldErrorsRef.current.email) ? 'block' : 'none'
                }
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Пароль"
              type="password"
              id="password"
              autoComplete="current-password"
              value={formData.password || ''}
              onChange={handleChange}
              disabled={isLoading}
              error={!!(fieldErrors.password || fieldErrorsRef.current.password)}
              helperText={fieldErrors.password || fieldErrorsRef.current.password || ''}
              FormHelperTextProps={{
                style: { 
                  color: (fieldErrors.password || fieldErrorsRef.current.password) ? '#d32f2f' : undefined,
                  display: (fieldErrors.password || fieldErrorsRef.current.password) ? 'block' : 'none'
                }
              }}
            />
            {/* Отладочный вывод для проверки состояния */}
            {process.env.NODE_ENV === 'development' && (
              <Box sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', fontSize: '12px' }}>
                Debug: fieldErrors.password = {fieldErrors.password || 'undefined'}<br/>
                Debug: fieldErrorsRef.current.password = {fieldErrorsRef.current.password || 'undefined'}<br/>
                Debug: Object.keys(fieldErrors) = {JSON.stringify(Object.keys(fieldErrors))}
              </Box>
            )}
            <Button
              type="button"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={isLoading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Войти'
              )}
            </Button>
            
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link
                component={RouterLink}
                to="/forgot-password"
                variant="body2"
                sx={{ textDecoration: 'none' }}
              >
                Забыли пароль?
              </Link>
            </Box>

            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary">
                ИЛИ
              </Typography>
            </Divider>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Нет аккаунта?
              </Typography>
              <Link
                component={RouterLink}
                to="/register"
                variant="body2"
                sx={{ textDecoration: 'none', fontWeight: 'medium' }}
              >
                Создать новый аккаунт
              </Link>
            </Box>

            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Link
                component={RouterLink}
                to="/faq"
                variant="body2"
                sx={{ textDecoration: 'none', color: 'text.secondary' }}
              >
                Часто задаваемые вопросы (FAQ)
              </Link>
            </Box>
          </Box>
        </Paper>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Link
            href="https://t.me/profsportcrm"
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ 
              textDecoration: 'none',
              color: 'primary.main',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            Новостной телеграм канал
          </Link>
        </Box>
      </Box>
    </Container>
      <PublicFooter />
    </Box>
  );
};

export default Login;
