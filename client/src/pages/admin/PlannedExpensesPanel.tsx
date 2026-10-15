import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';

type Row = {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  payeeKind: 'MARKETER' | 'OTHER';
  payeeName?: string | null;
  marketerId?: string | null;
  comment?: string | null;
  marketer?: { id: string; name: string } | null;
};

const empty = {
  title: '',
  amount: '',
  dueDate: '',
  payeeKind: 'OTHER' as 'MARKETER' | 'OTHER',
  payeeName: '',
  marketerId: '',
  comment: '',
};

const PlannedExpensesPanel: React.FC<{
  marketers: { id: string; name: string }[];
  formatCurrency: (amount: number) => string;
}> = ({ marketers, formatCurrency }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState(empty);

  const load = async () => {
    setRows(await apiService.getPlannedExpenses());
  };

  useEffect(() => {
    load();
  }, []);

  const payeeLabel = (row: Row) => {
    if (row.payeeKind === 'MARKETER') return row.marketer?.name || 'Маркетолог';
    return row.payeeName || 'Сотрудник';
  };

  const save = async () => {
    await apiService.createPlannedExpense({
      title: form.title.trim(),
      amount: Number(form.amount),
      dueDate: form.dueDate,
      payeeKind: form.payeeKind,
      payeeName: form.payeeName || null,
      marketerId: form.marketerId || null,
      comment: form.comment || null,
    });
    setForm(empty);
    await load();
  };

  return (
    <Paper sx={{ p: 2, mt: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Планируемые затраты
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
        <TextField size="small" label="Название" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <TextField size="small" label="Сумма" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <TextField
          size="small"
          label="Дата"
          type="date"
          InputLabelProps={{ shrink: true }}
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
        />
        <TextField
          size="small"
          select
          label="Кому"
          value={form.payeeKind}
          onChange={(e) => setForm({ ...form, payeeKind: e.target.value as 'MARKETER' | 'OTHER' })}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="MARKETER">Маркетолог</MenuItem>
          <MenuItem value="OTHER">Иной сотрудник</MenuItem>
        </TextField>
        {form.payeeKind === 'MARKETER' ? (
          <TextField
            size="small"
            select
            label="Маркетолог"
            value={form.marketerId}
            onChange={(e) => setForm({ ...form, marketerId: e.target.value })}
            sx={{ minWidth: 180 }}
          >
            {marketers.map((m) => (
              <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
            ))}
          </TextField>
        ) : (
          <TextField size="small" label="Кому" value={form.payeeName} onChange={(e) => setForm({ ...form, payeeName: e.target.value })} />
        )}
        <TextField size="small" label="Комментарий" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
        <Button variant="contained" onClick={save} disabled={!form.title.trim() || !form.amount || !form.dueDate}>
          Добавить
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Название</TableCell>
            <TableCell>Сумма</TableCell>
            <TableCell>Дата</TableCell>
            <TableCell>Кому</TableCell>
            <TableCell>Комментарий</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.title}</TableCell>
              <TableCell>{formatCurrency(row.amount)}</TableCell>
              <TableCell>{new Date(row.dueDate).toLocaleDateString('ru-RU')}</TableCell>
              <TableCell>{payeeLabel(row)}</TableCell>
              <TableCell>{row.comment || '—'}</TableCell>
              <TableCell>
                <Button size="small" color="error" onClick={async () => { await apiService.deletePlannedExpense(row.id); await load(); }}>
                  Удалить
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={6}>Плановых затрат нет</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Box />
    </Paper>
  );
};

export default PlannedExpensesPanel;
