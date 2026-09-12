import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { ClientTrainerCardData } from '../../types';
import { colors, typography } from '../../theme/tokens';

const DAY_SHORT: Record<number, string> = {
  0: 'Вс',
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
};

function formatFullName(card: ClientTrainerCardData): string {
  return [card.lastName, card.firstName, card.middleName].filter(Boolean).join(' ').trim() || 'Тренер';
}

function formatExperience(years: number | null): string {
  if (years == null || Number.isNaN(years)) return 'не указан';
  const n = Math.abs(years) % 100;
  const n1 = n % 10;
  let word = 'лет';
  if (n > 10 && n < 20) word = 'лет';
  else if (n1 === 1) word = 'год';
  else if (n1 >= 2 && n1 <= 4) word = 'года';
  return `${years} ${word}`;
}

function formatSchedule(
  schedule: Array<{ dayOfWeek: number; startTime: string; endTime: string }>
): string {
  if (!schedule.length) return 'Расписание не указано';
  const sorted = [...schedule].sort((a, b) => {
    const aDay = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
    const bDay = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
    return aDay - bDay || a.startTime.localeCompare(b.startTime);
  });
  return sorted
    .map((s) => `${DAY_SHORT[s.dayOfWeek] || s.dayOfWeek} ${s.startTime}–${s.endTime}`)
    .join(', ');
}

function formatDateRu(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

interface ClientTrainerCardDialogProps {
  open: boolean;
  trainerId: string | null;
  clientId?: string | null;
  onClose: () => void;
}

const ClientTrainerCardDialog: React.FC<ClientTrainerCardDialogProps> = ({
  open,
  trainerId,
  clientId,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<ClientTrainerCardData | null>(null);

  useEffect(() => {
    if (!open || !trainerId) {
      setCard(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    apiService
      .getClientTrainerCard(trainerId, clientId || undefined)
      .then((data) => {
        if (!cancelled) setCard(data);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setCard(null);
          setError(err?.response?.data?.error || 'Не удалось загрузить карточку тренера');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, trainerId, clientId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Карточка тренера
        <IconButton
          aria-label="Закрыть"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        )}
        {!loading && error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        {!loading && card && (
          <Stack spacing={2.5}>
            <Box>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
                {formatFullName(card)}
              </Typography>
              <Typography sx={{ mt: 0.75, fontSize: typography.label, color: colors.textMuted }}>
                Стаж работы: {formatExperience(card.experience)}
              </Typography>
              {card.qualification && (
                <Typography sx={{ mt: 0.5, fontSize: typography.hint, color: colors.textMuted }}>
                  Квалификация: {card.qualification}
                </Typography>
              )}
              {card.specialization && (
                <Typography sx={{ mt: 0.25, fontSize: typography.hint, color: colors.textMuted }}>
                  Специализация: {card.specialization}
                </Typography>
              )}
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 600, mb: 1, fontSize: typography.label }}>
                Группы
              </Typography>
              {card.groups.length === 0 ? (
                <Typography sx={{ color: colors.textEmpty, fontSize: typography.hint }}>
                  Нет активных групп
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {card.groups.map((g) => (
                    <Box
                      key={g.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: colors.primarySoft,
                      }}
                    >
                      <Typography sx={{ fontWeight: 600, fontSize: typography.label }}>
                        {g.name}
                      </Typography>
                      <Typography sx={{ mt: 0.5, fontSize: typography.hint, color: colors.textMuted }}>
                        {formatSchedule(g.schedule)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography sx={{ fontWeight: 600, mb: 1, fontSize: typography.label }}>
                Результаты учеников
              </Typography>
              {card.competitionResults.length === 0 ? (
                <Typography sx={{ color: colors.textEmpty, fontSize: typography.hint }}>
                  Пока нет результатов соревнований
                </Typography>
              ) : (
                <List dense disablePadding>
                  {card.competitionResults.map((r) => (
                    <ListItem key={r.id} alignItems="flex-start" sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Typography sx={{ fontWeight: 600, fontSize: typography.label }}>
                            {r.clientName || 'Ученик'}
                            {r.result ? ` — ${r.result}` : ''}
                          </Typography>
                        }
                        secondary={
                          <Typography component="span" sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                            {r.competitionName}
                            {' · '}
                            {formatDateRu(r.competitionDate)}
                            {r.category ? ` · ${r.category}` : ''}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClientTrainerCardDialog;
