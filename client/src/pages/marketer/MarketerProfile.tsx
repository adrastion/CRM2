import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import { InfoOutlined, ShieldOutlined } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { notifyMarketerOnboardingChanged } from '../../hooks/useMarketerCabinetReady';
import { colors } from '../../theme/tokens';
import { marketerCardSx, marketerFieldSx, marketerRadii } from './marketerUi';

const cardSx = {
  ...marketerCardSx,
  p: { xs: 2, md: 2.5 },
} as const;

const fieldLabelSx = {
  fontSize: 11,
  fontWeight: 700,
  color: '#53657f',
  mb: 0.85,
  display: 'block',
} as const;

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: marketerRadii.control,
    bgcolor: '#fff',
    fontSize: 13.5,
  },
  '& .MuiOutlinedInput-input': {
    py: 1.35,
    px: 1.5,
  },
  '& .Mui-disabled': {
    WebkitTextFillColor: '#405371',
  },
} as const;

const MarketerProfile: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    inn: '',
    taxStatus: 'UNKNOWN',
    confirmNpd: false,
  });
  const [bankOpen, setBankOpen] = useState(false);
  const [bankError, setBankError] = useState('');
  const [bankForm, setBankForm] = useState({
    bankName: '',
    bankBik: '',
    bankAccount: '',
    bankRecipient: '',
  });
  const [bankBusy, setBankBusy] = useState(false);

  const load = async () => {
    const profile = await apiService.getMarketerProfile();
    setData(profile);
    setForm({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phone: profile.phone || '',
      inn: profile.inn || '',
      taxStatus: profile.taxStatus || 'UNKNOWN',
      confirmNpd: profile.taxStatus === 'NPD' && !!profile.taxStatusConfirmedAt,
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить профиль');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setError('');
    setOk('');
    try {
      setSaving(true);
      const updated = await apiService.updateMarketerProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        inn: form.inn,
        taxStatus: form.confirmNpd ? 'NPD' : form.taxStatus === 'NPD' ? 'NPD' : form.taxStatus,
        confirmNpd: form.confirmNpd,
      });
      setData(updated);
      setOk('Изменения сохранены');
      notifyMarketerOnboardingChanged();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const saveBank = async () => {
    setBankError('');
    try {
      setBankBusy(true);
      await apiService.updateMarketerBankDetails(bankForm);
      setBankOpen(false);
      setBankError('');
      await load();
      setOk('Реквизиты сохранены');
      notifyMarketerOnboardingChanged();
    } catch (e: any) {
      setBankError(e?.response?.data?.error || 'Не удалось сохранить реквизиты');
    } finally {
      setBankBusy(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }
  if (!data) return <Alert severity="error">{error || 'Нет данных'}</Alert>;

  const bank = data.bank;
  const missing: string[] = data.onboarding?.missing || [];
  const profileDraft = ['name', 'phone', 'inn', 'taxStatus', 'bank'].some((k) => missing.includes(k));

  return (
    <Box sx={{ width: '100%', maxWidth: 1100, pb: 5 }}>
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: { xs: 26, md: 30 },
          color: '#13213a',
          letterSpacing: '-0.03em',
          mb: 0.75,
        }}
      >
        Мой профиль
      </Typography>
      <Typography sx={{ color: '#7a889e', fontSize: 13, mb: 2.25, maxWidth: 520, lineHeight: 1.5 }}>
        Проверь контакты, статус НПД и реквизиты для выплат
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: marketerRadii.control }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {ok && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: marketerRadii.control }} onClose={() => setOk('')}>
          {ok}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          alignItems: 'flex-start',
          bgcolor: '#eef5ff',
          border: '1px solid #d9e8ff',
          borderRadius: marketerRadii.card,
          px: { xs: 1.75, md: 2.25 },
          py: 1.75,
          mb: 2.5,
        }}
      >
        <InfoOutlined sx={{ color: '#2463ed', fontSize: 20, mt: '1px', flexShrink: 0 }} />
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: '#1a3f8a', mb: 0.35 }}>
            Профиль независимого маркетолога
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: '#4d6a99', lineHeight: 1.55 }}>
            Контакты и реквизиты используются для договоров, актов и выплат. Данные можно уточнить до
            подписания оферты.
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.15fr) minmax(280px,0.85fr)' },
          gap: 2.25,
          alignItems: 'start',
        }}
      >
        <Box sx={{ ...cardSx }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 2.25 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#13213a' }}>Личные данные</Typography>
            {profileDraft && (
              <Box
                sx={{
                  px: 1.1,
                  py: 0.45,
                  borderRadius: '6px',
                  bgcolor: '#eaf2ff',
                  color: '#2463ed',
                  fontSize: 10.5,
                  fontWeight: 750,
                  whiteSpace: 'nowrap',
                }}
              >
                Черновик формы
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <Box>
              <Typography sx={fieldLabelSx}>Фамилия</Typography>
              <TextField
                fullWidth
                value={form.lastName}
                onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))}
                placeholder="Иванов"
                sx={inputSx}
              />
            </Box>
            <Box>
              <Typography sx={fieldLabelSx}>Имя</Typography>
              <TextField
                fullWidth
                value={form.firstName}
                onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))}
                placeholder="Александр"
                sx={inputSx}
              />
            </Box>
            <Box>
              <Typography sx={fieldLabelSx}>Телефон</Typography>
              <TextField
                fullWidth
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+7 ___ ___-__-__"
                sx={inputSx}
              />
            </Box>
            <Box>
              <Typography sx={fieldLabelSx}>Электронная почта</Typography>
              <TextField fullWidth value={data.email || ''} disabled sx={inputSx} />
            </Box>
            <Box>
              <Typography sx={fieldLabelSx}>ИНН</Typography>
              <TextField
                fullWidth
                value={form.inn}
                onChange={(e) => setForm((s) => ({ ...s, inn: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                placeholder="Укажите после согласования договора"
                inputProps={{ inputMode: 'numeric' }}
                sx={inputSx}
              />
            </Box>
          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={() => void save()}
            disabled={saving}
            sx={{
              mt: 2.5,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: 14,
              borderRadius: marketerRadii.control,
              py: 1.35,
              bgcolor: '#2463ed',
              boxShadow: '0 4px 12px rgba(36,99,237,.18)',
              '&:hover': { bgcolor: '#124fcf' },
            }}
          >
            {saving ? 'Сохранение…' : 'Сохранить изменения'}
          </Button>
        </Box>

        <Box sx={{ ...cardSx }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#13213a', mb: 2 }}>
            Статус и выплаты
          </Typography>

          <Typography sx={{ ...fieldLabelSx, mb: 1 }}>Налоговый статус</Typography>
          <Box
            sx={{
              bgcolor: '#f3f8ff',
              border: '1px solid #e0ecff',
              borderRadius: marketerRadii.control,
              p: 1.75,
              mb: 1.5,
            }}
          >
            <Typography sx={{ fontSize: 12.5, color: '#3d5a88', lineHeight: 1.55, mb: 1.25 }}>
              Перед договором и выплатой нужно подтвердить статус плательщика НПД (самозанятый). Проверка ФНС в
              текущей версии не выполняется автоматически.
            </Typography>
            <FormControlLabel
              sx={{
                alignItems: 'flex-start',
                m: 0,
                gap: 1,
                width: '100%',
                '& .MuiFormControlLabel-label': {
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  whiteSpace: 'normal',
                  color: '#243957',
                },
              }}
              control={
                <Checkbox
                  checked={form.confirmNpd}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      confirmNpd: e.target.checked,
                      taxStatus: e.target.checked ? 'NPD' : s.taxStatus === 'NPD' ? 'UNKNOWN' : s.taxStatus,
                    }))
                  }
                  sx={{ pt: 0.15, color: '#2463ed' }}
                />
              }
              label="Подтверждаю статус плательщика НПД"
            />
          </Box>

          <Box sx={{ mb: 1.75 }}>
            <Typography sx={fieldLabelSx}>Банк</Typography>
            <TextField
              fullWidth
              value={bank?.bankName || ''}
              placeholder="Банк получателя"
              disabled
              sx={inputSx}
            />
          </Box>
          <Box sx={{ mb: 2 }}>
            <Typography sx={fieldLabelSx}>Счёт для выплат</Typography>
            <TextField
              fullWidth
              value={bank?.bankAccountMasked || ''}
              placeholder="Ещё не указан"
              disabled
              sx={inputSx}
            />
          </Box>

          <Button
            fullWidth
            onClick={() => {
              setBankError('');
              setBankForm({
                bankName: bank?.bankName || '',
                bankBik: bank?.bankBik || '',
                bankAccount: '',
                bankRecipient: bank?.bankRecipient || '',
              });
              setBankOpen(true);
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 750,
              borderRadius: marketerRadii.control,
              py: 1.15,
              bgcolor: '#eaf2ff',
              color: '#2463ed',
              '&:hover': { bgcolor: '#dde9ff' },
            }}
          >
            {bank?.hasDetails ? 'Изменить реквизиты' : 'Добавить реквизиты'}
          </Button>

          <Box
            sx={{
              mt: 2.5,
              pt: 2,
              borderTop: '1px solid #eef2f7',
              display: 'flex',
              gap: 1.25,
              alignItems: 'flex-start',
            }}
          >
            <ShieldOutlined sx={{ fontSize: 18, color: '#7a889e', mt: '1px', flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontWeight: 750, fontSize: 12, color: '#405371', mb: 0.35 }}>
                Безопасность
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: '#8392a8', lineHeight: 1.55 }}>
                Телефон подтверждается по SMS. История подписей хранится на сервере. При смене номера
                рекомендуем повторную аутентификацию.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <Dialog
        open={bankOpen}
        onClose={() => {
          if (bankBusy) return;
          setBankOpen(false);
          setBankError('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: marketerRadii.dialog } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Банковские реквизиты</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          {bankError && (
            <Alert severity="error" sx={{ borderRadius: marketerRadii.control }} onClose={() => setBankError('')}>
              {bankError}
            </Alert>
          )}
          <TextField
            label="Банк"
            value={bankForm.bankName}
            onChange={(e) => setBankForm((s) => ({ ...s, bankName: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={marketerFieldSx}
          />
          <TextField
            label="БИК"
            value={bankForm.bankBik}
            onChange={(e) => setBankForm((s) => ({ ...s, bankBik: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={marketerFieldSx}
          />
          <TextField
            label="Расчётный счёт"
            value={bankForm.bankAccount}
            onChange={(e) =>
              setBankForm((s) => ({ ...s, bankAccount: e.target.value.replace(/\D/g, '').slice(0, 20) }))
            }
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={marketerFieldSx}
          />
          <TextField
            label="Получатель"
            value={bankForm.bankRecipient}
            onChange={(e) => setBankForm((s) => ({ ...s, bankRecipient: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={marketerFieldSx}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBankOpen(false)} disabled={bankBusy} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={() => void saveBank()}
            disabled={bankBusy}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: marketerRadii.control }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MarketerProfile;
