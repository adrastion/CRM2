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
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Divider
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

const ClientRegister: React.FC = () => {
  const [step, setStep] = useState<'search' | 'select' | 'register'>('search');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantOption | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!phone && !email) {
      setError('Введите телефон или email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const results = await apiService.findClientsForRegistration(phone || undefined, email || undefined);
      
      if (!results || results.length === 0) {
        setError('Клиент с такими данными не найден. Обратитесь к администратору школы.');
        setIsLoading(false);
        return;
      }

      setTenants(results);
      setStep('select');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка при поиске клиента');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTenant = (tenant: TenantOption) => {
    setSelectedTenant(tenant);
    if (tenant.clients.length === 1) {
      setSelectedClient(tenant.clients[0].id);
      setStep('register');
    } else {
      // Если несколько клиентов в одной школе, нужно выбрать
      setError('Найдено несколько клиентов. Выберите нужного.');
    }
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedClient(clientId);
    setStep('register');
  };

  const handleRegister = async () => {
    if (!selectedTenant || !selectedClient) {
      setError('Выберите школу и клиента');
      return;
    }

    if (!password || password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await apiService.registerClient(selectedClient, selectedTenant.tenant.id, password);
      alert('Регистрация успешна! Ожидайте подтверждения администратором.');
      navigate('/client/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка при регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      <Container maxWidth="sm" sx={{ flex: 1, py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 3 }}>
            Регистрация клиента
          </Typography>

          {step === 'search' && (
            <Box>
              <Typography variant="body1" sx={{ mb: 3, textAlign: 'center' }}>
                Введите ваш телефон или email для поиска в базе школы
              </Typography>
              
              <TextField
                fullWidth
                label="Телефон"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                margin="normal"
                placeholder="+7 (999) 123-45-67"
              />
              
              <Typography variant="body2" align="center" sx={{ my: 2 }}>или</Typography>
              
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
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

          {step === 'select' && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Вы учитесь в этой школе?
              </Typography>
              
              {tenants.map((tenant, index) => (
                <Card key={tenant.tenant.id} sx={{ mb: 2, cursor: 'pointer' }} onClick={() => handleSelectTenant(tenant)}>
                  <CardContent>
                    <Typography variant="h6">{tenant.tenant.name}</Typography>
                    {tenant.clients.length > 1 && (
                      <List>
                        {tenant.clients.map((client) => (
                          <ListItem key={client.id} onClick={(e) => {
                            e.stopPropagation();
                            handleSelectClient(client.id);
                          }}>
                            <ListItemText
                              primary={`${client.lastName} ${client.firstName} ${client.middleName || ''}`.trim()}
                              secondary={client.phone || client.email}
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>
              ))}

              <Button
                fullWidth
                variant="outlined"
                onClick={() => setStep('search')}
                sx={{ mt: 2 }}
              >
                Назад
              </Button>
            </Box>
          )}

          {step === 'register' && selectedTenant && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Регистрация в школе: {selectedTenant.tenant.name}
              </Typography>
              
              <TextField
                fullWidth
                label="Пароль"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
              />
              
              <TextField
                fullWidth
                label="Подтвердите пароль"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                margin="normal"
                required
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}

              <Button
                fullWidth
                variant="contained"
                onClick={handleRegister}
                disabled={isLoading}
                sx={{ mt: 3 }}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Зарегистрироваться'}
              </Button>

              <Button
                fullWidth
                variant="outlined"
                onClick={() => setStep('select')}
                sx={{ mt: 2 }}
              >
                Назад
              </Button>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />
          
          <Box textAlign="center">
            <Link component={RouterLink} to="/client/login">
              Уже зарегистрированы? Войти
            </Link>
          </Box>
        </Paper>
      </Container>
      <PublicFooter />
    </Box>
  );
};

export default ClientRegister;

