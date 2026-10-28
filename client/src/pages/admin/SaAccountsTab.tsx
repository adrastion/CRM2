import React from 'react';
import {
  Alert,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Settings,
  GetApp,
  Delete,
  AdminPanelSettings,
  LinkOff,
  BugReport,
  UploadFile,
} from '@mui/icons-material';
import { apiService } from '../../services/api';

type ImportResult = {
  tenantName: string;
  created: Record<string, number>;
  errors: Array<{ sheet: string; row: number; message: string }>;
  staffPasswords: Array<{ email: string; password: string; role: string }>;
  success: boolean;
  errorMessage?: string;
};

const CREATED_LABELS: Record<string, string> = {
  branches: 'Филиалы',
  halls: 'Залы',
  staff: 'Сотрудники',
  trainers: 'Тренеры',
  groups: 'Группы',
  memberships: 'Абонементы',
  membershipGroups: 'Абонементы↔группы',
  clients: 'Ученики',
  groupMemberships: 'Ученики↔группы',
  clientMemberships: 'Ученики↔абонементы',
};

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
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importTenant, setImportTenant] = React.useState<any | null>(null);
  const [importBusy, setImportBusy] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [templateBusy, setTemplateBusy] = React.useState(false);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = async () => {
    setTemplateBusy(true);
    try {
      const blob = await apiService.downloadSchoolImportTemplate();
      downloadBlob(blob, 'template_school_import.xlsx');
    } catch (e: any) {
      window.alert(e?.response?.data?.error || 'Не удалось скачать шаблон');
    } finally {
      setTemplateBusy(false);
    }
  };

  const openImportDialog = (tenant: any) => {
    setImportResult(null);
    setImportTenant(tenant);
  };

  const closeImportDialog = () => {
    if (importBusy) return;
    setImportTenant(null);
    setImportResult(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !importTenant) return;
    setImportBusy(true);
    setImportResult(null);
    try {
      const res = await apiService.importSchoolExcel(importTenant.id, file);
      const data = res.data;
      setImportResult({
        success: Boolean(res.success),
        tenantName: data?.tenantName || importTenant.name,
        created: data?.created || {},
        errors: data?.errors || [],
        staffPasswords: data?.staffPasswords || [],
        errorMessage: res.error || (!res.success ? 'Импорт не выполнен' : undefined),
      });
    } catch (err: any) {
      const payload = err?.response?.data;
      setImportResult({
        success: false,
        tenantName: importTenant.name,
        created: payload?.data?.created || {},
        errors: payload?.data?.errors || [],
        staffPasswords: [],
        errorMessage: payload?.error || err?.message || 'Ошибка импорта',
      });
    } finally {
      setImportBusy(false);
    }
  };

  const downloadStaffPasswords = async () => {
    if (!importResult?.staffPasswords?.length) return;
    const XLSX = await import('xlsx');
    const rows = importResult.staffPasswords.map((s) => ({
      Email: s.email,
      Роль: s.role,
      'Временный пароль': s.password,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Пароли');
    XLSX.writeFile(wb, `staff_passwords_${importResult.tenantName || 'school'}.xlsx`);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Typography variant="h5" fontWeight="bold">
          Все аккаунты
        </Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={templateBusy ? <CircularProgress size={16} /> : <GetApp />}
            onClick={handleDownloadTemplate}
            disabled={templateBusy}
          >
            Шаблон заполнения школы
          </Button>
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
                        {canWrite && (
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => openImportDialog(tenant)}
                            title="Импорт Excel (пустая школа)"
                          >
                            <UploadFile fontSize="small" />
                          </IconButton>
                        )}
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

      <Dialog open={Boolean(importTenant)} onClose={closeImportDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Импорт Excel — {importTenant?.name || ''}</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Импорт только в пустую школу (нет филиалов, групп, учеников, абонементов и сотрудников кроме
            OWNER). Расписание занятий не импортируется.
          </Alert>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={handleFileChange}
          />
          {importBusy ? (
            <Box display="flex" alignItems="center" gap={2} py={2}>
              <CircularProgress size={28} />
              <Typography>Импортируем данные…</Typography>
            </Box>
          ) : importResult ? (
            <Box>
              {importResult.success ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Импорт выполнен для «{importResult.tenantName}»
                </Alert>
              ) : (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {importResult.errorMessage || 'Импорт не выполнен'}
                </Alert>
              )}
              {Object.keys(importResult.created || {}).length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Создано
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {Object.entries(importResult.created)
                      .filter(([, n]) => Number(n) > 0)
                      .map(([k, n]) => `${CREATED_LABELS[k] || k}: ${n}`)
                      .join(' · ') || '—'}
                  </Typography>
                </Box>
              )}
              {importResult.errors?.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Ошибки ({importResult.errors.length})
                  </Typography>
                  <List dense sx={{ maxHeight: 220, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1 }}>
                    {importResult.errors.slice(0, 50).map((err, idx) => (
                      <ListItem key={`${err.sheet}-${err.row}-${idx}`} disableGutters sx={{ px: 1.5 }}>
                        <ListItemText
                          primary={err.message}
                          secondary={`${err.sheet}${err.row ? `, строка ${err.row}` : ''}`}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
              {importResult.staffPasswords?.length > 0 && (
                <Alert severity="info">
                  Сохраните временные пароли сотрудников — повторно их не показать.
                </Alert>
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Выберите заполненный файл шаблона (.xlsx).
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          {importResult?.staffPasswords?.length ? (
            <Button onClick={downloadStaffPasswords} startIcon={<GetApp />}>
              Скачать пароли
            </Button>
          ) : null}
          {!importResult?.success && !importBusy && (
            <Button
              variant="contained"
              onClick={() => fileInputRef.current?.click()}
              startIcon={<UploadFile />}
            >
              Выбрать файл
            </Button>
          )}
          <Button onClick={closeImportDialog} disabled={importBusy}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SaAccountsTab;
