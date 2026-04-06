import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { usePlatformStaffAuth } from '../contexts/PlatformStaffAuthContext';

const PlatformStaffLogin: React.FC = () => {
  const { login } = usePlatformStaffAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const raw = localStorage.getItem('platformStaff');
      const staff = raw ? JSON.parse(raw) : null;
      navigate(staff?.mustChangePassword ? '/platform-staff/change-password' : '/platform-staff/desk', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Вход: техподдержка / дизайн / безопасность
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Используйте учётную запись, выданную администратором платформы.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Пароль"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Войти'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default PlatformStaffLogin;
