import React, { useState } from 'react';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/tokens';

type Props = {
  /** Заголовок блока */
  title?: string;
  subtitle?: string;
  /** Компактный вид без внешней «карточки» */
  bare?: boolean;
};

/**
 * Единая форма «нам важно ваше мнение» для всех вариантов лендинга.
 */
const LandingFeedbackForm: React.FC<Props> = ({
  title = 'Нам важно ваше мнение',
  subtitle = 'Расскажите, чего не хватает вашей спортивной секции — развиваем продукт вместе с вами.',
  bare = false,
}) => {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true);
    setOk('');
    setErr('');
    try {
      await apiService.submitSiteFeedback({
        name: name.trim() || undefined,
        contact: contact.trim() || undefined,
        body: body.trim(),
      });
      setOk('Спасибо! Мы учтём ваше мнение при развитии платформы.');
      setBody('');
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Не удалось отправить');
    } finally {
      setBusy(false);
    }
  };

  const fields = (
    <>
      {ok && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOk('')}>
          {ok}
        </Alert>
      )}
      {err && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>
          {err}
        </Alert>
      )}
      <TextField
        fullWidth
        label="Имя (необязательно)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        sx={{ mb: 1.5 }}
      />
      <TextField
        fullWidth
        label="Контакт (необязательно)"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        sx={{ mb: 1.5 }}
      />
      <TextField
        fullWidth
        label="Что вам нужно?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        multiline
        minRows={3}
        sx={{ mb: 2 }}
      />
      <Button
        fullWidth
        variant="contained"
        disabled={busy || body.trim().length < 5}
        onClick={() => void submit()}
        sx={{ textTransform: 'none', fontWeight: 800, py: 1.25 }}
      >
        Отправить пожелание
      </Button>
    </>
  );

  return (
    <Box id="feedback">
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: { xs: 24, md: 30 },
          mb: 1,
          textAlign: 'center',
          color: colors.text,
        }}
      >
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3, textAlign: 'center', maxWidth: 480, mx: 'auto' }}>
        {subtitle}
      </Typography>
      {bare ? (
        fields
      ) : (
        <Box
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: `${radii.panel}px`,
            bgcolor: colors.white,
            border: `1px solid ${colors.divider}`,
            boxShadow: '0 12px 40px rgba(13, 75, 215, 0.08)',
          }}
        >
          {fields}
        </Box>
      )}
    </Box>
  );
};

export default LandingFeedbackForm;
