import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PublicSiteNav from '../components/PublicSiteNav';
import PublicFooter from '../components/PublicFooter';
import { apiService } from '../services/api';
import { colors, radii } from '../theme/tokens';

type Vacancy = {
  id: string;
  title: string;
  slug: string;
  roleType: string;
  description: string;
  requirements?: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  MARKETER: 'Маркетолог',
  DESIGNER: 'Дизайнер',
  PROMOTER: 'Промоутер',
  OTHER: 'Вакансия',
};

/** Публичные вакансии: маркетолог → регистрация, остальные → заявка. */
const PublicVacancies: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyFor, setApplyFor] = useState<Vacancy | null>(null);
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setItems((await apiService.getPublicVacancies()) || []);
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Не удалось загрузить вакансии');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openApply = (v: Vacancy) => {
    if (v.roleType === 'MARKETER') {
      navigate('/marketer/register');
      return;
    }
    setApplyFor(v);
    setName('');
    setContacts('');
    setMessage('');
    setSuccess('');
  };

  const submit = async () => {
    if (!applyFor) return;
    setBusy(true);
    setError('');
    try {
      await apiService.applyToVacancy(applyFor.id, {
        name: name.trim(),
        contacts: contacts.trim(),
        message: message.trim(),
      });
      setSuccess('Заявка отправлена — мы свяжемся с вами');
      setApplyFor(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отправить заявку');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: colors.surface }}>
      <PublicSiteNav />
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 }, flex: 1 }}>
        <Typography
          component="h1"
          sx={{ fontWeight: 800, fontSize: { xs: 28, md: 36 }, mb: 1, color: colors.text }}
        >
          Вакансии
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 560 }}>
          Ищем дизайнеров, маркетологов и промоутеров — помогите спортивным секциям расти вместе с
          ПРОФСПОРТСРМ.
        </Typography>

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {loading && (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        )}
        {!loading && items.length === 0 && (
          <Typography color="text.secondary">Открытых вакансий пока нет</Typography>
        )}

        {items.map((v) => (
          <Paper
            key={v.id}
            elevation={0}
            sx={{
              p: 2.5,
              mb: 2,
              borderRadius: `${radii.panel}px`,
              border: `1px solid ${colors.divider}`,
            }}
          >
            <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" mb={1}>
              <Chip size="small" label={ROLE_LABEL[v.roleType] || v.roleType} color="primary" />
            </Box>
            <Typography variant="h6" fontWeight={800} gutterBottom>
              {v.title}
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', mb: 1.5, color: colors.textMuted }}>
              {v.description}
            </Typography>
            {v.requirements && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                <strong>Требования:</strong> {v.requirements}
              </Typography>
            )}
            <Button
              variant="contained"
              onClick={() => openApply(v)}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {v.roleType === 'MARKETER' ? 'Зарегистрироваться' : 'Откликнуться'}
            </Button>
          </Paper>
        ))}
      </Container>

      <Dialog open={Boolean(applyFor)} onClose={() => setApplyFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Заявка: {applyFor?.title}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Контакты (телефон, Telegram, email)"
            value={contacts}
            onChange={(e) => setContacts(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Сообщение"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            minRows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyFor(null)}>Отмена</Button>
          <Button
            variant="contained"
            disabled={busy || !name.trim() || !contacts.trim() || message.trim().length < 5}
            onClick={() => void submit()}
          >
            Отправить
          </Button>
        </DialogActions>
      </Dialog>

      <PublicFooter />
    </Box>
  );
};

export default PublicVacancies;
