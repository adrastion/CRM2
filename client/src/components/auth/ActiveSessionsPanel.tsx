import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Devices, QrCodeScanner } from '@mui/icons-material';
import { Html5Qrcode } from 'html5-qrcode';
import { apiService } from '../../services/api';

export type AuthSessionRow = {
  id: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

function formatSessionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}

/** Достаёт challenge+secret из deep-link QR (или полного URL). */
export function parseDeviceApproveQr(raw: string): { challengeToken: string; secret: string } | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const url = new URL(text, typeof window !== 'undefined' ? window.location.origin : 'https://local');
    const challenge = url.searchParams.get('challenge');
    const secret = url.searchParams.get('secret');
    if (challenge && secret) return { challengeToken: challenge, secret };
  } catch {
    /* fall through */
  }
  // На случай payload без схемы
  const challengeMatch = text.match(/[?&]challenge=([^&]+)/);
  const secretMatch = text.match(/[?&]secret=([^&]+)/);
  if (challengeMatch && secretMatch) {
    try {
      return {
        challengeToken: decodeURIComponent(challengeMatch[1]),
        secret: decodeURIComponent(secretMatch[1]),
      };
    } catch {
      return null;
    }
  }
  return null;
}

type Props = {
  /** После «Выйти везде» — разлогинить текущее устройство */
  onLogoutEverywhere?: () => void;
  paper?: boolean;
};

/**
 * Список активных сессий + сканер QR для подтверждения входа на другом устройстве.
 */
const ActiveSessionsPanel: React.FC<Props> = ({ onLogoutEverywhere, paper = true }) => {
  const [sessions, setSessions] = useState<AuthSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [scanOpen, setScanOpen] = useState(false);
  const [pendingApprove, setPendingApprove] = useState<{
    challengeToken: string;
    secret: string;
  } | null>(null);
  const [scanError, setScanError] = useState('');
  const [approving, setApproving] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const readerId = 'login-qr-reader';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiService.getAuthSessions();
      setSessions(data.sessions || []);
    } catch (e: any) {
      // Сканер QR всё равно доступен — список сессий не обязателен
      setSessions([]);
      const msg = e?.response?.data?.error;
      if (msg && e?.response?.status !== 401) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
    } catch {
      /* ignore */
    }
    try {
      await s.clear();
    } catch {
      /* ignore */
    }
  }, []);

  const closeScan = useCallback(async () => {
    await stopScanner();
    setScanOpen(false);
    setScanError('');
    handledRef.current = false;
  }, [stopScanner]);

  useEffect(() => {
    if (!scanOpen || pendingApprove) return;
    handledRef.current = false;
    let cancelled = false;

    const start = async () => {
      setScanError('');
      try {
        const scanner = new Html5Qrcode(readerId);
        if (cancelled) return;
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          async (decoded) => {
            if (handledRef.current) return;
            const parsed = parseDeviceApproveQr(decoded);
            if (!parsed) {
              setScanError('Это не QR для входа в ПрофСпортСРМ');
              return;
            }
            handledRef.current = true;
            await stopScanner();
            setPendingApprove(parsed);
          },
          () => {
            /* continuous scan noise */
          }
        );
      } catch (e: any) {
        if (!cancelled) {
          setScanError(
            e?.message ||
              'Не удалось открыть камеру. Разрешите доступ к камере или выберите фото QR ниже.'
          );
        }
      }
    };

    const t = window.setTimeout(() => void start(), 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      void stopScanner();
    };
  }, [scanOpen, pendingApprove, stopScanner]);

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    setScanError('');
    try {
      await stopScanner();
      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;
      const decoded = await scanner.scanFile(file, true);
      const parsed = parseDeviceApproveQr(decoded);
      if (!parsed) {
        setScanError('Это не QR для входа в ПрофСпортСРМ');
        await stopScanner();
        return;
      }
      await stopScanner();
      setPendingApprove(parsed);
    } catch {
      setScanError('Не удалось распознать QR на фото');
      await stopScanner();
    }
  };

  const approve = async () => {
    if (!pendingApprove) return;
    setApproving(true);
    setScanError('');
    try {
      await apiService.approveQrLogin(pendingApprove);
      setNotice('Вход на другом устройстве разрешён');
      setPendingApprove(null);
      await closeScan();
    } catch (e: any) {
      setScanError(e?.response?.data?.error || 'Не удалось подтвердить вход');
    } finally {
      setApproving(false);
    }
  };

  const deny = async () => {
    if (!pendingApprove) return;
    setApproving(true);
    setScanError('');
    try {
      await apiService.denyQrLogin(pendingApprove);
      setNotice('Вход отклонён');
      setPendingApprove(null);
      await closeScan();
    } catch (e: any) {
      setScanError(e?.response?.data?.error || 'Не удалось отклонить');
    } finally {
      setApproving(false);
    }
  };

  const revokeOne = async (id: string) => {
    try {
      setBusy(true);
      setError('');
      await apiService.revokeAuthSession(id);
      await load();
      setNotice('Сессия завершена');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось завершить сессию');
    } finally {
      setBusy(false);
    }
  };

  const revokeOthers = async () => {
    try {
      setBusy(true);
      setError('');
      await apiService.revokeOtherAuthSessions();
      await load();
      setNotice('Другие сессии завершены');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось завершить другие сессии');
    } finally {
      setBusy(false);
    }
  };

  const revokeAll = async () => {
    try {
      setBusy(true);
      setError('');
      await apiService.revokeAllAuthSessions();
      onLogoutEverywhere?.();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось выйти на всех устройствах');
      setBusy(false);
    }
  };

  const body = (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Devices sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle1" fontWeight="medium" sx={{ flex: 1 }}>
          Активные сессии
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<QrCodeScanner />}
          onClick={() => {
            setPendingApprove(null);
            setScanError('');
            setScanOpen(true);
          }}
          sx={{ textTransform: 'none' }}
        >
          Сканировать QR входа
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Устройства, с которых выполнен вход. Чтобы войти на компьютере — отсканируйте QR с экрана
        входа на этом телефоне.
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>
          {notice}
        </Alert>
      ) : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : sessions.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Нет активных сессий
        </Typography>
      ) : (
        <Stack spacing={1.5} divider={<Divider flexItem />}>
          {sessions.map((session) => (
            <Box
              key={session.id}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { sm: 'center' },
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body1" fontWeight={500}>
                    {session.deviceLabel || 'Неизвестное устройство'}
                  </Typography>
                  {session.current && (
                    <Chip label="Это устройство" size="small" color="primary" variant="outlined" />
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  IP: {session.ipAddress || '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Создана: {formatSessionDate(session.createdAt)} · Активность:{' '}
                  {formatSessionDate(session.lastSeenAt)}
                </Typography>
              </Box>
              {!session.current && (
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  disabled={busy}
                  onClick={() => void revokeOne(session.id)}
                  sx={{ textTransform: 'none', alignSelf: { xs: 'stretch', sm: 'center' } }}
                >
                  Завершить
                </Button>
              )}
            </Box>
          ))}
        </Stack>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
        <Button
          variant="outlined"
          disabled={busy || sessions.filter((s) => !s.current).length === 0}
          onClick={() => void revokeOthers()}
          sx={{ textTransform: 'none' }}
        >
          Завершить все другие сессии
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={busy}
          onClick={() => void revokeAll()}
          sx={{ textTransform: 'none' }}
        >
          Выйти везде
        </Button>
      </Stack>

      <Dialog open={scanOpen} onClose={() => void closeScan()} fullWidth maxWidth="xs">
        <DialogTitle>
          {pendingApprove ? 'Подтверждение входа' : 'Сканер QR входа'}
        </DialogTitle>
        <DialogContent>
          {pendingApprove ? (
            <Typography variant="body2" color="text.secondary">
              Разрешить вход на другом устройстве под этим аккаунтом?
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Наведите камеру на QR с экрана входа на компьютере
              </Typography>
              <Box
                id={readerId}
                sx={{
                  width: '100%',
                  minHeight: 220,
                  '& video': { borderRadius: 1, maxWidth: '100%' },
                }}
              />
              <Button
                component="label"
                variant="outlined"
                fullWidth
                sx={{ mt: 2, textTransform: 'none' }}
              >
                Выбрать фото QR
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  capture="environment"
                  onChange={(e) => void onPickImage(e.target.files?.[0] || null)}
                />
              </Button>
            </>
          )}
          {scanError ? (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setScanError('')}>
              {scanError}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {pendingApprove ? (
            <>
              <Button onClick={() => void deny()} disabled={approving} sx={{ textTransform: 'none' }}>
                Отклонить
              </Button>
              <Button
                variant="contained"
                onClick={() => void approve()}
                disabled={approving}
                sx={{ textTransform: 'none' }}
              >
                {approving ? '…' : 'Разрешить'}
              </Button>
            </>
          ) : (
            <Button onClick={() => void closeScan()} sx={{ textTransform: 'none' }}>
              Закрыть
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );

  if (!paper) return body;
  return <Paper sx={{ p: { xs: 2, sm: 3 } }}>{body}</Paper>;
};

export default ActiveSessionsPanel;
