import React, { useState } from 'react';
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
  Grid,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { RegisterForm } from '../types';
import PublicFooter from '../components/PublicFooter';
import { normalizePhone, validatePhone } from '../utils/phone';

const Register: React.FC = () => {
  const [formData, setFormData] = useState<RegisterForm>({
    tenantName: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError('');
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Validate tenant name
    if (!formData.tenantName || formData.tenantName.trim().length < 2) {
      errors.tenantName = 'Название школы должно содержать минимум 2 символа';
    }

    // Validate first name
    if (!formData.firstName || formData.firstName.trim().length < 2) {
      errors.firstName = 'Имя должно содержать минимум 2 символа';
    }

    // Validate last name
    if (!formData.lastName || formData.lastName.trim().length < 2) {
      errors.lastName = 'Фамилия должна содержать минимум 2 символа';
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      errors.email = 'Введите корректный адрес электронной почты';
    }

    // Validate password
    if (!formData.password || formData.password.length < 6) {
      errors.password = 'Пароль должен содержать минимум 6 символов';
    }

    // Validate password confirmation
    if (formData.password !== confirmPassword) {
      errors.confirmPassword = 'Пароли не совпадают';
    }

    // Validate phone (if provided)
    if (formData.phone && formData.phone.trim() !== '') {
      const phoneError = validatePhone(formData.phone);
      if (phoneError) {
        errors.phone = phoneError;
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Client-side validation
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Пожалуйста, исправьте ошибки в форме');
      setIsLoading(false);
      return;
    }

    setFieldErrors({});

    try {
      // Нормализуем телефон к +7XXXXXXXXXX
      const cleanedData = {
        ...formData,
        phone: formData.phone?.trim() ? normalizePhone(formData.phone) : undefined,
        tenantName: formData.tenantName.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
      };

      await register(cleanedData);
      // Navigate to dashboard on success
      navigate('/dashboard');
    } catch (err: any) {
      // Handle different error types
      const errorMessage = err.response?.data?.error || err.message || 'Ошибка регистрации. Попробуйте еще раз.';
      
      // Translate common errors
      let translatedError = errorMessage;
      if (errorMessage.includes('Email is already registered') || errorMessage.includes('already exists')) {
        translatedError = 'Этот email уже зарегистрирован. Используйте другой email или войдите в систему.';
      } else if (errorMessage.includes('Subdomain is already taken')) {
        translatedError = 'Ошибка создания аккаунта. Попробуйте другое название школы.';
      } else if (errorMessage.includes('validation')) {
        translatedError = 'Проверьте правильность заполнения всех полей.';
      }
      
      setError(translatedError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Container component="main" maxWidth="md" sx={{ flexGrow: 1, py: 4 }}>
      <Box
        sx={{
            marginTop: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              Создайте свою спортивную школу
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Настройте CRM-систему за несколько минут
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'medium' }}>
              Информация о школе
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  id="tenantName"
                  label="Название школы"
                  name="tenantName"
                  value={formData.tenantName}
                  onChange={handleChange}
                  disabled={isLoading}
                  error={!!fieldErrors.tenantName}
                  helperText={fieldErrors.tenantName}
                />
              </Grid>
            </Grid>

            <Typography variant="h6" sx={{ mb: 2, mt: 3, fontWeight: 'medium' }}>
              Информация о владельце
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  id="firstName"
                  label="Имя"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={isLoading}
                  error={!!fieldErrors.firstName}
                  helperText={fieldErrors.firstName}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  id="lastName"
                  label="Фамилия"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={isLoading}
                  error={!!fieldErrors.lastName}
                  helperText={fieldErrors.lastName}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  id="email"
                  label="Адрес электронной почты"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading}
                  error={!!fieldErrors.email}
                  helperText={fieldErrors.email || "Будет использован для входа в систему"}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  id="phone"
                  label="Номер телефона"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={isLoading}
                  placeholder="+79991234567"
                  error={!!fieldErrors.phone}
                  helperText={fieldErrors.phone || 'Необязательно. Например: +7 999 123-45-67 или 8 (999) 123-45-67'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  name="password"
                  label="Пароль"
                  type="password"
                  id="password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  error={!!fieldErrors.password}
                  helperText={fieldErrors.password || "Минимум 6 символов"}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  name="confirmPassword"
                  label="Подтвердите пароль"
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.confirmPassword;
                        return newErrors;
                      });
                    }
                  }}
                  error={!!fieldErrors.confirmPassword || (confirmPassword !== '' && formData.password !== confirmPassword)}
                  helperText={fieldErrors.confirmPassword || (confirmPassword !== '' && formData.password !== confirmPassword ? 'Пароли не совпадают' : '')}
                  disabled={isLoading}
                />
              </Grid>
            </Grid>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={isLoading}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Создать аккаунт'
              )}
            </Button>

            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary">
                ИЛИ
              </Typography>
            </Divider>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Уже есть аккаунт?
              </Typography>
              <Link
                component={RouterLink}
                to="/login"
                variant="body2"
                sx={{ textDecoration: 'none', fontWeight: 'medium' }}
              >
                Войти здесь
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

        <Box sx={{ mt: 4, textAlign: 'center', maxWidth: 600 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'medium' }}>
            Что вы получаете с ПРОФСПОРТСРМ:
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                ✓ Полное управление клиентами
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ✓ Расписание тренировок и посещаемость
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ✓ Отслеживание платежей и членства
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                ✓ Финансовые отчеты и аналитика
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ✓ Поддержка нескольких филиалов
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ✓ Управление тренерами
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Container>
      <PublicFooter />
    </Box>
  );
};

export default Register;
