import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(
    n || 0
  );

const MarketerFinance: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setData(await apiService.getMarketerFinance());
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Ошибка загрузки финансов');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Финансы
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary">Баланс</Typography>
              <Typography variant="h6">{money(data.balance)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary">Начислено</Typography>
              <Typography variant="h6">{money(data.accrued)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary">Выплачено</Typography>
              <Typography variant="h6">{money(data.paidOut)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Typography sx={{ mb: 1 }} color="text.secondary">
        Комиссия: {data.commissionPercentage}% · начисления за активных клиентов
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Дата</TableCell>
            <TableCell>Тип</TableCell>
            <TableCell>Клиент</TableCell>
            <TableCell align="right">Сумма</TableCell>
            <TableCell>Комментарий</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(data.items || []).map((i: any) => (
            <TableRow key={i.id}>
              <TableCell>{new Date(i.occurredAt).toLocaleString('ru-RU')}</TableCell>
              <TableCell>{i.kind === 'ACCRUAL' ? 'Начисление' : 'Выплата'}</TableCell>
              <TableCell>{i.schoolLabel || '—'}</TableCell>
              <TableCell align="right">{money(i.amount)}</TableCell>
              <TableCell>{i.notes || '—'}</TableCell>
            </TableRow>
          ))}
          {(data.items || []).length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                <Typography color="text.secondary">Записей пока нет</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
};

export default MarketerFinance;
