import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { apiService } from '../services/api';
import { Membership } from '../types';
import { colors, typography } from '../theme/tokens';
import UnsavedChangesDialog from '../components/common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../hooks/useUnsavedClose';

type FormState = {
  name: string;
  description: string;
  price: string;
  category: 'CLIENT' | 'GROUP';
  type: 'visits' | 'monthly';
  visits: string;
  validityDays: string;
  periodMonths: string;
  paymentWindowStartDay: string;
  paymentWindowEndDay: string;
  recalcMode: 'PAY_ATTENDED' | 'MISS_THRESHOLD';
  missThresholdPercent: string;
  midMonthHalfChargeEnabled: boolean;
  groupIds: string[];
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  price: '',
  category: 'CLIENT',
  type: 'visits',
  visits: '',
  validityDays: '',
  periodMonths: '',
  paymentWindowStartDay: '1',
  paymentWindowEndDay: '6',
  recalcMode: 'MISS_THRESHOLD',
  missThresholdPercent: '50',
  midMonthHalfChargeEnabled: true,
  groupIds: [],
  isActive: true,
});

const Memberships: React.FC = () => {
  const [items, setItems] = useState<Membership[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [effectiveDialog, setEffectiveDialog] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [pendingSave, setPendingSave] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formBaseline, setFormBaseline] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [res, gr] = await Promise.all([
        apiService.getMemberships({ limit: 200 }),
        apiService.getGroups({ limit: 500 }),
      ]);
      setItems(res.data || []);
      setGroups((gr.data || []).map((g: any) => ({ id: g.id, name: g.name })));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось загрузить абонементы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const discardForm = useCallback(() => {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setFormBaseline(emptyForm());
    setPendingSave(null);
  }, []);

  const formDirty = isDirtyValue(form, formBaseline);
  const unsaved = useUnsavedClose({
    isDirty: formDirty && dialogOpen,
    onDiscard: discardForm,
    onSave: async () => doSave(form, effectiveFrom),
  });

  const openCreate = () => {
    const initial = emptyForm();
    setEditing(null);
    setForm(initial);
    setFormBaseline(initial);
    setDialogOpen(true);
  };

  const openEdit = (m: Membership) => {
    const initial: FormState = {
      name: m.name || '',
      description: m.description || '',
      price: String(m.price ?? ''),
      category: m.category === 'GROUP' ? 'GROUP' : 'CLIENT',
      type: m.type === 'monthly' ? 'monthly' : 'visits',
      visits: m.visits != null ? String(m.visits) : '',
      validityDays: m.validityDays != null ? String(m.validityDays) : m.duration != null ? String(m.duration) : '',
      periodMonths:
        m.periodType === 'CALENDAR_PERIOD' && m.periodMonths != null ? String(m.periodMonths) : '',
      paymentWindowStartDay: m.paymentWindowStartDay != null ? String(m.paymentWindowStartDay) : '1',
      paymentWindowEndDay: m.paymentWindowEndDay != null ? String(m.paymentWindowEndDay) : '6',
      recalcMode: (m.recalcMode as FormState['recalcMode']) || 'MISS_THRESHOLD',
      missThresholdPercent: m.missThresholdPercent != null ? String(m.missThresholdPercent) : '50',
      midMonthHalfChargeEnabled: m.midMonthHalfChargeEnabled !== false,
      groupIds: (m.membershipGroups || []).map((g) => g.groupId),
      isActive: m.isActive !== false,
    };
    setEditing(m);
    setForm(initial);
    setFormBaseline(initial);
    setDialogOpen(true);
  };

  const buildPayload = (f: FormState, fromDate: string) => {
    const payload: Record<string, unknown> = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      price: Number(f.price),
      category: f.category,
      isActive: f.isActive,
    };
    if (f.category === 'GROUP') {
      payload.type = 'group_monthly';
      payload.paymentWindowStartDay = Number(f.paymentWindowStartDay) || 1;
      payload.paymentWindowEndDay = Number(f.paymentWindowEndDay) || 6;
      payload.recalcMode = f.recalcMode;
      payload.missThresholdPercent = Number(f.missThresholdPercent) || 50;
      payload.midMonthHalfChargeEnabled = f.midMonthHalfChargeEnabled;
      payload.groupBindings = f.groupIds.map((groupId) => ({
        groupId,
        effectiveFrom: fromDate,
      }));
    } else {
      const visits = f.visits.trim() ? Number(f.visits) : null;
      const validityDays = f.validityDays.trim() ? Number(f.validityDays) : null;
      const periodMonths = f.periodMonths.trim() ? Number(f.periodMonths) : null;

      payload.visits = Number.isFinite(visits as number) ? visits : null;
      payload.validityDays = Number.isFinite(validityDays as number) ? validityDays : null;
      payload.duration = payload.validityDays;
      payload.periodMonths = Number.isFinite(periodMonths as number) ? periodMonths : null;

      if (payload.periodMonths != null) {
        payload.periodType = 'CALENDAR_PERIOD';
        payload.type = 'monthly';
      } else if (payload.visits != null) {
        payload.periodType = 'VISITS';
        payload.type = 'visits';
      } else if (payload.validityDays != null) {
        payload.periodType = 'FIXED_DAYS';
        payload.type = 'monthly';
      } else {
        payload.periodType = 'VISITS';
        payload.type = 'visits';
      }
    }
    return payload;
  };

  const doSave = async (f: FormState, fromDate: string): Promise<boolean> => {
    if (!f.name.trim()) {
      setError('Укажите название');
      return false;
    }
    const price = Number(f.price);
    if (!Number.isFinite(price) || price < 0) {
      setError('Укажите корректную цену');
      return false;
    }
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload(f, fromDate);
      if (editing) await apiService.updateMembership(editing.id, payload);
      else await apiService.createMembership(payload);
      discardForm();
      await load();
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось сохранить');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = async () => {
    if (form.category === 'GROUP' && form.groupIds.length > 0) {
      const prevIds = new Set((editing?.membershipGroups || []).map((g) => g.groupId));
      const needsEffective = form.groupIds.some((id) => !prevIds.has(id)) || !editing;
      if (needsEffective) {
        setPendingSave(form);
        setEffectiveFrom(new Date().toISOString().slice(0, 10));
        setEffectiveDialog(true);
        return;
      }
    }
    await doSave(form, effectiveFrom);
  };

  const confirmEffective = async () => {
    if (!pendingSave) return;
    setEffectiveDialog(false);
    await doSave(pendingSave, effectiveFrom);
    setPendingSave(null);
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!window.confirm(`Удалить абонемент «${editing.name}»?`)) return;
    setDeleting(true);
    setError('');
    try {
      await apiService.deleteMembership(editing.id);
      discardForm();
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось удалить абонемент');
    } finally {
      setDeleting(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeTargetId) {
      setError('Выберите целевой абонемент');
      return;
    }
    if (mergeSourceIds.length === 0) {
      setError('Выберите хотя бы один исходный абонемент');
      return;
    }
    if (mergeSourceIds.includes(mergeTargetId)) {
      setError('Целевой абонемент не должен быть среди исходных');
      return;
    }
    const targetName = items.find((m) => m.id === mergeTargetId)?.name || mergeTargetId;
    if (
      !window.confirm(
        `Объединить ${mergeSourceIds.length} абонемент(ов) в «${targetName}»? Исходные будут деактивированы.`
      )
    ) {
      return;
    }
    setMerging(true);
    setError('');
    try {
      await apiService.mergeMemberships(mergeTargetId, mergeSourceIds);
      setMergeTargetId('');
      setMergeSourceIds([]);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось объединить абонементы');
    } finally {
      setMerging(false);
    }
  };

  const mergeSourceOptions = items.filter((m) => m.id !== mergeTargetId);
  const mergeTargetOptions = items.filter((m) => !mergeSourceIds.includes(m.id));

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography sx={{ fontSize: typography.pageTitle, fontWeight: 700, color: colors.text }}>
          Абонементы
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Создать
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Если нужно принять оплату за разовую тренировку — не создавайте абонемент. Внесите платёж в{' '}
        <Link component={RouterLink} to="/finance">
          Финансах
        </Link>
        . Инструкция:{' '}
        <Link component={RouterLink} to="/faq">
          FAQ
        </Link>
        .
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {items.length >= 2 && (
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 2,
            border: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Typography fontWeight={600}>Объединить абонементы</Typography>
          <Typography variant="body2" color="text.secondary">
            Клиенты и группы переносятся на целевой абонемент; исходные деактивируются.
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Целевой абонемент</InputLabel>
            <Select
              label="Целевой абонемент"
              value={mergeTargetId}
              onChange={(e) => {
                const id = e.target.value as string;
                setMergeTargetId(id);
                setMergeSourceIds((prev) => prev.filter((s) => s !== id));
              }}
            >
              {mergeTargetOptions.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}
                  {m.isActive === false ? ' (выкл)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Исходные абонементы</InputLabel>
            <Select
              multiple
              label="Исходные абонементы"
              value={mergeSourceIds}
              onChange={(e) => setMergeSourceIds(e.target.value as string[])}
              input={<OutlinedInput label="Исходные абонементы" />}
              renderValue={(selected) =>
                items
                  .filter((m) => selected.includes(m.id))
                  .map((m) => m.name)
                  .join(', ')
              }
            >
              {mergeSourceOptions.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  <Checkbox checked={mergeSourceIds.includes(m.id)} />
                  <ListItemText primary={`${m.name}${m.isActive === false ? ' (выкл)' : ''}`} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box>
            <Button
              variant="outlined"
              onClick={handleMerge}
              disabled={merging || !mergeTargetId || mergeSourceIds.length === 0}
            >
              Объединить
            </Button>
          </Box>
        </Box>
      )}

      {loading ? (
        <Typography color="text.secondary">Загрузка…</Typography>
      ) : items.length === 0 ? (
        <Typography color="text.secondary">Пока нет абонементов</Typography>
      ) : (
        <Box display="flex" flexDirection="column" gap={1}>
          {items.map((m) => (
            <Box
              key={m.id}
              onClick={() => openEdit(m)}
              sx={{
                p: 2,
                borderRadius: 2,
                border: `1px solid ${colors.border}`,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                <Typography fontWeight={600}>{m.name}</Typography>
                <Chip size="small" label={m.category === 'GROUP' ? 'Групповой' : 'Клиентский'} />
                {!m.isActive && <Chip size="small" label="Выкл" />}
                <Typography color="text.secondary" sx={{ ml: 'auto' }}>
                  {Number(m.price).toLocaleString('ru-RU')} ₽
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {m.category === 'GROUP'
                  ? `Окно оплаты: ${m.paymentWindowStartDay ?? 1}–${m.paymentWindowEndDay ?? 6} · групп: ${m.membershipGroups?.length || 0}`
                  : m.periodType === 'CALENDAR_PERIOD'
                    ? `Календарный период: ${m.periodMonths || 1} мес.`
                    : m.visits != null
                      ? `${m.visits} занятий` + (m.validityDays || m.duration ? ` / ${m.validityDays || m.duration} дн.` : '')
                      : m.validityDays || m.duration
                        ? `${m.validityDays || m.duration} дн.`
                        : 'Без лимита'}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Dialog
        open={dialogOpen}
        onClose={(_e, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') unsaved.requestClose(reason);
          else discardForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editing ? 'Редактировать абонемент' : 'Новый абонемент'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <FormControl fullWidth>
            <InputLabel>Категория</InputLabel>
            <Select
              label="Категория"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as 'CLIENT' | 'GROUP' })}
            >
              <MenuItem value="CLIENT">Клиентский (на человека)</MenuItem>
              <MenuItem value="GROUP">Групповой (ежемесячная оплата группы)</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth required />
          <TextField label="Цена" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} fullWidth required />
          <TextField label="Описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth multiline minRows={2} />

          {form.category === 'CLIENT' ? (
            <>
              <TextField
                label="Кол-во занятий"
                type="number"
                value={form.visits}
                onChange={(e) => setForm({ ...form, visits: e.target.value })}
                fullWidth
                helperText="Необязательно — можно оставить без лимита"
              />
              <TextField
                label="Срок действия, дней"
                type="number"
                value={form.validityDays}
                onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
                fullWidth
                helperText="Необязательно — например 12 занятий и/или 45 дней"
              />
              <TextField
                label="Календарных месяцев"
                type="number"
                value={form.periodMonths}
                onChange={(e) => setForm({ ...form, periodMonths: e.target.value })}
                fullWidth
                helperText="Необязательно — срок без учёта числа тренировок"
              />
            </>
          ) : (
            <>
              <Box display="flex" gap={2}>
                <TextField
                  label="Окно оплаты с (день)"
                  type="number"
                  value={form.paymentWindowStartDay}
                  onChange={(e) => setForm({ ...form, paymentWindowStartDay: e.target.value })}
                  fullWidth
                  inputProps={{ min: 1, max: 28 }}
                />
                <TextField
                  label="по (день)"
                  type="number"
                  value={form.paymentWindowEndDay}
                  onChange={(e) => setForm({ ...form, paymentWindowEndDay: e.target.value })}
                  fullWidth
                  inputProps={{ min: 1, max: 28 }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                С дня после окончания окна ученикам уходит уведомление о неоплате.
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Перерасчёт пропусков</InputLabel>
                <Select
                  label="Перерасчёт пропусков"
                  value={form.recalcMode}
                  onChange={(e) => setForm({ ...form, recalcMode: e.target.value as FormState['recalcMode'] })}
                >
                  <MenuItem value="PAY_ATTENDED">Платят только за посещённые</MenuItem>
                  <MenuItem value="MISS_THRESHOLD">Перерасчёт при пропуске N% занятий</MenuItem>
                </Select>
              </FormControl>
              {form.recalcMode === 'MISS_THRESHOLD' && (
                <TextField
                  label="Порог пропуска %"
                  type="number"
                  value={form.missThresholdPercent}
                  onChange={(e) => setForm({ ...form, missThresholdPercent: e.target.value })}
                  fullWidth
                />
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={form.midMonthHalfChargeEnabled}
                    onChange={(e) => setForm({ ...form, midMonthHalfChargeEnabled: e.target.checked })}
                  />
                }
                label="Правило mid-month 50% (на следующий месяц)"
              />
              <FormControl fullWidth>
                <InputLabel>Группы</InputLabel>
                <Select
                  multiple
                  label="Группы"
                  value={form.groupIds}
                  onChange={(e) => setForm({ ...form, groupIds: e.target.value as string[] })}
                  input={<OutlinedInput label="Группы" />}
                  renderValue={(selected) =>
                    groups
                      .filter((g) => selected.includes(g.id))
                      .map((g) => g.name)
                      .join(', ')
                  }
                >
                  {groups.map((g) => (
                    <MenuItem key={g.id} value={g.id}>
                      <Checkbox checked={form.groupIds.includes(g.id)} />
                      <ListItemText primary={g.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}

          <FormControlLabel
            control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
            label="Активен"
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: editing ? 'space-between' : 'flex-end' }}>
          {editing && (
            <Button color="error" onClick={handleDelete} disabled={saving || deleting}>
              Удалить
            </Button>
          )}
          <Box display="flex" gap={1}>
            <Button onClick={() => unsaved.requestClose('closeButton')}>Отмена</Button>
            <Button variant="contained" onClick={handleSaveClick} disabled={saving || deleting}>
              Сохранить
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog open={effectiveDialog} onClose={() => setEffectiveDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>С какой даты действует абонемент?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Укажите дату старта начислений для привязанных групп (если забыли выдать абонемент раньше).
          </Typography>
          <TextField
            type="date"
            label="Дата старта"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEffectiveDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={confirmEffective} disabled={saving}>
            Применить
          </Button>
        </DialogActions>
      </Dialog>

      <UnsavedChangesDialog
        open={unsaved.confirmOpen}
        saving={unsaved.saving}
        onSave={unsaved.save}
        onDiscard={unsaved.discard}
        onStay={unsaved.stay}
      />
    </Box>
  );
};

export default Memberships;
