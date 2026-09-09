import React from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Divider,
  Button,
} from '@mui/material';
import {
  ContactMail,
  Email,
  Business,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PublicFooter from '../components/PublicFooter';
import PublicSiteNav from '../components/PublicSiteNav';
import { useAuth } from '../contexts/AuthContext';
import { hasAnySession } from '../utils/authSession';

const Contacts: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const showPublicNav = !isAuthenticated && !hasAnySession();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {showPublicNav && <PublicSiteNav />}
      <Container maxWidth="lg" sx={{ py: 3, flexGrow: 1 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <ContactMail sx={{ fontSize: 36, color: 'primary.main', mb: 1.5 }} />
        <Typography variant="h5" component="h1" gutterBottom fontWeight="bold">
          Контакты и реквизиты
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Шаг 3 из пути: регистрация → тарифы → контакты
        </Typography>
        {showPublicNav && (
          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            <Button variant="outlined" onClick={() => navigate('/register')}>
              1. Регистрация
            </Button>
            <Button variant="outlined" onClick={() => navigate('/pricing')}>
              2. Тарифы
            </Button>
            <Button variant="contained" disabled>
              3. Контакты
            </Button>
          </Box>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Контактная информация */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 4, boxShadow: 2, height: '100%' }}>
            <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
              Контактная информация
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Email sx={{ color: 'primary.main', mt: 0.5 }} />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Email
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    profsportcrm@yandex.ru
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Реквизиты ИП */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 4, boxShadow: 2, height: '100%' }}>
            <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
              Реквизиты индивидуального предпринимателя
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Полное наименование
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  Индивидуальный предприниматель Карась Сергей Сергеевич
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  ИНН
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  331104002146
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  ОГРНИП
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  323330000033789
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Расчетный счет
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  40802810338000045634
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Корреспондентский счет
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  30101810400000000225
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  БИК
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  044525225
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Банк
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  ПАО Сбербанк
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Юридический адрес
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  Владимирская область, Александровский район город Струнино, ул. Заречная, д. 10
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Дополнительная информация */}
        <Grid item xs={12}>
          <Paper sx={{ p: 4, boxShadow: 2, backgroundColor: 'primary.light', color: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Business sx={{ fontSize: 40 }} />
              <Typography variant="h5" fontWeight="bold">
                Обратная связь
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Если у вас возникли вопросы, предложения или вы хотите получить дополнительную информацию о наших услугах, 
              пожалуйста, свяжитесь с нами любым удобным способом. Мы всегда готовы помочь!
            </Typography>
            <Typography variant="body2">
              Время ответа на обращения зависит от выбранного тарифного плана и указано на странице тарифов.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      </Container>
      {showPublicNav && (
        <Box sx={{ bgcolor: 'grey.50', borderTop: 1, borderColor: 'divider', py: 4 }}>
          <Container maxWidth="md" sx={{ textAlign: 'center' }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Готовы подключить школу?
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
              <Button variant="contained" onClick={() => navigate('/register')}>
                1. Регистрация
              </Button>
              <Button variant="outlined" onClick={() => navigate('/pricing')}>
                2. Тарифы
              </Button>
            </Box>
          </Container>
        </Box>
      )}
      <PublicFooter />
    </Box>
  );
};

export default Contacts;

