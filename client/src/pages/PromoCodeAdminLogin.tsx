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
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { usePromoCodeAdminAuth } from '../contexts/PromoCodeAdminAuthContext';
import { LoginForm } from '../types';

const PromoCodeAdminLogin: React.FC = () => {
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const { login } = usePromoCodeAdminAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Приводим email к нижнему регистру
    const processedValue = name === 'email' ? value.toLowerCase() : value;
    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
    if (error) setError('');
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setFieldErrors({});

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
      setIsLoading(false);
      return;
    }

    try {
      // Приводим email к нижнему регистру перед отправкой
      const normalizedEmail = formData.email.trim().toLowerCase();
      await login(normalizedEmail, formData.password);
      // Redirect to promo codes admin panel
      navigate('/admin/promo-codes');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Ошибка входа. Проверьте email и пароль.';
      
      // Привязываем ошибки к конкретным полям
      const serverErrors: Record<string, string> = {};
      if (errorMessage.includes('Аккаунт не существует') || errorMessage.toLowerCase().includes('аккаунт не существует')) {
        serverErrors.email = 'Аккаунт не существует';
      } else if (errorMessage.includes('Неверный пароль') || errorMessage.toLowerCase().includes('неверный пароль')) {
        serverErrors.password = 'Неверный пароль';
      } else {
        // Если ошибка не связана с конкретным полем, показываем общее сообщение
        setError(errorMessage);
      }
      
      // Устанавливаем ошибки полей
      if (Object.keys(serverErrors).length > 0) {
        setFieldErrors(prev => ({ ...prev, ...serverErrors }));
      }
      
      setIsLoading(false); // Убеждаемся, что loading сбрасывается при ошибке
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
            Вход для администраторов
          </Typography>
          <Typography variant="body2" align="center" color="textSecondary" sx={{ mb: 3 }}>
            Управление промокодами, реферальными ссылками и маркетологами
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleChange}
              error={!!fieldErrors.email}
              helperText={fieldErrors.email}
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
              value={formData.password}
              onChange={handleChange}
              error={!!fieldErrors.password}
              helperText={fieldErrors.password}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={isLoading}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Войти'}
            </Button>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link component={RouterLink} to="/login" variant="body2">
                Вход для администраторов системы
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default PromoCodeAdminLogin;

