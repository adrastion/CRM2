import React, { useState } from 'react';
import { Container, Paper, Typography, TextField, Button, Alert, Box, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { usePlatformStaffAuth } from '../contexts/PlatformStaffAuthContext';

const PlatformStaffChangePassword: React.FC = () => {
  const { logout } = usePlatformStaffAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOk('');
    if (!newPassword || newPassword.length < 6) {
      setError('Новый пароль должен быть минимум 6 символов');
      return;
    }
    if (newPassword !== newPassword2) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      await apiService.platformStaffChangePassword(currentPassword, newPassword);
      // Обновим локальный флаг, чтобы следующий редирект шёл в desk
      const raw = localStorage.getItem('platformStaff');
      if (raw) {
        const staff = JSON.parse(raw);
        staff.mustChangePassword = false;
        localStorage.setItem('platformStaff', JSON.stringify(staff));
      }
      setOk('Пароль изменён');
      navigate('/platform-staff/desk', { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось изменить пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>Смена пароля</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Это ваш первый вход. Установите постоянный пароль.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}
        <Box component="form" onSubmit={submit}>
          <TextField
            label="Одноразовый пароль"
            type="password"
            fullWidth
            margin="normal"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <TextField
            label="Новый пароль"
            type="password"
            fullWidth
            margin="normal"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <TextField
            label="Повторите новый пароль"
            type="password"
            fullWidth
            margin="normal"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Сохранить'}
          </Button>
          <Button
            fullWidth
            sx={{ mt: 1 }}
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Выйти
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default PlatformStaffChangePassword;

