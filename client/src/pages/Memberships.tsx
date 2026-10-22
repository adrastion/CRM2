import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Link,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { apiService } from '../services/api';
import { Membership } from '../types';
import { colors, radii } from '../theme/tokens';
import UnsavedChangesDialog from '../components/common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../hooks/useUnsavedClose';
import MembershipsDesktop from '../components/memberships/MembershipsDesktop';
import AssignMembershipDialog from '../components/memberships/AssignMembershipDialog';
import MembershipFormDialog, {
  MembershipFormState,
} from '../components/memberships/MembershipFormDialog';

const PASTEL_CARD = ['#EEF4FF', '#F3EEFF', '#EEF9F6', '#FFF4F0', '#F5F6FA'] as const;

type StatusFilter = 'all' | 'active' | 'inactive';

const membershipMetaLine = (m: Membership): string => {
  const cat =
    m.category === 'GROUP'
      ? 'Групповой'
      : m.category === 'PERSONAL'
        ? 'Персональный'
        : 'Клиентский';
  if (m.category === 'GROUP') {
    return `Ежемесячно · ${cat}`;
  }
  if (m.periodType === 'CALENDAR_PERIOD') {
    return `${m.periodMonths || 1} мес. · ${cat}`;
  }
  const days = m.validityDays || m.duration;
  if (days) return `${days} дн. · ${cat}`;
  if (m.visits != null) return `${m.visits} зан. · ${cat}`;
  return cat;
};

const membershipVisitsLabel = (m: Membership): string => {
  if (m.category === 'GROUP') return '∞';
  if (m.visits == null) return '∞';
  return String(m.visits);
};

type FormState = MembershipFormState;

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  price: '',
  category: '',
  type: 'visits',
  visits: '',
  validityDays: '',
  periodMonths: '',
  paymentWindowStartDay: '1',
  paymentWindowEndDay: '6',
  recalcMode: 'MISS_THRESHOLD',
  missThresholdPercent: '50',
  groupIds: [],
  isActive: true,
});

const Memberships: React.FC = () => {
  const [items, setItems] = useState<Membership[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expiringSoon: 0,
    assignedClients: 0,
    deltas: {},
  });
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignMembership, setAssignMembership] = useState<Membership | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [res, gr, branchResponse, statsResponse] = await Promise.all([
        apiService.getMemberships({ limit: 200 }),
        apiService.getGroups({ limit: 500 }),
        apiService.getBranches({ limit: 500 }),
        apiService.getMembershipStats(),
      ]);
      setItems(res.data || []);
      setGroups((gr.data || []).map((g: any) => ({ id: g.id, name: g.name })));
      setBranches(
        (branchResponse.data || []).map((branch: any) => ({ id: branch.id, name: branch.name }))
      );
      setStats(
        statsResponse || {
          total: 0,
          active: 0,
          expiringSoon: 0,
          assignedClients: 0,
          deltas: {},
        }
      );
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
      category:
        m.category === 'GROUP' ? 'GROUP' : m.category === 'PERSONAL' ? 'PERSONAL' : 'CLIENT',
      type: m.type === 'monthly' ? 'monthly' : 'visits',
      visits: m.visits != null ? String(m.visits) : '',
      validityDays: m.validityDays != null ? String(m.validityDays) : m.duration != null ? String(m.duration) : '',
      periodMonths:
        m.periodType === 'CALENDAR_PERIOD' && m.periodMonths != null ? String(m.periodMonths) : '',
      paymentWindowStartDay: m.paymentWindowStartDay != null ? String(m.paymentWindowStartDay) : '1',
      paymentWindowEndDay: m.paymentWindowEndDay != null ? String(m.paymentWindowEndDay) : '6',
      recalcMode: (m.recalcMode as FormState['recalcMode']) || 'MISS_THRESHOLD',
      missThresholdPercent: m.missThresholdPercent != null ? String(m.missThresholdPercent) : '50',
      groupIds: (m.membershipGroups || []).map((g) => g.groupId),
      isActive: m.isActive !== false,
    };
    setEditing(m);
    setForm(initial);
    setFormBaseline(initial);
    setDialogOpen(true);
  };

  const buildPayload = (f: FormState, fromDate: string) => {
    if (!f.category) {
      throw new Error('Категория не выбрана');
    }
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
    if (!f.category) {
      setError('Выберите категорию абонемента');
      return false;
    }
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

  const handleDelete = async (target?: Membership) => {
    const membership = target || editing;
    if (!membership) return;
    if (!window.confirm(`Удалить абонемент «${membership.name}»?`)) return;
    setDeleting(true);
    setError('');
    try {
      await apiService.deleteMembership(membership.id);
      if (dialogOpen) discardForm();
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось удалить абонемент');
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (membership: Membership) => {
    setError('');
    try {
      await apiService.duplicateMembership(membership.id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось скопировать абонемент');
    }
  };

  const handleArchive = async (membership: Membership) => {
    if (!window.confirm(`Переместить «${membership.name}» в архив?`)) return;
    setError('');
    try {
      await apiService.archiveMembership(membership.id);
      setMergeSourceIds((current) => current.filter((id) => id !== membership.id));
      if (mergeTargetId === membership.id) setMergeTargetId('');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось архивировать абонемент');
    }
  };

  const handleRestore = async (membership: Membership) => {
    setError('');
    try {
      await apiService.restoreMembership(membership.id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось восстановить абонемент');
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

  const filteredItems = items.filter((m) => {
    if (statusFilter === 'active' && m.isActive === false) return false;
    if (statusFilter === 'inactive' && m.isActive !== false) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    );
  });

  const statusTabSx = (active: boolean) => ({
    textTransform: 'none' as const,
    borderRadius: `${radii.pill}px`,
    px: 1.75,
    py: 0.6,
    fontWeight: 600,
    fontSize: 13,
    minWidth: 0,
    border: 'none',
    cursor: 'pointer',
    bgcolor: active ? colors.primary : colors.surface,
    color: active ? colors.white : colors.textMuted,
    boxShadow: active ? '0 2px 8px rgba(47, 107, 255, 0.25)' : 'none',
    '&:hover': {
      bgcolor: active ? colors.primaryDark : 'rgba(47, 107, 255, 0.08)',
    },
  });

  return (
    <Box data-onboarding="memberships-page">
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        mb={2}
        flexWrap="wrap"
        gap={1.5}
        flexDirection={{ xs: 'column', sm: 'row' }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: { xs: 22, md: 26 },
              fontWeight: 800,
              color: '#1B2438',
              letterSpacing: '-0.02em',
            }}
          >
            Абонементы
          </Typography>
          <Typography sx={{ fontSize: 13, color: colors.textHint, mt: 0.25 }}>
            Создание и назначение абонементов клиентам
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openCreate}
          sx={{
            textTransform: 'none',
            borderRadius: `${radii.button}px`,
            bgcolor: colors.primary,
            fontWeight: 600,
            boxShadow: 'none',
            width: { xs: '100%', sm: 'auto' },
            '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
          }}
        >
          Новый абонемент
        </Button>
      </Box>

      <Alert
        severity="info"
        sx={{
          mb: 2,
          borderRadius: `${radii.panel}px`,
          bgcolor: 'rgba(47, 107, 255, 0.06)',
          border: `1px solid ${colors.primarySoft}`,
        }}
      >
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
        <Alert severity="error" sx={{ mb: 2, borderRadius: `${radii.panel}px` }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1.25,
          mb: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            gap: 0.5,
            p: 0.35,
            bgcolor: colors.surface,
            borderRadius: `${radii.pill}px`,
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          {(
            [
              { id: 'all', label: 'Все' },
              { id: 'active', label: 'Активные' },
              { id: 'inactive', label: 'Неактивные' },
            ] as const
          ).map((tab) => (
            <Box
              key={tab.id}
              component="button"
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              sx={{ ...statusTabSx(statusFilter === tab.id), flex: { xs: 1, sm: 'none' } }}
            >
              {tab.label}
            </Box>
          ))}
        </Box>
        <TextField
          size="small"
          placeholder="Поиск абонемента…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            flex: '1 1 200px',
            maxWidth: { sm: 360 },
            '& .MuiOutlinedInput-root': {
              borderRadius: `${radii.panel}px`,
              bgcolor: colors.card,
            },
          }}
        />
      </Box>

      {items.length >= 2 && (
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: `${radii.panel}px`,
            border: `1px solid ${colors.divider}`,
            bgcolor: colors.card,
            boxShadow: '0 2px 10px rgba(32, 34, 36, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Typography fontWeight={700} color={colors.text}>
            Объединить абонементы
          </Typography>
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
              sx={{ borderRadius: `${radii.button}px` }}
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
              sx={{
                textTransform: 'none',
                borderRadius: `${radii.button}px`,
                borderColor: colors.primarySoft,
                color: colors.primary,
                fontWeight: 600,
              }}
            >
              Объединить
            </Button>
          </Box>
        </Box>
      )}

      {loading ? (
        <Typography color="text.secondary">Загрузка…</Typography>
      ) : filteredItems.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {items.length === 0 ? 'Пока нет абонементов' : 'Ничего не найдено'}
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 1.5,
          }}
        >
          {filteredItems.map((m, index) => (
            <Box
              key={m.id}
              sx={{
                p: 2,
                borderRadius: `${radii.panel}px`,
                bgcolor: { xs: PASTEL_CARD[index % PASTEL_CARD.length], md: colors.card },
                border: { xs: 'none', md: `1px solid ${colors.divider}` },
                boxShadow: '0 2px 12px rgba(32, 34, 36, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                minHeight: 180,
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: colors.text, lineHeight: 1.25 }}>
                  {m.name}
                </Typography>
                <Box
                  sx={{
                    flexShrink: 0,
                    bgcolor: m.archivedAt
                      ? colors.surface
                      : m.isActive !== false
                        ? 'rgba(0, 182, 155, 0.14)'
                        : 'rgba(249,60,101,0.1)',
                    color: m.archivedAt
                      ? colors.textHint
                      : m.isActive !== false
                        ? colors.success
                        : colors.danger,
                    px: 1,
                    py: 0.3,
                    borderRadius: `${radii.button}px`,
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  {m.archivedAt ? 'Архив' : m.isActive !== false ? 'Активен' : 'Неактивен'}
                </Box>
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 22, color: colors.primary, lineHeight: 1.1 }}>
                {Number(m.price).toLocaleString('ru-RU')} ₽
              </Typography>
              <Typography sx={{ fontSize: 13, color: colors.textMuted }}>
                {membershipMetaLine(m)}
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Typography sx={{ fontSize: 12, color: colors.textHint }}>
                  Групп:{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: colors.text }}>
                    {m.membershipGroups?.length || 0}
                  </Box>
                </Typography>
                <Typography sx={{ fontSize: 12, color: colors.textHint }}>
                  Занятий:{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: colors.text }}>
                    {membershipVisitsLabel(m)}
                  </Box>
                </Typography>
              </Box>
              <Box display="flex" gap={1} mt="auto" flexWrap="wrap">
                {m.category !== 'GROUP' && !m.archivedAt && (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setAssignMembership(m)}
                    sx={{
                      textTransform: 'none',
                      borderRadius: `${radii.button}px`,
                      bgcolor: colors.primary,
                      fontWeight: 600,
                      boxShadow: 'none',
                      flex: 1,
                      minWidth: 120,
                      '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
                    }}
                  >
                    Назначить клиенту
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => openEdit(m)}
                  sx={{
                    textTransform: 'none',
                    borderRadius: `${radii.button}px`,
                    borderColor: colors.primarySoft,
                    color: colors.primary,
                    fontWeight: 600,
                    bgcolor: colors.primarySoft,
                    '&:hover': { borderColor: colors.primary, bgcolor: colors.primarySoft },
                  }}
                >
                  Изменить
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}
      </Box>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError('')}
          sx={{ display: { xs: 'none', md: 'flex' }, mb: 1, borderRadius: `${radii.panel}px` }}
        >
          {error}
        </Alert>
      )}

      <MembershipsDesktop
        items={items}
        stats={stats}
        branches={branches}
        loading={loading}
        mergeTargetId={mergeTargetId}
        mergeSourceIds={mergeSourceIds}
        merging={merging}
        onMergeTargetChange={(id) => {
          setMergeTargetId(id);
          setMergeSourceIds((current) => current.filter((sourceId) => sourceId !== id));
        }}
        onMergeSourcesChange={setMergeSourceIds}
        onMerge={handleMerge}
        onCreate={openCreate}
        onEdit={openEdit}
        onAssign={setAssignMembership}
        onDuplicate={handleDuplicate}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onDelete={handleDelete}
      />

      <MembershipFormDialog
        open={dialogOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        groups={groups}
        error={error}
        onClearError={() => setError('')}
        saving={saving}
        deleting={deleting}
        onClose={() => unsaved.requestClose('closeButton')}
        onSave={() => void handleSaveClick()}
        onDelete={() => void handleDelete()}
      />

      <Dialog
        open={effectiveDialog}
        onClose={() => setEffectiveDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: { xs: 0, sm: `${radii.panel}px` } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: colors.text }}>
          С какой даты действует абонемент?
        </DialogTitle>
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

      <AssignMembershipDialog
        membership={assignMembership}
        open={Boolean(assignMembership)}
        onClose={() => setAssignMembership(null)}
        onAssigned={load}
      />

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
