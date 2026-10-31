import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { apiService } from '../../services/api';
import { colors } from '../../theme/tokens';

const cardSx = {
  bgcolor: colors.card,
  borderRadius: '12px',
  border: '1px solid #e6edf5',
  boxShadow: '0 5px 20px rgba(29,59,105,.025)',
} as const;

const MarketerClientCard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState<Date | null>(new Date());
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await apiService.getMarketerClientCard(id);
      setClient(data.client);
      setTasks(data.tasks || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Клиент не найден');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const createTask = async () => {
    if (!client || !title.trim()) return;
    try {
      setSaving(true);
      await apiService.createMarketerTask({
        title: title.trim(),
        dueAt: dueAt?.toISOString() || null,
        kind: 'TASK',
        leadId: client.kind === 'lead' ? client.id : undefined,
        tenantId: client.kind === 'school' ? client.id : undefined,
      });
      setOpen(false);
      setTitle('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось создать задачу');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }
  if (error && !client) return <Alert severity="error">{error}</Alert>;
  if (!client) return null;

  const titleName =
    client.tenantName || client.notes || client.displayCode || 'Организация';

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box sx={{ width: '100%', maxWidth: 1100, pb: 2 }}>
        <Button component={RouterLink} to="/marketer/clients" sx={{ textTransform: 'none', fontWeight: 700, mb: 1.5, px: 0 }}>
          ← К организациям
        </Button>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box sx={{ ...cardSx, p: { xs: 2, md: 2.75 }, mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 12, color: '#7c8aa2', mb: 0.75 }}>Карточка организации</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: 22, md: 26 }, color: '#13213a' }}>
                {titleName}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.25 }}>
                <Box
                  sx={{
                    px: 1.1,
                    py: 0.5,
                    borderRadius: '6px',
                    fontSize: 11,
                    fontWeight: 750,
                    bgcolor: '#eaf2ff',
                    color: '#3167ce',
                  }}
                >
                  {client.kind === 'lead' ? 'Лид / переговоры' : client.status === 'active' ? 'Оплачивает' : 'Пробный период'}
                </Box>
                {client.planType && (
                  <Box sx={{ px: 1.1, py: 0.5, borderRadius: '6px', fontSize: 11, fontWeight: 750, bgcolor: '#f7f9fd', color: '#52647d' }}>
                    Тариф: {client.planType}
                  </Box>
                )}
                {client.riskRank && client.commissionRightActive !== false && (
                  <Box sx={{ px: 1.1, py: 0.5, borderRadius: '6px', fontSize: 11, fontWeight: 750, bgcolor: '#fff5de', color: '#b07a19' }}>
                    Комиссия под риском #{client.riskRank}
                  </Box>
                )}
                {client.commissionRightActive === false && (
                  <Box sx={{ px: 1.1, py: 0.5, borderRadius: '6px', fontSize: 11, fontWeight: 750, bgcolor: '#fdecea', color: '#c0392b' }}>
                    Право на комиссию утрачено
                  </Box>
                )}
              </Box>
              <Typography sx={{ mt: 1.5, fontSize: 13, color: '#71819a', wordBreak: 'break-word' }}>
                {[client.maskedName, client.maskedEmail, client.maskedPhone].filter(Boolean).join(' · ') ||
                  'Контакты скрыты маской'}
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => setOpen(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 750,
                borderRadius: '8px',
                bgcolor: '#2463ed',
                alignSelf: { sm: 'flex-start' },
                '&:hover': { bgcolor: '#124fcf' },
              }}
            >
              Создать задачу
            </Button>
          </Box>
        </Box>

        <Box sx={{ ...cardSx, p: { xs: 1.5, md: 2 } }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              mb: 2,
              minHeight: 40,
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 },
            }}
          >
            <Tab label="Комментарии" />
            <Tab label={`Задачи (${tasks.length})`} />
          </Tabs>

          {tab === 0 && (
            <Box>
              <Typography sx={{ fontSize: 13, color: '#71819a', mb: 1.5, lineHeight: 1.6 }}>
                {client.notes || 'Заметок пока нет. Добавьте задачу или обновите лид из списка организаций.'}
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                placeholder="Черновик комментария (локально на сессию)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Typography sx={{ fontSize: 11, color: '#94a1b3', mt: 1 }}>
                Сохранение комментариев в API — через заметку лида / задачи. Здесь — рабочий черновик.
              </Typography>
            </Box>
          )}

          {tab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {tasks.length === 0 ? (
                <Typography sx={{ color: '#8c9bb0', py: 2, textAlign: 'center' }}>Задач пока нет</Typography>
              ) : (
                tasks.map((t) => (
                  <Box
                    key={t.id}
                    sx={{
                      p: 1.5,
                      borderRadius: '8px',
                      bgcolor: '#f7f9fd',
                      border: '1px solid #eef2f7',
                    }}
                  >
                    <Typography sx={{ fontWeight: 750, color: '#23344f' }}>{t.title}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#71819a', mt: 0.5 }}>
                      {t.kind} · {t.status}
                      {t.dueAt ? ` · до ${new Date(t.dueAt).toLocaleString('ru-RU')}` : ''}
                    </Typography>
                  </Box>
                ))
              )}
            </Box>
          )}
        </Box>

        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle sx={{ fontWeight: 800 }}>Задача по организации</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Заголовок"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ mt: 1, mb: 2 }}
            />
            <DateTimePicker
              label="Срок"
              value={dueAt}
              onChange={(v) => setDueAt(v)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none' }}>
              Отмена
            </Button>
            <Button
              variant="contained"
              disabled={saving || !title.trim()}
              onClick={() => void createTask()}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Создать
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default MarketerClientCard;
