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
  /** banner — 1:1 strip from finance salary mock */
  variant?: 'admin' | 'banner';
};

/** Decorative QR glyph for empty / mock state (matches salary mock) */
const MockQrMark: React.FC = () => (
  <Box
    sx={{
      width: 52,
      height: 52,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
      <rect width="52" height="52" fill="#fff" />
      <g fill="#1B2438">
        <rect x="4" y="4" width="16" height="16" rx="1.5" />
        <rect x="7" y="7" width="10" height="10" fill="#fff" />
        <rect x="9.5" y="9.5" width="5" height="5" />
        <rect x="32" y="4" width="16" height="16" rx="1.5" />
        <rect x="35" y="7" width="10" height="10" fill="#fff" />
        <rect x="37.5" y="9.5" width="5" height="5" />
        <rect x="4" y="32" width="16" height="16" rx="1.5" />
        <rect x="7" y="35" width="10" height="10" fill="#fff" />
        <rect x="9.5" y="37.5" width="5" height="5" />
        <rect x="24" y="4" width="4" height="4" />
        <rect x="24" y="12" width="4" height="4" />
        <rect x="4" y="24" width="4" height="4" />
        <rect x="12" y="24" width="4" height="4" />
        <rect x="24" y="24" width="4" height="4" />
        <rect x="32" y="24" width="4" height="4" />
        <rect x="40" y="24" width="4" height="4" />
        <rect x="44" y="28" width="4" height="4" />
        <rect x="24" y="32" width="4" height="4" />
        <rect x="32" y="32" width="8" height="4" />
        <rect x="32" y="40" width="4" height="4" />
        <rect x="40" y="36" width="8" height="4" />
        <rect x="40" y="44" width="8" height="4" />
        <rect x="24" y="44" width="4" height="4" />
      </g>
    </svg>
  </Box>
);

const BankBadge: React.FC<{ kind: 'sber' | 'tinkoff' | 'alfa' }> = ({ kind }) => {
  if (kind === 'sber') {
    return (
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '8px',
          bgcolor: '#fff',
          border: '1px solid #E6EAF2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            bgcolor: '#21A038',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden>
            <path
              d="M1.2 4.1 L3.6 6.4 L8.8 1.2"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>
      </Box>
    );
  }
  if (kind === 'tinkoff') {
    return (
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '8px',
          bgcolor: '#FFDD2D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 900,
          color: '#1B2438',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        T
      </Box>
    );
  }
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: '8px',
        bgcolor: '#EF3124',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 900,
        color: '#fff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        lineHeight: 1,
        position: 'relative',
      }}
    >
      A
      <Box
        sx={{
          position: 'absolute',
          bottom: 5,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 8,
          height: 1.5,
          bgcolor: '#fff',
          borderRadius: 1,
        }}
      />
    </Box>
  );
};

const SchoolPaymentMethodsPanel: React.FC<Props> = ({ user, groups, variant = 'admin' }) => {
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

  const defaultMethod = methods.find((m) => m.isDefault) || methods[0] || null;

  const editDialog = (
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
  );

  const enlargeDialog = (
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
            <Button size="small" onClick={() => navigator.clipboard?.writeText(enlarge.paymentUrl || '')}>
              Копировать ссылку
            </Button>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setEnlarge(null)}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );

  if (variant === 'banner') {
    const divider = (
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          width: '1px',
          alignSelf: 'stretch',
          minHeight: 56,
          bgcolor: '#E6EAF2',
          flexShrink: 0,
          mx: 0.5,
        }}
      />
    );

    return (
      <Box
        sx={{
          mb: 2,
          px: { xs: 1.5, md: 2.25 },
          py: { xs: 1.5, md: 1.75 },
          bgcolor: '#fff',
          borderRadius: '16px',
          boxShadow: '0 6px 20px rgba(27, 36, 56, 0.06)',
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <Box
          sx={{
            display: 'flex',
            flexWrap: { xs: 'wrap', md: 'nowrap' },
            alignItems: 'center',
            gap: { xs: 1.5, md: 2 },
          }}
        >
          {/* Left: icon + text */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: '1 1 320px', minWidth: 0 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '14px',
                bgcolor: '#EAF1FE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
                <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="#2F6BFF" strokeWidth="1.7" />
                <rect x="3" y="9" width="18" height="3" fill="#2F6BFF" opacity="0.9" />
                <rect x="6" y="14.5" width="3.2" height="2.4" rx="0.5" fill="#2F6BFF" />
                <rect x="10.5" y="14.5" width="3.2" height="2.4" rx="0.5" fill="#2F6BFF" opacity="0.55" />
                <circle cx="20.5" cy="19.5" r="4.2" fill="#2F6BFF" />
                <path d="M20.5 17.6v3.8M18.6 19.5h3.8" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#1B2438', lineHeight: 1.25 }}>
                Реквизиты для оплаты
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#8B93A7', mt: 0.4, lineHeight: 1.4 }}>
                Загрузите QR-код и/или ссылку на оплату — родители увидят их в личном кабинете.
                <br />
                Настройте несколько способов оплаты для удобства клиентов.
              </Typography>
            </Box>
          </Box>

          {divider}

          {/* Center: QR + СБП + bank badges */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flex: '0 0 auto',
              flexWrap: 'wrap',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                cursor: defaultMethod?.hasQr ? 'pointer' : canEdit ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (defaultMethod?.hasQr) setEnlarge(defaultMethod);
                else if (canEdit) openCreate();
              }}
            >
              {defaultMethod?.hasQr ? (
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    overflow: 'hidden',
                    flexShrink: 0,
                    '& > *': { width: '52px !important', height: '52px !important' },
                    '& img': { width: 52, height: 52, objectFit: 'cover', display: 'block' },
                  }}
                >
                  <QrPreview methodId={defaultMethod.id} />
                </Box>
              ) : (
                <MockQrMark />
              )}
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#1B2438', lineHeight: 1.2 }}>
                  СБП
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#8B93A7', lineHeight: 1.2, mt: 0.15 }}>
                  Быстрая оплата
                </Typography>
              </Box>
            </Box>

            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ ml: 0.5 }}>
              <BankBadge kind="sber" />
              <BankBadge kind="tinkoff" />
              <BankBadge kind="alfa" />
              <Box
                sx={{
                  height: 28,
                  minWidth: 36,
                  px: 0.85,
                  borderRadius: '8px',
                  bgcolor: '#EEF1F6',
                  color: '#5A6275',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                +3
              </Box>
            </Stack>
          </Box>

          {divider}

          {/* Right: CTA */}
          <Box sx={{ ml: { md: 'auto' }, flexShrink: 0 }}>
            {canEdit && (
              <Button
                variant="outlined"
                startIcon={<Add sx={{ fontSize: 18 }} />}
                onClick={openCreate}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13.5,
                  borderRadius: '10px',
                  borderColor: '#9BB6FF',
                  color: '#2F6BFF',
                  px: 2,
                  py: 0.9,
                  whiteSpace: 'nowrap',
                  bgcolor: '#fff',
                  boxShadow: 'none',
                  '&:hover': {
                    borderColor: '#2F6BFF',
                    bgcolor: '#F5F8FF',
                    boxShadow: 'none',
                  },
                }}
              >
                Добавить
              </Button>
            )}
          </Box>
        </Box>

        {enlargeDialog}
        {editDialog}
      </Box>
    );
  }

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

      {enlargeDialog}
      {editDialog}
    </Box>
  );
};

export default SchoolPaymentMethodsPanel;
