import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { apiService } from '../../services/api';
import { colors, typography } from '../../theme/tokens';

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(
    n || 0
  );

const MarketerDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setData(await apiService.getMarketerDashboard());
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Не удалось загрузить панель');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const c = data.clients || {};

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Панель управления
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Всего клиентов', value: c.total },
          { label: 'Активные школы', value: c.active },
          { label: 'Бесплатное обслуживание', value: c.free },
          { label: 'Лиды', value: c.leads },
          { label: 'Баланс', value: money(data.balance) },
        ].map((item) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={item.label}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                  {item.label}
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: typography.pageTitle }}>{item.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Горящие задачи</Typography>
              {(data.urgentTasks || []).length === 0 ? (
                <Typography color="text.secondary">Нет срочных задач</Typography>
              ) : (
                <List dense>
                  {data.urgentTasks.map((t: any) => (
                    <ListItem
                      key={t.id}
                      component={RouterLink}
                      to="/marketer/tasks"
                      sx={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <ListItemText
                        primary={t.title}
                        secondary={
                          t.dueAt
                            ? new Date(t.dueAt).toLocaleString('ru-RU')
                            : 'Без срока'
                        }
                      />
                      <Chip size="small" label={t.kind} />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Новая информация</Typography>
              {(data.publications || []).length === 0 ? (
                <Typography color="text.secondary">Пока нет публикаций</Typography>
              ) : (
                <List dense>
                  {data.publications.map((p: any) => (
                    <ListItem
                      key={p.id}
                      component={RouterLink}
                      to="/marketer/ads"
                      sx={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <ListItemText
                        primary={p.title}
                        secondary={`${p.type} · ${new Date(p.publishedAt).toLocaleDateString('ru-RU')}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Начисления</Typography>
              {(data.recentAccruals || []).length === 0 ? (
                <Typography color="text.secondary">Пока нет начислений</Typography>
              ) : (
                <List dense>
                  {data.recentAccruals.map((a: any) => (
                    <ListItem
                      key={a.id}
                      component={RouterLink}
                      to="/marketer/finance"
                      sx={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <ListItemText
                        primary={money(a.amount)}
                        secondary={`${a.schoolLabel || '—'} · ${new Date(a.occurredAt).toLocaleDateString('ru-RU')}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Закрывающие документы</Typography>
              {(data.closingDocs || []).length === 0 ? (
                <Typography color="text.secondary">Документов нет</Typography>
              ) : (
                <List dense>
                  {data.closingDocs.map((d: any) => (
                    <ListItem
                      key={d.id}
                      button
                      onClick={async () => {
                        const blob = await apiService.downloadMarketerClosingDocBlob(d.id);
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      }}
                    >
                      <ListItemText
                        primary={d.title}
                        secondary={d.periodLabel || new Date(d.createdAt).toLocaleDateString('ru-RU')}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MarketerDashboard;
