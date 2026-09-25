import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import { CheckCircle, ContentCopy } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { apiService } from '../../services/api';
import { colors, typography } from '../../theme/tokens';
import { adLinkUrl } from '../../utils/refCode';

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(
    n || 0
  );

const MarketerDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2000);
    } catch {
      /* ignore */
    }
  };

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
  const promoCodes: any[] = data.promoCodes || [];
  const referralLinks: any[] = data.referralLinks || [];
  const pendingClicks: any[] = data.pendingClicks || [];
  const pendingClicksCount = data.pendingClicksCount ?? pendingClicks.length;
  const primaryPromo = promoCodes[0];
  const primaryLink = referralLinks[0];
  const primaryAdUrl = primaryLink ? adLinkUrl(primaryLink.code) : '';

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

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Личный промокод</Typography>
              {!primaryPromo ? (
                <Typography color="text.secondary">Активных промокодов пока нет</Typography>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {primaryPromo.code}
                    </Typography>
                    <Tooltip title={copiedKey === `promo-${primaryPromo.id}` ? 'Скопировано' : 'Копировать'}>
                      <IconButton
                        size="small"
                        onClick={() => copyText(primaryPromo.code, `promo-${primaryPromo.id}`)}
                      >
                        {copiedKey === `promo-${primaryPromo.id}` ? (
                          <CheckCircle fontSize="small" color="success" />
                        ) : (
                          <ContentCopy fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Chip size="small" color="success" label="Активен" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {primaryPromo.discountType === 'PERCENTAGE'
                      ? `Скидка ${primaryPromo.discountValue}%`
                      : `Скидка ${primaryPromo.discountValue} ₽`}
                    {primaryPromo.description ? ` · ${primaryPromo.description}` : ''}
                  </Typography>
                  {promoCodes.length > 1 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Ещё активных: {promoCodes.length - 1}
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Рекламная ссылка</Typography>
              {!primaryLink ? (
                <Typography color="text.secondary">Активных ссылок пока нет</Typography>
              ) : (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Школы, пришедшие по ссылке, закрепляются за вами при регистрации.
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        wordBreak: 'break-all',
                        flex: 1,
                      }}
                    >
                      {primaryAdUrl}
                    </Typography>
                    <Tooltip title={copiedKey === `ref-${primaryLink.id}` ? 'Скопировано' : 'Копировать'}>
                      <IconButton
                        size="small"
                        onClick={() => copyText(primaryAdUrl, `ref-${primaryLink.id}`)}
                      >
                        {copiedKey === `ref-${primaryLink.id}` ? (
                          <CheckCircle fontSize="small" color="success" />
                        ) : (
                          <ContentCopy fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Ожидают регистрацию: {pendingClicksCount}
                  </Typography>
                  {referralLinks.length > 1 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Ещё активных ссылок: {referralLinks.length - 1}
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {pendingClicks.length > 0 && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>
              Переходы / ожидают регистрацию
            </Typography>
            <List dense>
              {pendingClicks.map((click: any) => (
                <ListItem key={click.id} disableGutters>
                  <ListItemText
                    primary={new Date(click.clickedAt).toLocaleString('ru-RU')}
                    secondary={click.linkName || click.linkCode}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

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
