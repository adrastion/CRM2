import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Edit } from '@mui/icons-material';
import { apiService } from '../services/api';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ClientDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientData, setClientData] = useState<any>(null);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [passportDialog, setPassportDialog] = useState(false);
  const [passportData, setPassportData] = useState({
    passportSeries: '',
    passportNumber: '',
    passportIssueDate: '',
    passportIssuedBy: '',
    passportDivisionCode: '',
    passportBirthPlace: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('clientToken');
    if (!token) {
      navigate('/client/login');
      return;
    }

    fetchClientData();
    if (tabValue === 0) {
      fetchTrainings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tabValue === 0 && clientData) {
      fetchTrainings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue, clientData]);

  const fetchClientData = async () => {
    try {
      const data = await apiService.getClientProfile();
      setClientData(data);
      if (data) {
        // Если это родитель, используем данные его ребенка для паспорта
        const clientInfo = data.userType === 'parent' ? data : data;
        setPassportData({
          passportSeries: clientInfo.passportSeries || '',
          passportNumber: clientInfo.passportNumber || '',
          passportIssueDate: clientInfo.passportIssueDate ? format(new Date(clientInfo.passportIssueDate), 'yyyy-MM-dd') : '',
          passportIssuedBy: clientInfo.passportIssuedBy || '',
          passportDivisionCode: clientInfo.passportDivisionCode || '',
          passportBirthPlace: clientInfo.passportBirthPlace || ''
        });
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('clientToken');
        localStorage.removeItem('client');
        localStorage.removeItem('clientTenant');
        localStorage.removeItem('userType');
        navigate('/client/login');
      } else {
        setError('Ошибка загрузки данных');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTrainings = async () => {
    try {
      const startDate = new Date().toISOString();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      const data = await apiService.getClientTrainings(startDate, endDate.toISOString());
      setTrainings(data || []);
    } catch (err: any) {
      console.error('Error fetching trainings:', err);
    }
  };

  const handleSavePassport = async () => {
    try {
      // Обновляем паспортные данные через API
      const updated = await apiService.updateClient(clientData.id, {
        passportSeries: passportData.passportSeries || null,
        passportNumber: passportData.passportNumber || null,
        passportIssueDate: passportData.passportIssueDate || null,
        passportIssuedBy: passportData.passportIssuedBy || null,
        passportDivisionCode: passportData.passportDivisionCode || null,
        passportBirthPlace: passportData.passportBirthPlace || null
      });
      setClientData({ ...clientData, ...updated });
      setPassportDialog(false);
      alert('Паспортные данные успешно обновлены');
    } catch (err: any) {
      alert('Ошибка при обновлении паспортных данных: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('clientToken');
    localStorage.removeItem('client');
    localStorage.removeItem('clientTenant');
    navigate('/client/login');
  };

  const formatDate = (date: string | Date | null | undefined): string => {
    try {
      if (!date) return '-';
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) return '-';
      return format(dateObj, 'dd.MM.yyyy HH:mm', { locale: ru });
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!clientData) {
    return null;
  }

  const clientGroups = clientData.groupMemberships || [];
  const clientStandards = clientData.clientStandards || [];
  const competitions = clientData.competitionParticipants || [];
  const payments = clientData.payments || [];
  const tenantSubscription = clientData.tenant?.subscription;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">
          Личный кабинет
        </Typography>
        <Button variant="outlined" onClick={handleLogout}>
          Выйти
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {[clientData.lastName, clientData.firstName, clientData.middleName].filter(Boolean).join(' ')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {clientData.email || clientData.phone}
            </Typography>
            {clientData.membershipFeePaid && (
              <Chip label="Членский взнос оплачен" color="success" sx={{ mt: 1 }} />
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Мои группы
            </Typography>
            {clientGroups.length > 0 ? (
              clientGroups.map((gm: any) => (
                <Typography key={gm.id} variant="body2">
                  {gm.group?.name}
                </Typography>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                Нет активных групп
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {tenantSubscription && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Тариф: {tenantSubscription.planType}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Статус: {tenantSubscription.status}
          </Typography>
        </Paper>
      )}

      <Paper>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Расписание" />
          <Tab label="Нормативы" />
          <Tab label="Соревнования" />
          <Tab label="Платежи" />
          <Tab label="Профиль" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>Мое расписание</Typography>
          {trainings.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Дата и время</TableCell>
                    <TableCell>Название</TableCell>
                    <TableCell>Группа</TableCell>
                    <TableCell>Тренер</TableCell>
                    <TableCell>Филиал</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trainings.map((training: any) => (
                    <TableRow key={training.id}>
                      <TableCell>{formatDate(training.startTime as string | Date)}</TableCell>
                      <TableCell>{training.title || training.group?.name || 'Тренировка'}</TableCell>
                      <TableCell>{training.group?.name || 'Индивидуальная'}</TableCell>
                      <TableCell>
                        {training.trainer?.user 
                          ? `${training.trainer.user.lastName} ${training.trainer.user.firstName}`
                          : '-'}
                      </TableCell>
                      <TableCell>{training.branch?.name || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Нет запланированных тренировок
            </Typography>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>Мои нормативы</Typography>
          {clientStandards.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Норматив</TableCell>
                    <TableCell>Дата выполнения</TableCell>
                    <TableCell>Результат</TableCell>
                    <TableCell>Статус</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clientStandards.map((cs: any) => (
                    <TableRow key={cs.id}>
                      <TableCell>{cs.standard?.name || '-'}</TableCell>
                      <TableCell>{formatDate(cs.completedAt as string | Date)}</TableCell>
                      <TableCell>
                        {cs.result ? `${cs.result} ${cs.standard?.unit || ''}` : cs.resultText || '-'}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={cs.status === 'completed' ? 'Выполнено' : cs.status}
                          color={cs.status === 'completed' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Нет выполненных нормативов
            </Typography>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>Соревнования</Typography>
          {competitions.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Дата</TableCell>
                    <TableCell>Результат</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {competitions.map((cp: any) => (
                    <TableRow key={cp.id}>
                      <TableCell>{cp.competition?.name || '-'}</TableCell>
                      <TableCell>
                        {cp.competition?.date ? formatDate(cp.competition.date as string | Date) : '-'}
                      </TableCell>
                      <TableCell>{cp.result || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Нет участий в соревнованиях
            </Typography>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>Платежи</Typography>
          {payments.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Тип</TableCell>
                    <TableCell>Сумма</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Дата</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.type}</TableCell>
                      <TableCell>{payment.amount} ₽</TableCell>
                      <TableCell>
                        <Chip 
                          label={payment.status}
                          color={payment.status === 'paid' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {payment.paidAt ? formatDate(payment.paidAt as string | Date) : 
                         payment.dueDate ? formatDate(payment.dueDate as string | Date) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Нет платежей
            </Typography>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Профиль</Typography>
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={() => setPassportDialog(true)}
            >
              Редактировать паспортные данные
            </Button>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Паспортные данные
                  </Typography>
                  <Typography variant="body2">
                    Серия: {clientData.passportSeries || 'Не указано'}
                  </Typography>
                  <Typography variant="body2">
                    Номер: {clientData.passportNumber || 'Не указано'}
                  </Typography>
                  <Typography variant="body2">
                    Дата выдачи: {clientData.passportIssueDate ? formatDate(clientData.passportIssueDate as string | Date) : 'Не указано'}
                  </Typography>
                  <Typography variant="body2">
                    Кем выдан: {clientData.passportIssuedBy || 'Не указано'}
                  </Typography>
                  <Typography variant="body2">
                    Код подразделения: {clientData.passportDivisionCode || 'Не указано'}
                  </Typography>
                  <Typography variant="body2">
                    Место рождения: {clientData.passportBirthPlace || 'Не указано'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Тренеры
                  </Typography>
                  {clientGroups.length > 0 ? (
                    clientGroups.map((gm: any) => (
                      <Typography key={gm.id} variant="body2">
                        {gm.group?.trainer?.user 
                          ? `${gm.group.trainer.user.lastName} ${gm.group.trainer.user.firstName} ${gm.group.trainer.user.middleName || ''}`
                          : 'Не указано'}
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Нет тренеров
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Филиалы
                  </Typography>
                  {clientGroups.length > 0 ? (
                    clientGroups.map((gm: any) => (
                      <Typography key={gm.id} variant="body2">
                        {gm.group?.branch?.name || 'Не указано'}
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Нет филиалов
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      <Dialog open={passportDialog} onClose={() => setPassportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Редактировать паспортные данные</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Серия паспорта"
                value={passportData.passportSeries}
                onChange={(e) => setPassportData({ ...passportData, passportSeries: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Номер паспорта"
                value={passportData.passportNumber}
                onChange={(e) => setPassportData({ ...passportData, passportNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Дата выдачи"
                type="date"
                value={passportData.passportIssueDate}
                onChange={(e) => setPassportData({ ...passportData, passportIssueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Кем выдан"
                value={passportData.passportIssuedBy}
                onChange={(e) => setPassportData({ ...passportData, passportIssuedBy: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Код подразделения"
                value={passportData.passportDivisionCode}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '');
                  if (value.length > 6) value = value.slice(0, 6);
                  if (value.length === 6) {
                    value = value.slice(0, 3) + '-' + value.slice(3);
                  }
                  setPassportData({ ...passportData, passportDivisionCode: value });
                }}
                placeholder="000-000"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Место рождения"
                value={passportData.passportBirthPlace}
                onChange={(e) => setPassportData({ ...passportData, passportBirthPlace: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPassportDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleSavePassport}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ClientDashboard;
