import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit, Search } from '@mui/icons-material';
import { apiService } from '../../services/api';

export type MarketerRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  type: string;
  isActive: boolean;
  balance: number | string;
  commissionPercentage: number | string;
  _count?: { promoCodes?: number; referralLinks?: number; referredTenants?: number };
};

type StatsById = Record<
  string,
  {
    referredTenantsCount: number;
    totalRevenue: number;
    totalCommission: number;
  }
>;

type Props = {
  formatCurrency: (n: number) => string;
  statsById?: StatsById;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onEdit: (row: MarketerRow) => void;
  refreshKey?: number;
};

const SaMarketersList: React.FC<Props> = ({
  formatCurrency,
  statsById = {},
  onOpen,
  onCreate,
  onEdit,
  refreshKey = 0,
}) => {
  const [rows, setRows] = useState<MarketerRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.getPlatformMarketers({
        search: search.trim() || undefined,
        limit: 100,
      });
      setRows(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось загрузить маркетологов');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  const sorted = useMemo(() => rows, [rows]);

  const remove = async (row: MarketerRow) => {
    if (!window.confirm(`Удалить маркетолога «${row.name}»?`)) return;
    try {
      await apiService.deletePlatformMarketer(row.id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось удалить');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} mb={1.5} flexWrap="wrap">
        <Typography variant="h6" fontWeight={700}>
          Маркетологи
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Поиск по имени или email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 240 }}
          />
          <Button variant="contained" startIcon={<Add />} onClick={onCreate} sx={{ textTransform: 'none' }}>
            Добавить
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Имя</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell align="right">%</TableCell>
                <TableCell align="right">Баланс</TableCell>
                <TableCell align="right">Школы</TableCell>
                <TableCell>Промо</TableCell>
                <TableCell align="right">Доход</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      Маркетологи не найдены
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((m) => {
                  const st = statsById[m.id];
                  const schools = st?.referredTenantsCount ?? m._count?.referredTenants ?? 0;
                  const hasPromo = (m._count?.promoCodes || 0) > 0;
                  return (
                    <TableRow
                      key={m.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => onOpen(m.id)}
                    >
                      <TableCell>
                        <Typography fontWeight={600}>{m.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {m.type === 'MEDIA_PARTNER' ? 'Медиа' : 'Маркетолог'}
                        </Typography>
                      </TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={m.isActive ? 'Активен' : 'Выкл'}
                          color={m.isActive ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">{Number(m.commissionPercentage)}%</TableCell>
                      <TableCell align="right">{formatCurrency(Number(m.balance || 0))}</TableCell>
                      <TableCell align="right">{schools}</TableCell>
                      <TableCell>
                        {hasPromo ? (
                          <Chip size="small" label="Есть" color="success" variant="outlined" />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {st ? formatCurrency(st.totalRevenue) : '—'}
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          size="small"
                          onClick={() => onEdit(m)}
                          aria-label="Редактировать"
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => void remove(m)}
                          aria-label="Удалить"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default SaMarketersList;
