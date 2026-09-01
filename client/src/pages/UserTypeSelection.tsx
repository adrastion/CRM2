import React from 'react';
import {
  Container,
  Paper,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Divider
} from '@mui/material';
import { useNavigate, Navigate } from 'react-router-dom';
import { Person, Business } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import PublicFooter from '../components/PublicFooter';

const UserTypeSelection: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  // Если пользователь уже авторизован, перенаправляем на dashboard
  if (isLoading) {
    return null; // Можно показать загрузку
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      <Container maxWidth="sm" sx={{ flex: 1, py: 4, display: 'flex', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 1 }}>
            Добро пожаловать!
          </Typography>
          <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
            Выберите, кто вы
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6
                }
              }}
              onClick={() => navigate('/client/login')}
            >
              <CardContent sx={{ textAlign: 'center', pb: 1 }}>
                <Person sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h5" gutterBottom>
                  Клиент
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Войдите в личный кабинет для просмотра расписания, нормативов и платежей
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button variant="contained" fullWidth>
                  Войти как клиент
                </Button>
              </CardActions>
            </Card>

            <Divider sx={{ my: 1 }}>
              <Typography variant="body2" color="text.secondary">
                или
              </Typography>
            </Divider>

            <Card 
              sx={{ 
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6
                }
              }}
              onClick={() => navigate('/login')}
            >
              <CardContent sx={{ textAlign: 'center', pb: 1 }}>
                <Business sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h5" gutterBottom>
                  Сотрудник
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Войдите в систему управления для администраторов, тренеров и других сотрудников
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button variant="contained" fullWidth>
                  Войти как сотрудник
                </Button>
              </CardActions>
            </Card>
          </Box>

          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Нет аккаунта?{' '}
              <Button 
                variant="text" 
                size="small" 
                onClick={() => navigate('/client/register')}
                sx={{ textTransform: 'none' }}
              >
                Зарегистрироваться как клиент
              </Button>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Родитель?{' '}
              <Button 
                variant="text" 
                size="small" 
                onClick={() => navigate('/parent/register')}
                sx={{ textTransform: 'none' }}
              >
                Зарегистрироваться как родитель
              </Button>
            </Typography>
          </Box>
        </Paper>
      </Container>
      <PublicFooter />
    </Box>
  );
};

export default UserTypeSelection;

