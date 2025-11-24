import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
} from '@mui/material';
import {
  CheckCircle,
  AttachMoney,
  People,
  Person,
  Groups,
  Business,
  CalendarToday,
  Support,
  TrendingUp,
} from '@mui/icons-material';
import PublicFooter from '../components/PublicFooter';

interface PricingPlan {
  name: string;
  price: string;
  description: string;
  features: {
    trainers: number | string;
    clients: number | string;
    groups: number | string;
    branches: number | string;
    trainings: string;
    support: string;
  };
  popular?: boolean;
}

const pricingPlans: PricingPlan[] = [
  {
    name: 'БЕСПЛАТНЫЙ',
    price: '0₽',
    description: 'Для начинающих школ и тестирования системы',
    features: {
      trainers: 1,
      clients: 30,
      groups: 3,
      branches: 1,
      trainings: '10/месяц',
      support: 'Email (48 часов)',
    },
  },
  {
    name: 'СТАРТОВЫЙ',
    price: '990₽',
    description: 'Для небольших школ, 1-2 филиала',
    features: {
      trainers: 3,
      clients: 90,
      groups: 9,
      branches: 2,
      trainings: 'Безлимит',
      support: 'Email (24 часа)',
    },
  },
  {
    name: 'БИЗНЕС',
    price: '2,490₽',
    description: 'Для средних школ, сеть филиалов',
    features: {
      trainers: 10,
      clients: 600,
      groups: 30,
      branches: 5,
      trainings: 'Безлимит',
      support: 'Email + Telegram (12 часов)',
    },
    popular: true,
  },
  {
    name: 'ПРОФЕССИОНАЛЬНЫЙ',
    price: '4,990₽',
    description: 'Для крупных школ и федераций',
    features: {
      trainers: 25,
      clients: 1500,
      groups: 50,
      branches: 10,
      trainings: 'Безлимит',
      support: 'Email + Telegram + Телефон (4 часа)',
    },
  },
  {
    name: 'КОРПОРАТИВНЫЙ',
    price: 'По запросу',
    description: 'Для крупных сетей и корпораций',
    features: {
      trainers: 'Безлимит',
      clients: 'Безлимит',
      groups: 'Безлимит',
      branches: 'Безлимит',
      trainings: 'Безлимит',
      support: '24/7 с персональным менеджером',
    },
  },
];

const Pricing: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Container maxWidth="xl" sx={{ py: 4, flexGrow: 1 }}>
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <AttachMoney sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          Тарифные планы
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Выберите подходящий тариф для вашей спортивной школы
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Все тарифы включают комиссию платежной системы. Оплата производится ежемесячно.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {pricingPlans.map((plan, index) => (
          <Grid item xs={12} sm={6} md={4} lg={index === 4 ? 12 : undefined} key={plan.name}>
            <Paper
              sx={{
                p: 4,
                boxShadow: plan.popular ? 6 : 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                border: plan.popular ? 2 : 0,
                borderColor: plan.popular ? 'primary.main' : 'transparent',
                '&:hover': {
                  boxShadow: plan.popular ? 8 : 4,
                  transform: 'translateY(-4px)',
                  transition: 'all 0.3s',
                },
              }}
            >
              {plan.popular && (
                <Chip
                  label="ПОПУЛЯРНЫЙ"
                  color="primary"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    fontWeight: 'bold',
                  }}
                />
              )}

              <Box sx={{ mb: 3 }}>
                <Typography variant="h4" component="h2" gutterBottom fontWeight="bold">
                  {plan.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {plan.description}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography variant="h3" component="div" fontWeight="bold" color="primary.main">
                    {plan.price}
                  </Typography>
                  {plan.price !== 'По запросу' && (
                    <Typography variant="body2" color="text.secondary">
                      /месяц
                    </Typography>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <List sx={{ flexGrow: 1 }}>
                <ListItem>
                  <ListItemIcon>
                    <Person color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Тренеры"
                    secondary={plan.features.trainers}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <People color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Клиенты"
                    secondary={plan.features.clients}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Groups color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Группы"
                    secondary={plan.features.groups}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Business color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Филиалы"
                    secondary={plan.features.branches}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CalendarToday color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Тренировки"
                    secondary={plan.features.trainings}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Support color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Поддержка"
                    secondary={plan.features.support}
                  />
                </ListItem>
              </List>

              <Button
                variant={plan.popular ? 'contained' : 'outlined'}
                fullWidth
                size="large"
                sx={{ mt: 3 }}
                disabled={plan.name === 'КОРПОРАТИВНЫЙ'}
              >
                {plan.name === 'КОРПОРАТИВНЫЙ' ? 'Связаться с нами' : 'Выбрать тариф'}
              </Button>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Дополнительная информация */}
      <Box sx={{ mt: 6 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 4, boxShadow: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <TrendingUp sx={{ fontSize: 40, color: 'primary.main' }} />
                <Typography variant="h5" fontWeight="bold">
                  Изменение тарифа
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Вы можете изменить тариф в любой момент:
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Переход на более дорогой тариф"
                    secondary="Изменения вступают в силу немедленно, оплата производится пропорционально оставшемуся периоду"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Переход на более дешевый тариф"
                    secondary="Изменения вступают в силу в конце текущего оплаченного периода"
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 4, boxShadow: 2, backgroundColor: 'primary.light', color: 'white' }}>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Важная информация
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                • Возврат средств не предусмотрен, так как услуга предоставляется помесячно
              </Typography>
              <Typography variant="body1">
                • При отмене подписки вы можете использовать систему до конца оплаченного периода
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
      </Container>
      <PublicFooter />
    </Box>
  );
};

export default Pricing;

