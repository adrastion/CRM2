import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  Chip,
  Checkbox,
  ListItemText,
  TableSortLabel,
} from '@mui/material';
import { 
  Add, 
  Edit, 
  Delete, 
  EmojiEvents,
  Upload,
  Download,
  Warning,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import { Competition, Client, Trainer, CompetitionResult } from '../types';

interface CompetitionFormData {
  name: string;
  location: string;
  startDate: Date | null;
  endDate: Date | null;
  registrationDate: Date | null;
  registrationTime: Date | null;
  isElectronicRegistration: boolean;
  positionDocument: string;
  regulationsDocument: string;
  trainerIds: string[];
  participantIds: string[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`competition-tabpanel-${index}`}
      aria-labelledby={`competition-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Competitions: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [trainerConflicts, setTrainerConflicts] = useState<any[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [positionDocumentPreview, setPositionDocumentPreview] = useState<string>('');
  const [regulationsDocumentPreview, setRegulationsDocumentPreview] = useState<string>('');
  const [results, setResults] = useState<CompetitionResult[]>([]);
  const [selectedParticipantForResult, setSelectedParticipantForResult] = useState<string>('');
  const [resultFormData, setResultFormData] = useState({
    result: '',
    resultValue: '',
    category: '',
    performanceTime: null as Date | null,
  });
  const [sortBy, setSortBy] = useState<string>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [formData, setFormData] = useState<CompetitionFormData>({
    name: '',
    location: '',
    startDate: null,
    endDate: null,
    registrationDate: null,
    registrationTime: null,
    isElectronicRegistration: false,
    positionDocument: '',
    regulationsDocument: '',
    trainerIds: [],
    participantIds: [],
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Загружаем данные параллельно, но обрабатываем ошибки независимо
      const results = await Promise.allSettled([
        apiService.getCompetitions({ limit: 1000 }),
        apiService.getClients({ limit: 1000 }),
        apiService.getTrainers(),
      ]);
      
      const errors: string[] = [];
      
      // Обрабатываем результаты соревнований
      if (results[0].status === 'fulfilled') {
        setCompetitions(results[0].value.data || []);
      } else {
        console.error('Error loading competitions:', results[0].reason);
        const errReason = results[0].reason as any;
        errors.push('Ошибка загрузки соревнований: ' + (errReason?.response?.data?.error || errReason?.message || 'Неизвестная ошибка'));
      }
      
      // Обрабатываем результаты клиентов
      if (results[1].status === 'fulfilled') {
        setClients(results[1].value.data || []);
      } else {
        console.error('Error loading clients:', results[1].reason);
        const errReason = results[1].reason as any;
        errors.push('Ошибка загрузки клиентов: ' + (errReason?.response?.data?.error || errReason?.message || 'Неизвестная ошибка'));
      }
      
      // Обрабатываем результаты тренеров
      if (results[2].status === 'fulfilled') {
        setTrainers(results[2].value.data || []);
      } else {
        console.error('Error loading trainers:', results[2].reason);
        const errReason = results[2].reason as any;
        errors.push('Ошибка загрузки тренеров: ' + (errReason?.response?.data?.error || errReason?.message || 'Неизвестная ошибка'));
      }
      
      // Устанавливаем ошибку, если есть хотя бы одна
      if (errors.length > 0) {
        setError(errors.join('; '));
      }
    } catch (err: any) {
      console.error('Unexpected error in fetchData:', err);
      setError(err.response?.data?.error || err.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = (file: File, type: 'position' | 'regulations') => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (type === 'position') {
        setFormData({ ...formData, positionDocument: base64String });
        setPositionDocumentPreview(base64String);
      } else {
        setFormData({ ...formData, regulationsDocument: base64String });
        setRegulationsDocumentPreview(base64String);
      }
    };
    reader.readAsDataURL(file);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Название соревнования обязательно';
    }
    if (!formData.location.trim()) {
      errors.location = 'Место проведения обязательно';
    }
    if (!formData.startDate) {
      errors.startDate = 'Дата начала обязательна';
    }
    if (!formData.endDate) {
      errors.endDate = 'Дата окончания обязательна';
    }
    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      errors.endDate = 'Дата окончания не может быть раньше даты начала';
    }
    if (!formData.registrationDate) {
      errors.registrationDate = 'Дата регистрации обязательна';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const checkTrainerConflicts = async (competitionId?: string) => {
    if (!formData.startDate || !formData.endDate || formData.trainerIds.length === 0) {
      setTrainerConflicts([]);
      return;
    }

    try {
      // If editing, use competition ID, otherwise create a temporary check
      if (competitionId) {
        const conflicts = await apiService.getTrainerConflicts(competitionId, {
          startDate: formData.startDate.toISOString(),
          endDate: formData.endDate.toISOString(),
        });
        setTrainerConflicts(conflicts);
        setShowConflicts(conflicts.length > 0);
      } else {
        // For new competitions, we'll check after creation
        setTrainerConflicts([]);
      }
    } catch (err) {
      console.error('Error checking trainer conflicts:', err);
    }
  };

  useEffect(() => {
    if (formData.startDate && formData.endDate && formData.trainerIds.length > 0 && editingCompetition) {
      checkTrainerConflicts(editingCompetition.id);
    }
  }, [formData.startDate, formData.endDate, formData.trainerIds, editingCompetition]);

  const handleCreateCompetition = async () => {
    if (!validateForm()) {
      setSnackbarMessage('Пожалуйста, исправьте ошибки в форме');
      setSnackbarOpen(true);
      return;
    }

    const competitionData = {
      ...formData,
      startDate: formData.startDate!.toISOString(),
      endDate: formData.endDate!.toISOString(),
      registrationDate: formData.registrationDate!.toISOString(),
      registrationTime: formData.registrationTime ? formData.registrationTime.toISOString() : null,
      positionDocument: formData.positionDocument || null,
      regulationsDocument: formData.regulationsDocument || null,
    };

    try {
      const newCompetition = await apiService.createCompetition(competitionData);
      
      // Check for trainer conflicts after creation
      if (newCompetition) {
        await checkTrainerConflicts(newCompetition.id);
      }

      // Remove participants from groups on competition dates
      if (formData.participantIds.length > 0 && formData.startDate && formData.endDate) {
        // This will be handled on the backend or in a separate function
        // For now, we'll just show a message
        setSnackbarMessage('Соревнование создано. Участники автоматически исключены из групп на дни соревнования.');
      } else {
        setSnackbarMessage('Соревнование создано успешно');
      }

      setSnackbarOpen(true);
      setOpenDialog(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error('Create competition error:', err);
      console.error('Request data:', competitionData);
      const validationErrors = err.response?.data?.data;
      let errorMessage = err.response?.data?.error || 'Ошибка создания соревнования';
      
      if (validationErrors && Array.isArray(validationErrors)) {
        errorMessage = 'Ошибки валидации:\n' + validationErrors.map((e: any) => `• ${e.field}: ${e.message}`).join('\n');
      }
      
      setError(errorMessage);
      setSnackbarMessage(errorMessage);
      setSnackbarOpen(true);
    }
  };

  const handleUpdateCompetition = async () => {
    if (!validateForm() || !editingCompetition) {
      setSnackbarMessage('Пожалуйста, исправьте ошибки в форме');
      setSnackbarOpen(true);
      return;
    }

    const competitionData = {
      ...formData,
      startDate: formData.startDate!.toISOString(),
      endDate: formData.endDate!.toISOString(),
      registrationDate: formData.registrationDate!.toISOString(),
      registrationTime: formData.registrationTime ? formData.registrationTime.toISOString() : null,
      positionDocument: formData.positionDocument || null,
      regulationsDocument: formData.regulationsDocument || null,
    };

    try {
      await apiService.updateCompetition(editingCompetition.id, competitionData);
      
      // Check for trainer conflicts after update
      await checkTrainerConflicts(editingCompetition.id);

      setSnackbarMessage('Соревнование обновлено успешно');
      setSnackbarOpen(true);
      setEditDialog(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error('Update competition error:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.data?.map((e: any) => `${e.field}: ${e.message}`).join(', ') || 'Ошибка обновления соревнования';
      setError(errorMessage);
      setSnackbarMessage(errorMessage);
      setSnackbarOpen(true);
    }
  };

  const handleDeleteCompetition = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить это соревнование?')) {
      return;
    }

    try {
      await apiService.deleteCompetition(id);
      setSnackbarMessage('Соревнование удалено успешно');
      setSnackbarOpen(true);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка удаления соревнования');
      setSnackbarMessage(err.response?.data?.error || 'Ошибка удаления соревнования');
      setSnackbarOpen(true);
    }
  };

  const handleEditCompetition = (competition: Competition) => {
    setEditingCompetition(competition);
    setFormData({
      name: competition.name,
      location: competition.location,
      startDate: new Date(competition.startDate),
      endDate: new Date(competition.endDate),
      registrationDate: new Date(competition.registrationDate),
      registrationTime: competition.registrationTime ? new Date(competition.registrationTime) : null,
      isElectronicRegistration: competition.isElectronicRegistration,
      positionDocument: competition.positionDocument || '',
      regulationsDocument: competition.regulationsDocument || '',
      trainerIds: competition.trainers?.map(t => t.trainerId) || [],
      participantIds: competition.participants?.map(p => p.clientId) || [],
    });
    setPositionDocumentPreview(competition.positionDocument || '');
    setRegulationsDocumentPreview(competition.regulationsDocument || '');
    setResults(competition.results || []);
    setTabValue(0);
    setEditDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      startDate: null,
      endDate: null,
      registrationDate: null,
      registrationTime: null,
      isElectronicRegistration: false,
      positionDocument: '',
      regulationsDocument: '',
      trainerIds: [],
      participantIds: [],
    });
    setFormErrors({});
    setPositionDocumentPreview('');
    setRegulationsDocumentPreview('');
    setEditingCompetition(null);
    setTrainerConflicts([]);
    setShowConflicts(false);
    setResults([]);
    setTabValue(0);
  };

  const handleAddResult = async () => {
    if (!editingCompetition || !selectedParticipantForResult) {
      setSnackbarMessage('Выберите участника');
      setSnackbarOpen(true);
      return;
    }

    try {
      const participant = editingCompetition.participants?.find(p => p.clientId === selectedParticipantForResult);
      if (!participant) {
        setSnackbarMessage('Участник не найден');
        setSnackbarOpen(true);
        return;
      }

      const resultData = {
        participantId: participant.id,
        result: resultFormData.result || null,
        resultValue: resultFormData.resultValue ? parseFloat(resultFormData.resultValue) : null,
        category: resultFormData.category || null,
        performanceTime: resultFormData.performanceTime ? resultFormData.performanceTime.toISOString() : null,
      };

      await apiService.addCompetitionResult(editingCompetition.id, resultData);
      setSnackbarMessage('Результат добавлен успешно');
      setSnackbarOpen(true);
      
      // Reset result form
      setResultFormData({
        result: '',
        resultValue: '',
        category: '',
        performanceTime: null,
      });
      setSelectedParticipantForResult('');
      
      // Refresh competition data
      const updated = await apiService.getCompetition(editingCompetition.id);
      setEditingCompetition(updated);
      setResults(updated.results || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка добавления результата');
      setSnackbarMessage(err.response?.data?.error || 'Ошибка добавления результата');
      setSnackbarOpen(true);
    }
  };

  const handleUpdateAttendance = async (participantId: string, status: string) => {
    if (!editingCompetition) return;

    try {
      await apiService.updateCompetitionAttendance(editingCompetition.id, participantId, { status });
      setSnackbarMessage('Посещаемость обновлена');
      setSnackbarOpen(true);
      
      // Refresh competition data
      const updated = await apiService.getCompetition(editingCompetition.id);
      setEditingCompetition(updated);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления посещаемости');
      setSnackbarMessage(err.response?.data?.error || 'Ошибка обновления посещаемости');
      setSnackbarOpen(true);
    }
  };

  const sortedCompetitions = [...competitions].sort((a, b) => {
    const aValue = a[sortBy as keyof Competition];
    const bValue = b[sortBy as keyof Competition];
    
    // Handle undefined values
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Соревнования</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              resetForm();
              setOpenDialog(true);
            }}
          >
            Создать соревнование
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'name'}
                        direction={sortBy === 'name' ? sortOrder : 'asc'}
                        onClick={() => {
                          if (sortBy === 'name') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('name');
                            setSortOrder('asc');
                          }
                        }}
                      >
                        Название
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Место</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'startDate'}
                        direction={sortBy === 'startDate' ? sortOrder : 'desc'}
                        onClick={() => {
                          if (sortBy === 'startDate') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('startDate');
                            setSortOrder('desc');
                          }
                        }}
                      >
                        Дата начала
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Дата окончания</TableCell>
                    <TableCell>Участники</TableCell>
                    <TableCell>Тренеры</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedCompetitions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary">
                          Нет соревнований
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedCompetitions.map((competition) => (
                      <TableRow key={competition.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <EmojiEvents sx={{ color: 'warning.main' }} />
                            <Typography variant="body2" fontWeight="bold">
                              {competition.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{competition.location}</TableCell>
                        <TableCell>
                          {format(new Date(competition.startDate), 'dd.MM.yyyy', { locale: ru })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(competition.endDate), 'dd.MM.yyyy', { locale: ru })}
                        </TableCell>
                        <TableCell>
                          {competition.participants?.length || 0}
                        </TableCell>
                        <TableCell>
                          {competition.trainers?.length || 0}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEditCompetition(competition)}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteCompetition(competition.id)}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Create Competition Dialog */}
        <Dialog 
          open={openDialog} 
          onClose={(event, reason) => {
            if (Object.keys(formErrors).length > 0) {
              setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
              setSnackbarOpen(true);
              return;
            }
            setOpenDialog(false);
            resetForm();
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Создать соревнование</DialogTitle>
          <DialogContent>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
              <Tab label="Основная информация" />
              <Tab label="Список соревнований" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="Название соревнования"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    error={!!formErrors.name}
                    helperText={formErrors.name}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="Место проведения"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    error={!!formErrors.location}
                    helperText={formErrors.location}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Дата начала"
                    value={formData.startDate}
                    onChange={(date) => setFormData({ ...formData, startDate: date })}
                    slotProps={{ textField: { fullWidth: true, required: true, error: !!formErrors.startDate, helperText: formErrors.startDate } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Дата окончания"
                    value={formData.endDate}
                    onChange={(date) => setFormData({ ...formData, endDate: date })}
                    slotProps={{ textField: { fullWidth: true, required: true, error: !!formErrors.endDate, helperText: formErrors.endDate } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Дата регистрации"
                    value={formData.registrationDate}
                    onChange={(date) => setFormData({ ...formData, registrationDate: date })}
                    slotProps={{ textField: { fullWidth: true, required: true, error: !!formErrors.registrationDate, helperText: formErrors.registrationDate } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TimePicker
                    label="Время регистрации"
                    value={formData.registrationTime}
                    onChange={(time) => setFormData({ ...formData, registrationTime: time })}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Тренеры</InputLabel>
                    <Select
                      multiple
                      value={formData.trainerIds}
                      onChange={(e) => setFormData({ ...formData, trainerIds: e.target.value as string[] })}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((trainerId) => {
                            const trainer = trainers.find(t => t.id === trainerId);
                            return trainer?.user ? (
                              <Chip
                                key={trainerId}
                                label={`${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim()}
                                size="small"
                              />
                            ) : null;
                          })}
                        </Box>
                      )}
                    >
                      {trainers.map((trainer) => (
                        <MenuItem key={trainer.id} value={trainer.id}>
                          <Checkbox checked={formData.trainerIds.indexOf(trainer.id) > -1} />
                          <ListItemText
                            primary={trainer.user ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim() : `Тренер #${trainer.id}`}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Участники</InputLabel>
                    <Select
                      multiple
                      value={formData.participantIds}
                      onChange={(e) => setFormData({ ...formData, participantIds: e.target.value as string[] })}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.length} участников
                        </Box>
                      )}
                    >
                      {clients.map((client) => (
                        <MenuItem key={client.id} value={client.id}>
                          <Checkbox checked={formData.participantIds.indexOf(client.id) > -1} />
                          <ListItemText
                            primary={`${client.lastName} ${client.firstName} ${client.middleName || ''}`.trim()}
                            secondary={client.dateOfBirth ? `Возраст: ${Math.floor((new Date().getTime() - new Date(client.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} лет` : ''}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Checkbox
                        checked={formData.isElectronicRegistration}
                        onChange={(e) => setFormData({ ...formData, isElectronicRegistration: e.target.checked })}
                      />
                      <Typography>Электронная регистрация</Typography>
                    </Box>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    startIcon={<Upload />}
                  >
                    Загрузить положение
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(file, 'position');
                        }
                      }}
                    />
                  </Button>
                  {positionDocumentPreview && (
                    <Box sx={{ mt: 1 }}>
                      <Chip label="Документ загружен" color="success" size="small" />
                      <Button
                        size="small"
                        startIcon={<Download />}
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = positionDocumentPreview;
                          link.download = 'position-document';
                          link.click();
                        }}
                      >
                        Скачать
                      </Button>
                    </Box>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    startIcon={<Upload />}
                  >
                    Загрузить регламент
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(file, 'regulations');
                        }
                      }}
                    />
                  </Button>
                  {regulationsDocumentPreview && (
                    <Box sx={{ mt: 1 }}>
                      <Chip label="Документ загружен" color="success" size="small" />
                      <Button
                        size="small"
                        startIcon={<Download />}
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = regulationsDocumentPreview;
                          link.download = 'regulations-document';
                          link.click();
                        }}
                      >
                        Скачать
                      </Button>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Typography variant="h6" gutterBottom>
                Список соревнований
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Название</TableCell>
                      <TableCell>Место</TableCell>
                      <TableCell>Дата начала</TableCell>
                      <TableCell>Дата окончания</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {competitions.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell>{comp.name}</TableCell>
                        <TableCell>{comp.location}</TableCell>
                        <TableCell>
                          {format(new Date(comp.startDate), 'dd.MM.yyyy', { locale: ru })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(comp.endDate), 'dd.MM.yyyy', { locale: ru })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setOpenDialog(false);
              resetForm();
            }}>
              Отмена
            </Button>
            <Button onClick={handleCreateCompetition} variant="contained">
              Создать
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Competition Dialog */}
        <Dialog 
          open={editDialog} 
          onClose={(event, reason) => {
            if (Object.keys(formErrors).length > 0) {
              setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
              setSnackbarOpen(true);
              return;
            }
            setEditDialog(false);
            resetForm();
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Редактировать соревнование</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            {Object.keys(formErrors).length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Пожалуйста, исправьте ошибки в форме: {Object.keys(formErrors).map(key => `${key}: ${formErrors[key]}`).join(', ')}
              </Alert>
            )}
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
              <Tab label="Основная информация" />
              <Tab label="Результаты" />
              <Tab label="Список соревнований" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              {showConflicts && trainerConflicts.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Обнаружены конфликты с тренировками:
                  </Typography>
                  {trainerConflicts.map((conflict, idx) => (
                    <Typography key={idx} variant="body2">
                      Тренер {conflict.trainer?.user ? `${conflict.trainer.user.lastName} ${conflict.trainer.user.firstName}` : ''} имеет тренировку "{conflict.title}" в {format(new Date(conflict.startTime), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </Typography>
                  ))}
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mt: 1 }}
                    onClick={() => {
                      // TODO: Implement trainer replacement logic
                      setSnackbarMessage('Функция замены тренеров будет реализована');
                      setSnackbarOpen(true);
                    }}
                  >
                    Предложить замену тренера
                  </Button>
                </Alert>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="Название соревнования"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    error={!!formErrors.name}
                    helperText={formErrors.name}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="Место проведения"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    error={!!formErrors.location}
                    helperText={formErrors.location}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Дата начала"
                    value={formData.startDate}
                    onChange={(date) => setFormData({ ...formData, startDate: date })}
                    slotProps={{ textField: { fullWidth: true, required: true, error: !!formErrors.startDate, helperText: formErrors.startDate } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Дата окончания"
                    value={formData.endDate}
                    onChange={(date) => setFormData({ ...formData, endDate: date })}
                    slotProps={{ textField: { fullWidth: true, required: true, error: !!formErrors.endDate, helperText: formErrors.endDate } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Дата регистрации"
                    value={formData.registrationDate}
                    onChange={(date) => setFormData({ ...formData, registrationDate: date })}
                    slotProps={{ textField: { fullWidth: true, required: true, error: !!formErrors.registrationDate, helperText: formErrors.registrationDate } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TimePicker
                    label="Время регистрации"
                    value={formData.registrationTime}
                    onChange={(time) => setFormData({ ...formData, registrationTime: time })}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Тренеры</InputLabel>
                    <Select
                      multiple
                      value={formData.trainerIds}
                      onChange={(e) => setFormData({ ...formData, trainerIds: e.target.value as string[] })}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((trainerId) => {
                            const trainer = trainers.find(t => t.id === trainerId);
                            return trainer?.user ? (
                              <Chip
                                key={trainerId}
                                label={`${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim()}
                                size="small"
                              />
                            ) : null;
                          })}
                        </Box>
                      )}
                    >
                      {trainers.map((trainer) => (
                        <MenuItem key={trainer.id} value={trainer.id}>
                          <Checkbox checked={formData.trainerIds.indexOf(trainer.id) > -1} />
                          <ListItemText
                            primary={trainer.user ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim() : `Тренер #${trainer.id}`}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Участники</InputLabel>
                    <Select
                      multiple
                      value={formData.participantIds}
                      onChange={(e) => setFormData({ ...formData, participantIds: e.target.value as string[] })}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.length} участников
                        </Box>
                      )}
                    >
                      {clients.map((client) => (
                        <MenuItem key={client.id} value={client.id}>
                          <Checkbox checked={formData.participantIds.indexOf(client.id) > -1} />
                          <ListItemText
                            primary={`${client.lastName} ${client.firstName} ${client.middleName || ''}`.trim()}
                            secondary={client.dateOfBirth ? `Возраст: ${Math.floor((new Date().getTime() - new Date(client.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} лет, Вес: ${client.weight || 'не указан'} кг` : ''}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Checkbox
                        checked={formData.isElectronicRegistration}
                        onChange={(e) => setFormData({ ...formData, isElectronicRegistration: e.target.checked })}
                      />
                      <Typography>Электронная регистрация</Typography>
                    </Box>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    startIcon={<Upload />}
                  >
                    Загрузить положение
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(file, 'position');
                        }
                      }}
                    />
                  </Button>
                  {positionDocumentPreview && (
                    <Box sx={{ mt: 1 }}>
                      <Chip label="Документ загружен" color="success" size="small" />
                      <Button
                        size="small"
                        startIcon={<Download />}
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = positionDocumentPreview;
                          link.download = 'position-document';
                          link.click();
                        }}
                      >
                        Скачать
                      </Button>
                    </Box>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    startIcon={<Upload />}
                  >
                    Загрузить регламент
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(file, 'regulations');
                        }
                      }}
                    />
                  </Button>
                  {regulationsDocumentPreview && (
                    <Box sx={{ mt: 1 }}>
                      <Chip label="Документ загружен" color="success" size="small" />
                      <Button
                        size="small"
                        startIcon={<Download />}
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = regulationsDocumentPreview;
                          link.download = 'regulations-document';
                          link.click();
                        }}
                      >
                        Скачать
                      </Button>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Результаты соревнования
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Участник</InputLabel>
                    <Select
                      value={selectedParticipantForResult}
                      onChange={(e) => setSelectedParticipantForResult(e.target.value)}
                    >
                      {editingCompetition?.participants?.map((participant) => {
                        const client = clients.find(c => c.id === participant.clientId);
                        return (
                          <MenuItem key={participant.id} value={participant.clientId}>
                            {client ? `${client.lastName} ${client.firstName} ${client.middleName || ''}`.trim() : `Участник #${participant.id}`}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Результат (текст)"
                    value={resultFormData.result}
                    onChange={(e) => setResultFormData({ ...resultFormData, result: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Результат (число)"
                    type="number"
                    value={resultFormData.resultValue}
                    onChange={(e) => setResultFormData({ ...resultFormData, resultValue: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Категория"
                    value={resultFormData.category}
                    onChange={(e) => setResultFormData({ ...resultFormData, category: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TimePicker
                    label="Время выступления"
                    value={resultFormData.performanceTime}
                    onChange={(time) => setResultFormData({ ...resultFormData, performanceTime: time })}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleAddResult}
                    disabled={!selectedParticipantForResult}
                  >
                    Добавить результат
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>ФИО спортсмена</TableCell>
                          <TableCell>Возраст</TableCell>
                          <TableCell>Вес</TableCell>
                          <TableCell>Результат</TableCell>
                          <TableCell>Категория</TableCell>
                          <TableCell>Время выступления</TableCell>
                          <TableCell>Посещаемость</TableCell>
                          <TableCell>Действия</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {editingCompetition?.participants?.map((participant) => {
                          const client = clients.find(c => c.id === participant.clientId);
                          const result = results.find(r => r.participantId === participant.id);
                          const attendance = participant.attendance;
                          const age = client?.dateOfBirth ? Math.floor((new Date().getTime() - new Date(client.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
                          
                          return (
                            <TableRow key={participant.id}>
                              <TableCell>
                                {client ? `${client.lastName} ${client.firstName} ${client.middleName || ''}`.trim() : `Участник #${participant.id}`}
                              </TableCell>
                              <TableCell>{age !== null ? `${age} лет` : '-'}</TableCell>
                              <TableCell>{client?.weight ? `${client.weight} кг` : '-'}</TableCell>
                              <TableCell>
                                {result?.result || result?.resultValue || '-'}
                              </TableCell>
                              <TableCell>{result?.category || '-'}</TableCell>
                              <TableCell>
                                {result?.performanceTime ? format(new Date(result.performanceTime), 'HH:mm', { locale: ru }) : '-'}
                              </TableCell>
                              <TableCell>
                                <Select
                                  size="small"
                                  value={attendance?.status || 'ABSENT'}
                                  onChange={(e) => handleUpdateAttendance(participant.id, e.target.value)}
                                >
                                  <MenuItem value="PRESENT">
                                    <CheckCircle sx={{ color: 'success.main', mr: 1 }} />
                                    Присутствовал
                                  </MenuItem>
                                  <MenuItem value="ABSENT">
                                    <Cancel sx={{ color: 'error.main', mr: 1 }} />
                                    Отсутствовал
                                  </MenuItem>
                                  <MenuItem value="EXCUSED">
                                    <Warning sx={{ color: 'warning.main', mr: 1 }} />
                                    Уважительная причина
                                  </MenuItem>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {result && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={async () => {
                                      if (window.confirm('Удалить результат?')) {
                                        try {
                                          await apiService.deleteCompetitionResult(result.id);
                                          setSnackbarMessage('Результат удален');
                                          setSnackbarOpen(true);
                                          const updated = await apiService.getCompetition(editingCompetition.id);
                                          setEditingCompetition(updated);
                                          setResults(updated.results || []);
                                        } catch (err: any) {
                                          setError(err.response?.data?.error || 'Ошибка удаления результата');
                                        }
                                      }
                                    }}
                                  >
                                    <Delete />
                                  </IconButton>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Typography variant="h6" gutterBottom>
                Список соревнований
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Название</TableCell>
                      <TableCell>Место</TableCell>
                      <TableCell>Дата начала</TableCell>
                      <TableCell>Дата окончания</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {competitions.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell>{comp.name}</TableCell>
                        <TableCell>{comp.location}</TableCell>
                        <TableCell>
                          {format(new Date(comp.startDate), 'dd.MM.yyyy', { locale: ru })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(comp.endDate), 'dd.MM.yyyy', { locale: ru })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setEditDialog(false);
              resetForm();
            }}>
              Отмена
            </Button>
            <Button onClick={handleUpdateCompetition} variant="contained">
              Сохранить изменения
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          message={snackbarMessage}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default Competitions;

