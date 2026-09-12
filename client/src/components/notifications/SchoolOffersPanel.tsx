import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';

type Offer = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  publishedAt: string;
};

/**
 * SuperAdmin: публикации «Предложения школам» → push + inbox OWNER.
 */
const SchoolOffersPanel: React.FC = () => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.listSchoolOffers();
      setOffers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить предложения');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePublish = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Укажите заголовок и текст');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiService.publishSchoolOffer({
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || null,
      });
      setTitle('');
      setBody('');
      setUrl('');
      setSuccess('Предложение отправлено владельцам школ');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось опубликовать');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Предложения школам
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Публикация уходит в колокольчик и push всем активным владельцам школ (не changelog).
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <TextField
          fullWidth
          label="Заголовок"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="Текст"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="Ссылка (необязательно)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          sx={{ mb: 2 }}
          helperText="Откроется при клике по уведомлению"
        />
        <Button
          variant="contained"
          onClick={handlePublish}
          disabled={saving}
          sx={{ textTransform: 'none' }}
        >
          {saving ? 'Отправка…' : 'Опубликовать для владельцев'}
        </Button>
      </Paper>

      <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
        Последние публикации
      </Typography>
      {loading ? (
        <Typography color="text.secondary">Загрузка…</Typography>
      ) : (
        <Paper>
          <List dense disablePadding>
            {offers.map((o, i) => (
              <React.Fragment key={o.id}>
                {i > 0 && <Divider />}
                <ListItem alignItems="flex-start">
                  <ListItemText
                    primary={o.title}
                    secondary={`${new Date(o.publishedAt).toLocaleString('ru-RU')}${
                      o.url ? ` · ${o.url}` : ''
                    }\n${o.body}`}
                    secondaryTypographyProps={{ whiteSpace: 'pre-wrap' }}
                  />
                </ListItem>
              </React.Fragment>
            ))}
            {!offers.length && (
              <ListItem>
                <ListItemText primary="Пока нет предложений" />
              </ListItem>
            )}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default SchoolOffersPanel;
