import React from 'react';
import { Box, Typography, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const PublicFooter: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        pt: 2.5,
        pb: 2,
        borderTop: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 2,
            mb: 2,
          }}
        >
          <Typography
            variant="body2"
            component="a"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': {
                color: 'primary.main',
                textDecoration: 'underline',
              },
            }}
          >
            Главная
          </Typography>
          <Typography variant="body2" color="text.secondary">
            |
          </Typography>
          <Typography
            variant="body2"
            component="a"
            href="/terms"
            onClick={(e) => {
              e.preventDefault();
              navigate('/terms');
            }}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': {
                color: 'primary.main',
                textDecoration: 'underline',
              },
            }}
          >
            Пользовательское соглашение
          </Typography>
          <Typography variant="body2" color="text.secondary">
            |
          </Typography>
          <Typography
            variant="body2"
            component="a"
            href="/contacts"
            onClick={(e) => {
              e.preventDefault();
              navigate('/contacts');
            }}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': {
                color: 'primary.main',
                textDecoration: 'underline',
              },
            }}
          >
            Контакты и реквизиты
          </Typography>
          <Typography variant="body2" color="text.secondary">
            |
          </Typography>
          <Typography
            variant="body2"
            component="a"
            href="/pricing"
            onClick={(e) => {
              e.preventDefault();
              navigate('/pricing');
            }}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': {
                color: 'primary.main',
                textDecoration: 'underline',
              },
            }}
          >
            Тарифы
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" align="center">
          © {new Date().getFullYear()} ПРОФСПОРТСРМ. Все права защищены.
        </Typography>
      </Container>
    </Box>
  );
};

export default PublicFooter;

