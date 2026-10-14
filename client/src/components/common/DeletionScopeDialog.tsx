import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { colors, typography } from '../../theme/tokens';

export type DeletionImpactCounts = {
  attendance?: number;
  trainerAssignments?: number;
  salaries?: number;
  trainings?: number;
  memberships?: number;
  chats?: number;
  devNotes?: number;
  news?: number;
  planner?: number;
};

export type PurgeOptionKey =
  | 'attendance'
  | 'trainerAssignments'
  | 'salaries'
  | 'groupComposition'
  | 'chats'
  | 'devNotes'
  | 'news'
  | 'planner';

export type PurgeOption = {
  key: PurgeOptionKey;
  label: string;
  /** Ключ счётчика в impact (для groupComposition — trainings+memberships). */
  countKeys?: Array<keyof DeletionImpactCounts>;
};

export type DeletionScopeDialogProps = {
  open: boolean;
  title: string;
  entityLabel: string;
  options: PurgeOption[];
  loadImpact: () => Promise<DeletionImpactCounts>;
  onClose: () => void;
  onConfirm: (purge: Partial<Record<PurgeOptionKey, boolean>>) => Promise<void> | void;
  /** Доп. подтверждение (напр. поддомен школы). */
  confirmText?: {
    label: string;
    expected: string;
  };
  warning?: string;
};

function optionCount(opt: PurgeOption, impact: DeletionImpactCounts | null): number | null {
  if (!impact) return null;
  const keys = opt.countKeys || ([opt.key] as Array<keyof DeletionImpactCounts>);
  return keys.reduce((sum, k) => sum + (Number(impact[k]) || 0), 0);
}

/**
 * Диалог «Что именно удаляем?» — галочки связанной истории по умолчанию сняты.
 * Финансы и идеи клиентов сюда не входят.
 */
const DeletionScopeDialog: React.FC<DeletionScopeDialogProps> = ({
  open,
  title,
  entityLabel,
  options,
  loadImpact,
  onClose,
  onConfirm,
  confirmText,
  warning,
}) => {
  const [impact, setImpact] = useState<DeletionImpactCounts | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Partial<Record<PurgeOptionKey, boolean>>>({});
  const [confirmValue, setConfirmValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelected({});
    setConfirmValue('');
    setError('');
    setImpact(null);
    setLoadingImpact(true);
    loadImpact()
      .then((data) => setImpact(data || {}))
      .catch(() => setImpact({}))
      .finally(() => setLoadingImpact(false));
  }, [open, loadImpact]);

  const confirmOk = useMemo(() => {
    if (!confirmText) return true;
    return confirmValue.trim() === confirmText.expected;
  }, [confirmText, confirmValue]);

  const toggle = (key: PurgeOptionKey) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirm = async () => {
    if (!confirmOk) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm(selected);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось удалить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1.5 }}>
          Удаляем: <strong>{entityLabel}</strong>
        </Typography>
        <Typography sx={{ mb: 1, fontWeight: 600, fontSize: typography.label }}>
          Что именно удаляем?
        </Typography>
        <Typography sx={{ mb: 1.5, fontSize: typography.hint, color: colors.textMuted }}>
          По умолчанию связанная история сохраняется. Отметьте только то, что нужно стереть вместе
          с записью. Финансовая история и идеи клиентов этим диалогом не удаляются.
        </Typography>

        {warning && (
          <Typography sx={{ mb: 1.5, color: colors.danger, fontSize: typography.label }}>
            {warning}
          </Typography>
        )}

        {loadingImpact ? (
          <Stack alignItems="center" py={2}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <FormGroup sx={{ mb: 2 }}>
            {options.map((opt) => {
              const count = optionCount(opt, impact);
              const label =
                count != null ? `${opt.label}${count > 0 ? ` (${count})` : ' (0)'}` : opt.label;
              return (
                <FormControlLabel
                  key={opt.key}
                  control={
                    <Checkbox
                      checked={Boolean(selected[opt.key])}
                      onChange={() => toggle(opt.key)}
                      disabled={saving}
                    />
                  }
                  label={label}
                />
              );
            })}
          </FormGroup>
        )}

        {confirmText && (
          <TextField
            fullWidth
            label={confirmText.label}
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            disabled={saving}
            sx={{ mb: 1 }}
          />
        )}

        {error && (
          <Typography sx={{ color: colors.danger, fontSize: typography.label }}>{error}</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
          Отмена
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={saving || loadingImpact || !confirmOk}
          onClick={handleConfirm}
          sx={{ textTransform: 'none' }}
        >
          {saving ? 'Удаление…' : 'Удалить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeletionScopeDialog;
