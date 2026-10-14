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
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';

export type SaAuditTabProps = {
  auditLogs: any[];
  auditLogsLoading: boolean;
  auditLogsActionFilter: string;
  auditLogsEntityTypeFilter: string;
  onActionFilterChange: (value: string) => void;
  onEntityTypeFilterChange: (value: string) => void;
};

const SaAuditTab: React.FC<SaAuditTabProps> = ({
  auditLogs,
  auditLogsLoading,
  auditLogsActionFilter,
  auditLogsEntityTypeFilter,
  onActionFilterChange,
  onEntityTypeFilterChange,
}) => {
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Логи аудита
        </Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Действие</InputLabel>
            <Select
              value={auditLogsActionFilter}
              label="Действие"
              onChange={(e) => onActionFilterChange(e.target.value)}
            >
              <MenuItem value="all">Все</MenuItem>
              <MenuItem value="create_expense">Создание расхода</MenuItem>
              <MenuItem value="update_expense">Обновление расхода</MenuItem>
              <MenuItem value="delete_expense">Удаление расхода</MenuItem>
              <MenuItem value="pay_marketer">Выплата маркетологу</MenuItem>
              <MenuItem value="update_tenant_plan">Изменение тарифа</MenuItem>
              <MenuItem value="update_plan_price">Изменение цены тарифа</MenuItem>
              <MenuItem value="update_settings">Обновление настроек</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Тип сущности</InputLabel>
            <Select
              value={auditLogsEntityTypeFilter}
              label="Тип сущности"
              onChange={(e) => onEntityTypeFilterChange(e.target.value)}
            >
              <MenuItem value="all">Все</MenuItem>
              <MenuItem value="expense">Расход</MenuItem>
              <MenuItem value="marketer">Маркетолог</MenuItem>
              <MenuItem value="tenant">Аккаунт</MenuItem>
              <MenuItem value="plan">Тариф</MenuItem>
              <MenuItem value="settings">Настройки</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {auditLogsLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell>Действие</TableCell>
                <TableCell>Описание</TableCell>
                <TableCell>Супер-админ</TableCell>
                <TableCell>IP адрес</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.createdAt).toLocaleString('ru-RU')}</TableCell>
                  <TableCell>
                    <Chip label={log.action} size="small" color="primary" />
                  </TableCell>
                  <TableCell>{log.description}</TableCell>
                  <TableCell>
                    {log.superAdmin
                      ? `${log.superAdmin.firstName} ${log.superAdmin.lastName}`
                      : 'Система'}
                  </TableCell>
                  <TableCell>{log.ipAddress || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default SaAuditTab;
