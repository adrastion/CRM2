import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit, OpenInNew } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { canEditPaymentMethods, canConfirmPaymentReceipts } from '../../utils/roles';
import { colors, radii } from '../../theme/tokens';
import type { User } from '../../types';

type Method = {
  id: string;
  title: string;
  paymentUrl: string | null;
  hasQr: boolean;
  isDefault: boolean;
  groupIds: string[];
  groups: Array<{ id: string; name: string }>;
  membershipIds: string[];
  memberships: Array<{ id: string; name: string }>;
};

type ReceiptRow = {
  id: string;
  amount: number;
  client: { id: string; firstName: string; lastName: string; middleName?: string | null };
  groupName?: string | null;
  membershipName?: string | null;
  receipt: {
    claimedAmount: number;
    mimeType: string;
    originalName: string;
    submittedAt: string;
  } | null;
};

const QrPreview: React.FC<{ methodId: string; large?: boolean }> = ({ methodId, large }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await apiService.getSchoolPaymentMethodQrBlob(methodId);
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        revoked = u;
        setUrl(u);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [methodId]);
  if (!url) {
    return (
      <Box
        sx={{
          width: large ? 280 : 72,
          height: large ? 280 : 72,
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      />
    );
  }
  return (
    <Box
      component="img"
      src={url}
      alt="QR"
      sx={{
        width: large ? 280 : 72,
        height: large ? 280 : 72,
        objectFit: 'contain',
        borderRadius: 1,
        bgcolor: '#fff',
      }}
    />
  );
};

const ReceiptThumb: React.FC<{ paymentId: string; mimeType: string }> = ({ paymentId, mimeType }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await apiService.getPaymentReceiptBlob(paymentId);
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        revoked = u;
        setUrl(u);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [paymentId]);
  if (!url) return <Typography variant="caption">…</Typography>;
  if (mimeType === 'application/pdf') {
    return (
      <Button size="small" href={url} target="_blank" rel="noreferrer">
        PDF
      </Button>
    );
  }
  return (
    <Box
      component="img"
      src={url}
      alt="Чек"
      sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1, cursor: 'pointer' }}
      onClick={() => window.open(url, '_blank')}
    />
  );
};

type Props = {
  user?: Pick<User, 'role'> | null;
  groups: Array<{ id: string; name: string }>;
};

const SchoolPaymentMethodsPanel: React.FC<Props> = ({ user, groups }) => {
  const canEdit = canEditPaymentMethods(user?.role);
  const canConfirm = canConfirmPaymentReceipts(user?.role);
  const [methods, setMethods] = useState<Method[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [memberships, setMemberships] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState('');
  const [enlarge, setEnlarge] = useState<Method | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Method | null>(null);
  const [title, setTitle] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [selGroups, setSelGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selMemberships, setSelMemberships] = useState<Array<{ id: string; name: string }>>([]);
  const [qrFile, setQrFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, r, mem] = await Promise.all([
        apiService.listSchoolPaymentMethods(),
        canConfirm ? apiService.listAwaitingPaymentReceipts() : Promise.resolve([]),
        apiService.getMemberships({ limit: 200 }).catch(() => ({ data: [] as any[] })),
      ]);
      setMethods(m);
      setReceipts(r);
      setMemberships(
        (mem.data || []).map((x: any) => ({ id: x.id, name: x.name })).filter((x: any) => x.id && x.name)
      );
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить реквизиты');
    }
  }, [canConfirm]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setPaymentUrl('');
    setIsDefault(methods.length === 0);
    setSelGroups([]);
    setSelMemberships([]);
    setQrFile(null);
    setEditOpen(true);
  };

  const openEdit = (m: Method) => {
    setEditing(m);
    setTitle(m.title);
    setPaymentUrl(m.paymentUrl || '');
    setIsDefault(m.isDefault);
    setSelGroups(m.groups || []);
    setSelMemberships(m.memberships || []);
    setQrFile(null);
    setEditOpen(true);
  };

  const save = async () => {
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('paymentUrl', paymentUrl.trim());
      form.append('isDefault', String(isDefault || (selGroups.length === 0 && selMemberships.length === 0)));
      form.append('groupIds', JSON.stringify(selGroups.map((g) => g.id)));
      form.append('membershipIds', JSON.stringify(selMemberships.map((m) => m.id)));
      if (qrFile) form.append('qr', qrFile);
      if (editing) await apiService.updateSchoolPaymentMethod(editing.id, form);
      else await apiService.createSchoolPaymentMethod(form);
      setEditOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Удалить реквизит оплаты?')) return;
    try {
      await apiService.deleteSchoolPaymentMethod(id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить');
    }
  };

  const confirmReceipt = async (paymentId: string) => {
    try {
      await apiService.confirmPaymentReceipt(paymentId);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось подтвердить');
    }
  };

  const rejectReceipt = async (paymentId: string) => {
    if (!window.confirm('Отклонить чек? Платёж вернётся в статус ожидания.')) return;
    try {
      await apiService.rejectPaymentReceipt(paymentId);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отклонить');
    }
  };

  return (
    <Box
      sx={{
        mb: 2,
        p: 1.5,
        bgcolor: colors.card,
        borderRadius: radii.panel * 2,
        boxShadow: '0 2px 8px rgba(32, 34, 36, 0.04)',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: { xs: 16, sm: 18 } }}>
          Реквизиты для оплаты
        </Typography>
        {canEdit && (
          <Button size="small" startIcon={<Add />} variant="outlined" onClick={openCreate}>
            Добавить
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {methods.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {canEdit
            ? 'Загрузите QR и/или ссылку на оплату — родители увидят их в личном кабинете.'
            : 'Реквизиты оплаты ещё не настроены.'}
        </Typography>
      ) : (
        <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 1 }}>
          {methods.map((m) => (
            <Box
              key={m.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 1,
                minWidth: 200,
                maxWidth: 280,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                {m.hasQr ? (
                  <Box
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setEnlarge(m)}
                    title="Открыть крупнее"
                  >
                    <QrPreview methodId={m.id} />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="caption">нет QR</Typography>
                  </Box>
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600} noWrap>
                    {m.title}
                  </Typography>
                  {m.isDefault && <Chip size="small" label="По умолчанию" sx={{ mt: 0.5 }} />}
                  {m.paymentUrl && (
                    <Typography
                      variant="caption"
                      component="a"
                      href={m.paymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ display: 'block', mt: 0.5, wordBreak: 'break-all' }}
                    >
                      Ссылка
                    </Typography>
                  )}
                  <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                    {(m.groups || []).map((g) => (
                      <Chip key={g.id} size="small" label={g.name} variant="outlined" />
                    ))}
                    {(m.memberships || []).map((x) => (
                      <Chip key={x.id} size="small" label={x.name} color="primary" variant="outlined" />
                    ))}
                  </Stack>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                    {m.hasQr && (
                      <IconButton size="small" onClick={() => setEnlarge(m)}>
                        <OpenInNew fontSize="small" />
                      </IconButton>
                    )}
                    {canEdit && (
                      <>
                        <IconButton size="small" onClick={() => openEdit(m)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => remove(m.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {canConfirm && receipts.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography fontWeight={600} sx={{ mb: 1 }}>
            Чеки на проверке ({receipts.length})
          </Typography>
          <Stack spacing={1}>
            {receipts.map((r) => (
              <Box
                key={r.id}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  alignItems: 'center',
                  p: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                {r.receipt && (
                  <ReceiptThumb paymentId={r.id} mimeType={r.receipt.mimeType} />
                )}
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <Typography fontWeight={600}>
                    {r.client.lastName} {r.client.firstName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    К оплате: {Number(r.amount).toLocaleString('ru-RU')} ₽
                    {r.receipt
                      ? ` · в чеке: ${Number(r.receipt.claimedAmount).toLocaleString('ru-RU')} ₽`
                      : ''}
                    {[r.groupName, r.membershipName].filter(Boolean).length
                      ? ` · ${[r.groupName, r.membershipName].filter(Boolean).join(' / ')}`
                      : ''}
                  </Typography>
                </Box>
                <Button size="small" color="success" variant="contained" onClick={() => confirmReceipt(r.id)}>
                  Подтвердить
                </Button>
                <Button size="small" color="inherit" onClick={() => rejectReceipt(r.id)}>
                  Отклонить
                </Button>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      <Dialog open={Boolean(enlarge)} onClose={() => setEnlarge(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{enlarge?.title || 'QR'}</DialogTitle>
        <DialogContent>
          <Stack alignItems="center" spacing={2} sx={{ py: 1 }}>
            {enlarge?.hasQr && <QrPreview methodId={enlarge.id} large />}
            {enlarge?.paymentUrl && (
              <Typography
                component="a"
                href={enlarge.paymentUrl}
                target="_blank"
                rel="noreferrer"
                sx={{ wordBreak: 'break-all' }}
              >
                {enlarge.paymentUrl}
              </Typography>
            )}
            {enlarge?.paymentUrl && (
              <Button
                size="small"
                onClick={() => navigator.clipboard?.writeText(enlarge.paymentUrl || '')}
              >
                Копировать ссылку
              </Button>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEnlarge(null)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Редактировать реквизит' : 'Новый реквизит'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Название"
              fullWidth
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TextField
              label="Ссылка на оплату"
              fullWidth
              value={paymentUrl}
              onChange={(e) => setPaymentUrl(e.target.value)}
              placeholder="https://..."
            />
            <Button component="label" variant="outlined">
              {qrFile ? qrFile.name : editing?.hasQr ? 'Заменить QR' : 'Загрузить QR'}
              <input
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => setQrFile(e.target.files?.[0] || null)}
              />
            </Button>
            <Autocomplete
              multiple
              options={groups}
              getOptionLabel={(o) => o.name}
              value={selGroups}
              onChange={(_, v) => setSelGroups(v)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField {...params} label="Группы" helperText="Пусто + без тарифов = по умолчанию" />
              )}
            />
            <Autocomplete
              multiple
              options={memberships}
              getOptionLabel={(o) => o.name}
              value={selMemberships}
              onChange={(_, v) => setSelMemberships(v)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} label="Абонементы (тарифы)" />}
            />
            <Button
              size="small"
              variant={isDefault ? 'contained' : 'outlined'}
              onClick={() => setIsDefault((v) => !v)}
            >
              {isDefault ? 'По умолчанию: да' : 'Сделать по умолчанию'}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={save} disabled={!title.trim()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SchoolPaymentMethodsPanel;
