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
} from '@mui/material';
import {
  Settings,
  GetApp,
  Delete,
  AdminPanelSettings,
  LinkOff,
  BugReport,
} from '@mui/icons-material';

export type SaAccountsTabProps = {
  allTenants: any[];
  tenantsLoading: boolean;
  selectedTenants: string[];
  onSelectedTenantsChange: (ids: string[]) => void;
  submitting: boolean;
  deletingTenant: boolean;
  canWrite: boolean;
  onExportTenants: () => void;
  onBulkAction: (action: 'activate' | 'deactivate') => void;
  onOpenGrantDialog: (tenant: any) => void;
  onLinkTenantSuperAdmin: (tenantId: string) => void;
  onUnlinkTenantSuperAdmin: (tenantId: string) => void;
  onLinkTenantTester: (tenantId: string) => void;
  onUnlinkTenantTester: (tenantId: string) => void;
  onOpenDeleteTenantDialog: (tenant: any) => void;
};

const SaAccountsTab: React.FC<SaAccountsTabProps> = ({
  allTenants,
  tenantsLoading,
  selectedTenants,
  onSelectedTenantsChange,
  submitting,
  deletingTenant,
  canWrite,
  onExportTenants,
  onBulkAction,
  onOpenGrantDialog,
  onLinkTenantSuperAdmin,
  onUnlinkTenantSuperAdmin,
  onLinkTenantTester,
  onUnlinkTenantTester,
  onOpenDeleteTenantDialog,
}) => {
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Все аккаунты
        </Typography>
        <Box display="flex" gap={2}>
          <Button variant="outlined" startIcon={<GetApp />} onClick={onExportTenants}>
            Экспорт в Excel
          </Button>
          {selectedTenants.length > 0 && (
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => onBulkAction('activate')}
                disabled={submitting}
              >
                Активировать ({selectedTenants.length})
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={() => onBulkAction('deactivate')}
                disabled={submitting}
              >
                Деактивировать ({selectedTenants.length})
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {tenantsLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <input
                      type="checkbox"
                      checked={selectedTenants.length === allTenants.length && allTenants.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onSelectedTenantsChange(allTenants.map((t) => t.id));
                        } else {
                          onSelectedTenantsChange([]);
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Поддомен</TableCell>
                  <TableCell>Тариф</TableCell>
                  <TableCell align="right">Админов</TableCell>
                  <TableCell align="right">Клиентов</TableCell>
                  <TableCell align="right">Тренеров</TableCell>
                  <TableCell align="right">Филиалов</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center">
                      <Typography color="text.secondary" sx={{ py: 2.5 }}>
                        Нет аккаунтов
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  allTenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell padding="checkbox">
                        <input
                          type="checkbox"
                          checked={selectedTenants.includes(tenant.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              onSelectedTenantsChange([...selectedTenants, tenant.id]);
                            } else {
                              onSelectedTenantsChange(selectedTenants.filter((id) => id !== tenant.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>{tenant.name}</TableCell>
                      <TableCell>{tenant.email}</TableCell>
                      <TableCell>{tenant.subdomain}</TableCell>
                      <TableCell>
                        {tenant.subscription ? (
                          <Box display="flex" flexWrap="wrap" gap={0.5} alignItems="center">
                            <Chip label={tenant.subscription.planType} size="small" />
                            {tenant.subscription.isGranted && (
                              <Chip label="Выдан" color="info" size="small" variant="outlined" />
                            )}
                            {tenant.subscription.nextPlanType && (
                              <Chip
                                label={`Далее: ${tenant.subscription.nextPlanType}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {tenant.subscription.endDate && (
                              <Chip
                                label={`до ${new Date(tenant.subscription.endDate).toLocaleDateString('ru-RU')}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="right">{tenant.stats.admins}</TableCell>
                      <TableCell align="right">{tenant.stats.clients}</TableCell>
                      <TableCell align="right">{tenant.stats.trainers}</TableCell>
                      <TableCell align="right">{tenant.stats.branches}</TableCell>
                      <TableCell>
                        <Chip
                          label={tenant.isActive ? 'Активен' : 'Неактивен'}
                          color={tenant.isActive ? 'success' : 'default'}
                          size="small"
                        />
                        {tenant.isSuperAdminLinked && (
                          <Chip label="Супер-админ" color="secondary" size="small" sx={{ ml: 0.5 }} />
                        )}
                        {tenant.isTesterLinked && (
                          <Chip label="Тестировщик" color="info" size="small" sx={{ ml: 0.5 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => onOpenGrantDialog(tenant)}
                          title="Изменить тариф"
                        >
                          <Settings />
                        </IconButton>
                        {tenant.ownerId && !tenant.isSuperAdminLinked && (
                          <IconButton
                            size="small"
                            color="secondary"
                            disabled={submitting}
                            onClick={() => onLinkTenantSuperAdmin(tenant.id)}
                            title="Сделать супер-админом (OWNER)"
                          >
                            <AdminPanelSettings />
                          </IconButton>
                        )}
                        {tenant.isSuperAdminLinked && (
                          <IconButton
                            size="small"
                            color="warning"
                            disabled={submitting}
                            onClick={() => onUnlinkTenantSuperAdmin(tenant.id)}
                            title="Отвязать супер-админа"
                          >
                            <LinkOff />
                          </IconButton>
                        )}
                        {tenant.ownerId && !tenant.isTesterLinked && (
                          <IconButton
                            size="small"
                            color="info"
                            disabled={submitting}
                            onClick={() => onLinkTenantTester(tenant.id)}
                            title="Сделать тестировщиком (OWNER)"
                          >
                            <BugReport />
                          </IconButton>
                        )}
                        {tenant.isTesterLinked && (
                          <IconButton
                            size="small"
                            color="warning"
                            disabled={submitting}
                            onClick={() => onUnlinkTenantTester(tenant.id)}
                            title="Отвязать тестировщика"
                          >
                            <LinkOff />
                          </IconButton>
                        )}
                        {canWrite && (
                          <IconButton
                            size="small"
                            color="error"
                            disabled={submitting || deletingTenant}
                            onClick={() => onOpenDeleteTenantDialog(tenant)}
                            title="Удалить школу навсегда"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default SaAccountsTab;
