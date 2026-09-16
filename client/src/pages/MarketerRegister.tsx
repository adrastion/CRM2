import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Alert,
  Link as MuiLink,
} from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { applyUnifiedSession } from '../utils/authSession';
import PublicSiteNav from '../components/PublicSiteNav';

const MarketerRegister: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    type: 'MARKETER',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiService.registerMarketer({
        ...form,
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
      });
      const destination = applyUnifiedSession({
        accountType: 'MARKETER',
        token: data.token,
        marketer: data.marketer,
        tenant: data.tenant,
      } as any);
      navigate(destination || '/marketer/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Не удалось зарегистрироваться');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <PublicSiteNav />
      <Container maxWidth="sm" sx={{ py: 4, flexGrow: 1 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Регистрация маркетолога
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Платформенный аккаунт. После регистрации вы сразу попадёте в панель.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2}>
            <TextField
              label="Имя"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label="Телефон"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <FormControl>
              <InputLabel>Тип</InputLabel>
              <Select
                label="Тип"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <MenuItem value="MARKETER">Маркетолог</MenuItem>
                <MenuItem value="MEDIA_PARTNER">Медиа-партнёр</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Пароль"
              type="password"
              required
              helperText="Минимум 6 символов"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? 'Регистрация…' : 'Зарегистрироваться'}
            </Button>
            <Typography variant="body2">
              Уже есть аккаунт?{' '}
              <MuiLink component={Link} to="/auth">
                Войти
              </MuiLink>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default MarketerRegister;
