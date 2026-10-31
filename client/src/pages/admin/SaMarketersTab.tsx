import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Button,
  CircularProgress,
} from '@mui/material';
import { GetApp } from '@mui/icons-material';
import PlatformMarketersCrud from '../../components/admin/PlatformMarketersCrud';
import MarketerPayoutQueue from '../../components/admin/MarketerPayoutQueue';

export type SaMarketersTabProps = {
  marketerStats: any;
  marketerStatsLoading: boolean;
  formatCurrency: (amount: number) => string;
  onExportMarketers: () => void;
};

const SaMarketersTab: React.FC<SaMarketersTabProps> = ({
  marketerStats,
  marketerStatsLoading,
  formatCurrency,
  onExportMarketers,
}) => {
  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        Платформенное управление
      </Typography>
      <MarketerPayoutQueue />
      <Paper sx={{ p: 2, mb: 4 }}>
        <PlatformMarketersCrud mode="sa" />
      </Paper>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Статистика маркетологов
        </Typography>
        <Button variant="outlined" startIcon={<GetApp />} onClick={onExportMarketers}>
          Экспорт в Excel
        </Button>
      </Box>

      {marketerStatsLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : marketerStats ? (
        <>
          {marketerStats.summary && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Всего маркетологов
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {marketerStats.summary.totalMarketers}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Привлечено аккаунтов
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="success.main">
                      {marketerStats.summary.totalReferredTenants}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Общий доход
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                      {formatCurrency(marketerStats.summary.totalRevenue)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Невыплачено
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="warning.main">
                      {formatCurrency(marketerStats.summary.totalUnpaid)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Имя</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Процент</TableCell>
                  <TableCell>Баланс</TableCell>
                  <TableCell>Привлечено</TableCell>
                  <TableCell>Общий доход</TableCell>
                  <TableCell>Комиссия</TableCell>
                  <TableCell>Средний доход/аккаунт</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {marketerStats.marketers?.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>{m.commissionPercentage}%</TableCell>
                    <TableCell>{formatCurrency(m.balance)}</TableCell>
                    <TableCell>{m.stats.referredTenantsCount}</TableCell>
                    <TableCell>{formatCurrency(m.stats.totalRevenue)}</TableCell>
                    <TableCell>{formatCurrency(m.stats.totalCommission)}</TableCell>
                    <TableCell>{formatCurrency(m.stats.avgRevenuePerTenant)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : (
        <Alert severity="info">Загрузка статистики маркетологов...</Alert>
      )}
    </Box>
  );
};

export default SaMarketersTab;
