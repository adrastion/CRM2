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
  FormHelperText,
  Card,
  CardContent
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { apiService } from '../services/api';
import PublicFooter from '../components/PublicFooter';

interface TenantOption {
  tenant: {
    id: string;
    name: string;
    subdomain: string;
  };
  clients: Array<{
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    phone?: string;
    email?: string;
  }>;
}

const ClientLogin: React.FC = () => {
  const [step, setStep] = useState<'search' | 'login'>('search');
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    password: '',
    tenantId: ''
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantOption | null>(null);
  const fieldErrorsRef = useRef<Record<string, string>>({});
  const isSubmittingRef = useRef(false);

  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!formData.phone && !formData.email) {
      setError('Введите телефон или email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const results = await apiService.findClientsForRegistration(formData.phone || undefined, formData.email || undefined);
      
      if (!results || results.length === 0) {
        setError('Клиент с такими данными не найден. Обратитесь к администратору школы.');
        setIsLoading(false);
        return;
      }

      setTenants(results);
      
      if (results.length === 1) {
        setSelectedTenant(results[0]);
        setFormData(prev => ({ ...prev, tenantId: results[0].tenant.id }));
        setStep('login');
      } else {
        // Несколько школ - нужно выбрать
        setStep('login');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка при поиске клиента');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTenant = (tenant: TenantOption) => {
    setSelectedTenant(tenant);
    setFormData(prev => ({ ...prev, tenantId: tenant.tenant.id }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'email' ? value.toLowerCase() : value
    }));
    // Очищаем ошибку для этого поля при изменении
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        fieldErrorsRef.current = newErrors;
        return newErrors;
      });
    }
  };

  const handleSubmit = async () => {
    // Очищаем все предыдущие ошибки перед новой попыткой входа
    setFieldErrors({});
    fieldErrorsRef.current = {};
    setError(null as any);

    if (isSubmittingRef.current) {
      return;
    }

    if ((!formData.phone && !formData.email) || !formData.password || !formData.tenantId) {
      setError('Заполните все поля');
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const result = await apiService.loginClient(
        formData.phone || undefined,
        formData.email || undefined,
        formData.password,
        formData.tenantId
      );

      // Сохраняем токен и данные клиента
      localStorage.setItem('clientToken', result.token);
      localStorage.setItem('client', JSON.stringify(result.client));
      localStorage.setItem('clientTenant', JSON.stringify(result.tenant));

      // Очищаем ошибки при успешном входе
      setFieldErrors({});
      fieldErrorsRef.current = {};
      sessionStorage.removeItem('clientLoginFieldErrors');

      navigate('/client/dashboard');
    } catch (err: any) {
      isSubmittingRef.current = false;
      const errorMessage = err.response?.data?.error || 'Ошибка при входе';
      const lowerErrorMessage = errorMessage.toLowerCase();

      const serverErrors: Record<string, string> = {};

      if (lowerErrorMessage.includes('аккаунт ожидает подтверждения')) {
        setError('Ваш аккаунт ожидает подтверждения администратором');
      } else if (lowerErrorMessage.includes('клиент не найден')) {
        serverErrors.phone = 'Клиент не найден';
        serverErrors.email = 'Клиент не найден';
      } else if (lowerErrorMessage.includes('неверный пароль')) {
        serverErrors.password = 'Неверный пароль';
      } else {
        setError(errorMessage);
      }

      if (Object.keys(serverErrors).length > 0) {
        setFieldErrors(serverErrors);
        fieldErrorsRef.current = serverErrors;
        sessionStorage.setItem('clientLoginFieldErrors', JSON.stringify(serverErrors));
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      <Container maxWidth="sm" sx={{ flex: 1, py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 3 }}>
            Вход в личный кабинет
          </Typography>

          {step === 'search' && (
            <Box>
              <Typography variant="body1" sx={{ mb: 3, textAlign: 'center' }}>
                Введите ваш телефон или email для поиска в базе школы
              </Typography>
              
              <TextField
                fullWidth
                name="phone"
                label="Телефон"
                value={formData.phone}
                onChange={handleChange}
                margin="normal"
              />
              
              <Typography variant="body2" align="center" sx={{ my: 2 }}>или</Typography>
              
              <TextField
                fullWidth
                name="email"
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                margin="normal"
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}

              <Button
                fullWidth
                variant="contained"
                onClick={handleSearch}
                disabled={isLoading}
                sx={{ mt: 3 }}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Найти'}
              </Button>
            </Box>
          )}

          {step === 'login' && (
            <Box>
              {tenants.length > 1 && !selectedTenant && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Выберите школу:
                  </Typography>
                  {tenants.map((tenantOption: TenantOption) => {
                    const isSelected = ((selectedTenant as any)?.tenant?.id === tenantOption.tenant.id);
                    return (
                      <Card 
                        key={tenantOption.tenant.id} 
                        sx={{ mb: 2, cursor: 'pointer', border: isSelected ? 2 : 1 }}
                        onClick={() => handleSelectTenant(tenantOption)}
                      >
                        <CardContent>
                          <Typography variant="h6">{tenantOption.tenant.name}</Typography>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              )}

              {selectedTenant && (
                <Typography variant="body1" sx={{ mb: 2 }}>
                  Школа: {selectedTenant.tenant.name}
                </Typography>
              )}

              <TextField
                fullWidth
                name="password"
                label="Пароль"
                type="password"
                value={formData.password}
                onChange={handleChange}
                margin="normal"
                error={!!(fieldErrors.password || fieldErrorsRef.current.password)}
                helperText={fieldErrors.password || fieldErrorsRef.current.password || ''}
                FormHelperTextProps={{
                  style: { display: fieldErrors.password || fieldErrorsRef.current.password ? 'block' : 'none' }
                }}
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}

              <Button
                fullWidth
                variant="contained"
                onClick={handleSubmit}
                disabled={isLoading || !formData.tenantId}
                sx={{ mt: 3 }}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Войти'}
              </Button>

              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setStep('search');
                  setSelectedTenant(null);
                  setFormData(prev => ({ ...prev, tenantId: '', password: '' }));
                }}
                sx={{ mt: 2 }}
              >
                Назад
              </Button>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />
          
          <Box textAlign="center">
            <Link component={RouterLink} to="/client/register">
              Нет аккаунта? Зарегистрироваться
            </Link>
          </Box>
        </Paper>
      </Container>
      <PublicFooter />
    </Box>
  );
};

export default ClientLogin;
