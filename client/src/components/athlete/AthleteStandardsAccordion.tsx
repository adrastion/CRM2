import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  ExpandMore,
  TrendingDown,
  TrendingFlat,
  TrendingUp,
  ShowChart,
  DeleteOutline,
} from '@mui/icons-material';
import { ClientStandard } from '../../types';
import { apiService } from '../../services/api';
import { colors, typography } from '../../theme/tokens';
import StandardChart from '../StandardChart';
import { AthleteCardMode } from './athleteCardTypes';
import { buildStandardsRows } from './athleteCardUtils';

interface Props {
  standards: ClientStandard[];
  mode: AthleteCardMode;
  clientId?: string;
  groupIds?: string[];
  addRequestToken?: number;
  onChanged?: () => void;
  onSnack?: (message: string) => void;
}

const Dynamics: React.FC<{ value: 'up' | 'down' | 'same' | 'none' }> = ({ value }) => {
  if (value === 'up')
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: '#2e7d32' }}>
        <TrendingUp fontSize="small" /> улучшение
      </Box>
    );
  if (value === 'down')
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: '#c62828' }}>
        <TrendingDown fontSize="small" /> ухудшение
      </Box>
    );
  if (value === 'same')
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: colors.textMuted }}>
        <TrendingFlat fontSize="small" /> без изменений
      </Box>
    );
  return <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>—</Typography>;
};

async function resolveStandardId(params: {
  name: string;
  unit?: string;
  targetValue?: number;
  groupIds?: string[];
}): Promise<string> {
  const name = params.name.trim();
  const existing = await apiService.getStandards({ search: name, isActive: 'true' });
  const match = (existing.data || []).find(
    (s: any) => String(s.name || '').trim().toLowerCase() === name.toLowerCase()
  );
  if (match?.id) return match.id;

  const created = await apiService.createStandard({
    name,
    unit: params.unit || undefined,
    targetValue: params.targetValue,
    isActive: true,
    groupIds: params.groupIds?.length ? params.groupIds : undefined,
  });
  return created.id;
}

const AthleteStandardsAccordion: React.FC<Props> = ({
  standards,
  mode,
  clientId,
  groupIds = [],
  addRequestToken = 0,
  onChanged,
  onSnack,
}) => {
  const rows = buildStandardsRows(standards);
  const [expanded, setExpanded] = React.useState(false);
  const [history, setHistory] = React.useState<ClientStandard[] | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState('');
  const [unit, setUnit] = React.useState('');
  const [targetValue, setTargetValue] = React.useState('');
  const [completedAt, setCompletedAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = React.useState('');
  const [resultText, setResultText] = React.useState('');
  const [status, setStatus] = React.useState<'completed' | 'failed' | 'pending'>('completed');
  const [notes, setNotes] = React.useState('');

  const canManage = mode === 'staff' && Boolean(clientId);

  const openAddDialog = React.useCallback(() => {
    if (!canManage) return;
    setExpanded(true);
    setAddOpen(true);
  }, [canManage]);

  React.useEffect(() => {
    if (addRequestToken > 0 && canManage) openAddDialog();
  }, [addRequestToken, canManage, openAddDialog]);

  const resetForm = () => {
    setName('');
    setUnit('');
    setTargetValue('');
    setCompletedAt(new Date().toISOString().slice(0, 10));
    setResult('');
    setResultText('');
    setStatus('completed');
    setNotes('');
  };

  const handleSave = async () => {
    if (!clientId) return;
    if (!name.trim()) {
      onSnack?.('Укажите название норматива');
      return;
    }
    setSaving(true);
    try {
      const standardId = await resolveStandardId({
        name: name.trim(),
        unit: unit.trim() || undefined,
        targetValue: targetValue !== '' ? Number(targetValue) : undefined,
        groupIds,
      });
      await apiService.addClientStandard(clientId, {
        standardId,
        completedAt,
        result: result !== '' ? Number(result) : undefined,
        resultText: resultText || undefined,
        status,
        notes: notes || undefined,
      });
      setAddOpen(false);
      resetForm();
      onSnack?.('Норматив добавлен');
      onChanged?.();
    } catch (e: any) {
      onSnack?.(e?.response?.data?.error || 'Не удалось добавить норматив');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (clientStandardId: string) => {
    if (!clientId || !canManage) return;
    if (!window.confirm('Удалить эту запись о нормативе?')) return;
    try {
      await apiService.deleteClientStandard(clientId, clientStandardId);
      onSnack?.('Запись удалена');
      onChanged?.();
    } catch (e: any) {
      onSnack?.(e?.response?.data?.error || 'Не удалось удалить');
    }
  };

  return (
    <>
      <Accordion
        expanded={expanded}
        onChange={(_, v) => setExpanded(v)}
        disableGutters
        sx={{
          bgcolor: colors.card,
          border: `1px solid ${colors.divider}`,
          borderRadius: '8px !important',
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: typography.panelTitle }}>
              Нормативы{rows.length ? ` (${rows.length})` : ''}
            </Typography>
            {canManage && (
              <Button
                size="small"
                startIcon={<Add />}
                onClick={(e) => {
                  e.stopPropagation();
                  openAddDialog();
                }}
                sx={{ textTransform: 'none' }}
              >
                Добавить
              </Button>
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          {rows.length === 0 ? (
            <Typography sx={{ fontSize: typography.label, color: colors.textEmpty, py: 2 }}>
              Нормативы ещё не зафиксированы
              {canManage ? ' — нажмите «Добавить» и укажите название норматива' : ''}
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Наименование</TableCell>
                    <TableCell>Норма</TableCell>
                    <TableCell>Факт</TableCell>
                    <TableCell>Предыдущий</TableCell>
                    <TableCell>Дата</TableCell>
                    <TableCell>Динамика</TableCell>
                    <TableCell width={80} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.standardId} hover>
                      <TableCell sx={{ cursor: 'pointer' }} onClick={() => setHistory(row.history)}>
                        {row.name}
                      </TableCell>
                      <TableCell>{row.target}</TableCell>
                      <TableCell>{row.current}</TableCell>
                      <TableCell>{row.previous}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>
                        <Dynamics value={row.dynamics} />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" aria-label="История" onClick={() => setHistory(row.history)}>
                          <ShowChart fontSize="small" />
                        </IconButton>
                        {canManage && row.history[0]?.id && (
                          <IconButton
                            size="small"
                            color="error"
                            aria-label="Удалить последнюю запись"
                            onClick={() => handleDelete(row.history[0].id)}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      <Dialog open={Boolean(history)} onClose={() => setHistory(null)} maxWidth="sm" fullWidth>
        <DialogTitle>История норматива</DialogTitle>
        <DialogContent>
          {history && history[0]?.standard && (
            <StandardChart
              standardId={history[0].standard.id}
              standardName={history[0].standard.name}
              unit={history[0].standard.unit}
              targetValue={
                history[0].standard.targetValue != null
                  ? Number(history[0].standard.targetValue)
                  : undefined
              }
              clientStandards={history}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={addOpen}
        onClose={() => {
          if (!saving) {
            setAddOpen(false);
            resetForm();
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Добавить норматив</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                required
                label="Название норматива"
                placeholder="Например: Подтягивания"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Норма (цель)"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                helperText="Целевое значение"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Единица"
                placeholder="раз, сек, кг…"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Дата выполнения"
                value={completedAt}
                onChange={(e) => setCompletedAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Фактический результат (число)"
                value={result}
                onChange={(e) => setResult(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Результат (текст)"
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Статус</InputLabel>
                <Select
                  value={status}
                  label="Статус"
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  <MenuItem value="completed">Выполнен</MenuItem>
                  <MenuItem value="failed">Не выполнен</MenuItem>
                  <MenuItem value="pending">В процессе</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Примечания"
                multiline
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => { setAddOpen(false); resetForm(); }}>
            Отмена
          </Button>
          <Button variant="contained" disabled={saving || !name.trim()} onClick={handleSave}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AthleteStandardsAccordion;
