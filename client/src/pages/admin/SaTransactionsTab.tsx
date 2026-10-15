import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Add, Payment, Edit, Delete, GetApp } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import PlannedExpensesPanel from './PlannedExpensesPanel';

export type SaTransactionsTabProps = {
  transactions: any[];
  transactionsLoading: boolean;
  transactionTypeFilter: string;
  onTransactionTypeFilterChange: (value: string) => void;
  selectedCategoryId: string;
  onSelectedCategoryIdChange: (value: string) => void;
  expenseCategories: any[];
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (value: Date | null) => void;
  onEndDateChange: (value: Date | null) => void;
  onClearDates: () => void;
  marketersCount: number;
  marketers: { id: string; name: string }[];
  formatCurrency: (amount: number) => string;
  formatDateTime: (dateString: string) => string;
  onOpenExpenseDialog: () => void;
  onOpenPaymentDialog: () => void;
  onEditExpense: (transaction: any) => void;
  onDeleteExpense: (id: string) => void;
  onExportTransactions: () => void;
};

const SaTransactionsTab: React.FC<SaTransactionsTabProps> = ({
  transactions,
  transactionsLoading,
  transactionTypeFilter,
  onTransactionTypeFilterChange,
  selectedCategoryId,
  onSelectedCategoryIdChange,
  expenseCategories,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClearDates,
  marketersCount,
  marketers,
  formatCurrency,
  formatDateTime,
  onOpenExpenseDialog,
  onOpenPaymentDialog,
  onEditExpense,
  onDeleteExpense,
  onExportTransactions,
}) => {
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Финансы
        </Typography>
        <Box display="flex" gap={2}>
          <Button variant="outlined" startIcon={<Add />} onClick={onOpenExpenseDialog}>
            Создать расход
          </Button>
          <Button
            variant="contained"
            startIcon={<Payment />}
            onClick={onOpenPaymentDialog}
            disabled={!marketersCount}
          >
            Выплатить маркетологу
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Тип транзакции</InputLabel>
            <Select
              value={transactionTypeFilter}
              label="Тип транзакции"
              onChange={(e) => onTransactionTypeFilterChange(e.target.value)}
            >
              <MenuItem value="all">Все</MenuItem>
              <MenuItem value="income">Поступления</MenuItem>
              <MenuItem value="expense">Расходы</MenuItem>
              <MenuItem value="marketer_payment">Выплаты маркетологам</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Категория</InputLabel>
            <Select
              value={selectedCategoryId}
              label="Категория"
              onChange={(e) => onSelectedCategoryIdChange(e.target.value)}
            >
              <MenuItem value="all">Все категории</MenuItem>
              {expenseCategories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
            <DatePicker
              label="С"
              value={startDate}
              onChange={(newValue) => onStartDateChange(newValue)}
              slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
            />
            <DatePicker
              label="По"
              value={endDate}
              onChange={(newValue) => onEndDateChange(newValue)}
              slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
            />
          </LocalizationProvider>

          {(startDate || endDate) && (
            <Button size="small" onClick={onClearDates}>
              Сбросить даты
            </Button>
          )}
        </Box>
      </Paper>

      {transactionsLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Дата</TableCell>
                  <TableCell>Тип</TableCell>
                  <TableCell>Описание</TableCell>
                  <TableCell>Категория</TableCell>
                  <TableCell>Маркетолог</TableCell>
                  <TableCell align="right">Сумма</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" sx={{ py: 2.5 }}>
                        Нет транзакций
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction: any) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={
                            transaction.type === 'income'
                              ? transaction.source === 'subscription'
                                ? 'Платеж за подписку'
                                : 'Поступление'
                              : transaction.type === 'expense'
                                ? 'Расход'
                                : 'Выплата маркетологу'
                          }
                          color={
                            transaction.type === 'income'
                              ? 'success'
                              : transaction.type === 'expense'
                                ? 'error'
                                : 'warning'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {transaction.description}
                        {transaction.promoCode && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Промокод: {transaction.promoCode}
                          </Typography>
                        )}
                        {transaction.tenant && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Аккаунт: {transaction.tenant.name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {transaction.category ? (
                          <Chip
                            label={transaction.category.name}
                            size="small"
                            sx={{
                              backgroundColor: transaction.category.color || '#2196F3',
                              color: 'white',
                            }}
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {transaction.marketer
                          ? `${transaction.marketer.name} (${transaction.marketer.email})`
                          : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {transaction.type === 'income' ? (
                          transaction.hasDiscount || transaction.discountAmount > 0 ? (
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{ textDecoration: 'line-through', color: 'text.secondary' }}
                              >
                                {formatCurrency(transaction.originalAmount || transaction.amount)}
                              </Typography>
                              <Typography variant="body1" color="success.main">
                                +{formatCurrency(transaction.amount)}
                              </Typography>
                              {transaction.discountAmount > 0 && (
                                <Typography variant="caption" color="text.secondary">
                                  Скидка: {formatCurrency(transaction.discountAmount)}
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            `+${formatCurrency(transaction.amount)}`
                          )
                        ) : (
                          `-${formatCurrency(transaction.amount)}`
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {transaction.type === 'expense' && (
                          <Box display="flex" gap={1} justifyContent="flex-end">
                            <Tooltip title="Редактировать">
                              <IconButton size="small" onClick={() => onEditExpense(transaction)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Удалить">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => onDeleteExpense(transaction.id)}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box display="flex" justifyContent="flex-end" p={2}>
            <Button variant="outlined" startIcon={<GetApp />} onClick={onExportTransactions}>
              Экспорт в Excel
            </Button>
          </Box>
        </Paper>
      )}
      <PlannedExpensesPanel marketers={marketers} formatCurrency={formatCurrency} />
    </Box>
  );
};

export default SaTransactionsTab;
