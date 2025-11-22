import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Radio,
  RadioGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { 
  Add, 
  CalendarToday,
  AccessTime,
  Group as GroupIcon,
  Edit,
  People,
  CheckCircle,
  Cancel,
  HelpOutline,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import { Training, Group, Branch, Trainer, Client, Attendance } from '../types';

interface TrainingFormData {
  title: string;
  description: string;
  date: Date | null;
  startTime: Date | null;
  endTime: Date | null;
  groupId: string;
  trainerId: string;
  branchId: string;
  isRecurring: boolean;
  recurrence: string;
  daysOfWeek: number[];
}

const Schedule: React.FC = () => {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [attendanceDialog, setAttendanceDialog] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [attendanceData, setAttendanceData] = useState<Array<{client: Client, attendance: Attendance | null}>>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDayForTraining, setSelectedDayForTraining] = useState<Date | null>(null);
  const [formData, setFormData] = useState<TrainingFormData>({
    title: '',
    description: '',
    date: new Date(),
    startTime: null,
    endTime: null,
    groupId: '',
    trainerId: '',
    branchId: '',
    isRecurring: false,
    recurrence: 'weekly',
    daysOfWeek: []
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [trainingsRes, groupsRes, trainersRes, branchesRes] = await Promise.all([
        apiService.getTrainings(),
        apiService.getGroups(),
        apiService.getTrainers(),
        apiService.getBranches()
      ]);
      
      setTrainings(trainingsRes.data);
      setGroups(groupsRes.data);
      setTrainers(trainersRes.data);
      setBranches(branchesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const loadData = async () => {
      try {
        if (!isMounted || abortController.signal.aborted) return;
        setLoading(true);
        const [trainingsRes, groupsRes, trainersRes, branchesRes] = await Promise.all([
          apiService.getTrainings(undefined, abortController.signal),
          apiService.getGroups(undefined, abortController.signal),
          apiService.getTrainers(undefined, abortController.signal),
          apiService.getBranches(undefined, abortController.signal)
        ]);
        
        if (!isMounted || abortController.signal.aborted) return;
        setTrainings(trainingsRes.data);
        setGroups(groupsRes.data);
        setTrainers(trainersRes.data);
        setBranches(branchesRes.data);
      } catch (error: any) {
        // Ignore cancelled requests
        if (error?.code === 'ERR_CANCELED' || error?.message === 'canceled' || abortController.signal.aborted) {
          return;
        }
        if (!isMounted) return;
        console.error('Error fetching data:', error);
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const handleCreateTraining = async () => {
    try {
      if (!formData.startTime || !formData.endTime || !formData.date) {
        alert('Пожалуйста, выберите дату, время начала и окончания');
        return;
      }

      if (formData.isRecurring && formData.daysOfWeek.length === 0) {
        alert('Пожалуйста, выберите хотя бы один день недели для регулярной тренировки');
        return;
      }

      // Create training for selected date
      const baseDate = formData.date;
      const startTime = new Date(baseDate);
      startTime.setHours(formData.startTime.getHours(), formData.startTime.getMinutes());
      
      const endTime = new Date(baseDate);
      endTime.setHours(formData.endTime.getHours(), formData.endTime.getMinutes());

      const trainingData = {
        title: formData.title,
        description: formData.description,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        groupId: formData.groupId,
        trainerId: formData.trainerId,
        branchId: formData.branchId,
        isRecurring: formData.isRecurring,
        recurrence: formData.recurrence,
        daysOfWeek: formData.daysOfWeek
      };

      if (formData.isRecurring) {
        // Create recurring trainings for the next 4 weeks
        const trainings = [];
        for (let week = 0; week < 4; week++) {
          for (const dayOfWeek of formData.daysOfWeek) {
            const trainingDate = new Date(baseDate);
            trainingDate.setDate(baseDate.getDate() + (week * 7) + (dayOfWeek - baseDate.getDay()));
            
            const recurringStartTime = new Date(trainingDate);
            recurringStartTime.setHours(formData.startTime.getHours(), formData.startTime.getMinutes());
            
            const recurringEndTime = new Date(trainingDate);
            recurringEndTime.setHours(formData.endTime.getHours(), formData.endTime.getMinutes());

            trainings.push({
              ...trainingData,
              startTime: recurringStartTime.toISOString(),
              endTime: recurringEndTime.toISOString()
            });
          }
        }
        
        // Create all recurring trainings
        for (const training of trainings) {
          await apiService.createTraining(training);
        }
      } else {
        // Create single training
        await apiService.createTraining(trainingData);
      }

      await fetchData();
      setOpenDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error creating training:', error);
      alert('Не удалось создать тренировку');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: new Date(),
      startTime: null,
      endTime: null,
      groupId: '',
      trainerId: '',
      branchId: '',
      isRecurring: false,
      recurrence: 'weekly',
      daysOfWeek: []
    });
    setEditingTraining(null);
  };

  const handleEditTraining = (training: Training) => {
    setEditingTraining(training);
    const startDate = new Date(training.startTime);
    const endDate = new Date(training.endTime);
    
    setFormData({
      title: training.title || '',
      description: training.description || '',
      date: startDate,
      startTime: startDate,
      endTime: endDate,
      groupId: training.groupId || '',
      trainerId: training.trainerId || '',
      branchId: training.branchId || '',
      isRecurring: training.isRecurring || false,
      recurrence: training.recurrence || 'weekly',
      daysOfWeek: []
    });
    setEditDialog(true);
  };

  const handleUpdateTraining = async () => {
    if (!editingTraining) return;

    try {
      if (!formData.startTime || !formData.endTime || !formData.date) {
        alert('Пожалуйста, выберите дату, время начала и окончания');
        return;
      }

      const startTime = new Date(formData.date);
      startTime.setHours(formData.startTime.getHours(), formData.startTime.getMinutes());
      
      const endTime = new Date(formData.date);
      endTime.setHours(formData.endTime.getHours(), formData.endTime.getMinutes());

      const trainingData = {
        title: formData.title,
        description: formData.description,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        groupId: formData.groupId,
        trainerId: formData.trainerId,
        branchId: formData.branchId,
        isRecurring: formData.isRecurring,
        recurrence: formData.recurrence,
      };

      await apiService.updateTraining(editingTraining.id, trainingData);
      await fetchData();
      setEditDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error updating training:', error);
      alert('Не удалось обновить тренировку');
    }
  };

  const handleOpenAttendanceDialog = async (training: Training) => {
    setSelectedTraining(training);
    try {
      const response = await apiService.getAttendancesByTraining(training.id);
      // API returns { training, clients: [...] }
      setAttendanceData(response.clients || []);
      setAttendanceDialog(true);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      alert('Не удалось загрузить данные о посещаемости');
    }
  };

  const handleAttendanceStatusChange = (clientId: string, status: 'PRESENT' | 'ABSENT' | 'EXCUSED') => {
    setAttendanceData(prev => 
      prev.map(item => {
        if (item.client.id === clientId) {
          if (item.attendance) {
            return {
              ...item,
              attendance: {
                ...item.attendance,
                status: status as 'PRESENT' | 'ABSENT' | 'EXCUSED'
              } as Attendance
            };
          } else {
            return {
              ...item,
              attendance: {
                id: '',
                status: status as 'PRESENT' | 'ABSENT' | 'EXCUSED',
                notes: '',
                clientId,
                trainingId: selectedTraining?.id || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              } as Attendance
            };
          }
        }
        return item;
      })
    );
  };

  const handleSaveAttendance = async () => {
    if (!selectedTraining) return;

    try {
      const attendances = attendanceData.map(item => ({
        clientId: item.client.id,
        status: item.attendance?.status || 'ABSENT',
        notes: item.attendance?.notes || ''
      }));

      await apiService.bulkUpdateAttendance(selectedTraining.id, attendances);
      await fetchData();
      setAttendanceDialog(false);
      setSelectedTraining(null);
      alert('Посещаемость сохранена');
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Не удалось сохранить посещаемость');
    }
  };

  const getTrainingsForDate = (date: Date) => {
    return trainings.filter(training => 
      isSameDay(new Date(training.startTime), date)
    );
  };

  const getWeekDays = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const weekDays = getWeekDays();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Расписание тренировок
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            sx={{ textTransform: 'none' }}
            onClick={() => {
              setSelectedDayForTraining(null);
              setFormData({ ...formData, date: new Date() });
              setOpenDialog(true);
            }}
          >
            Добавить тренировку
          </Button>
        </Box>

        {/* Week Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Button
            onClick={() => setSelectedDate(new Date(selectedDate.getTime() - 7 * 24 * 60 * 60 * 1000))}
          >
            Previous Week
          </Button>
          <Typography variant="h6">
            {format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d', { locale: ru })} - {format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d, yyyy', { locale: ru })}
          </Typography>
          <Button
            onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 7 * 24 * 60 * 60 * 1000))}
          >
            Next Week
          </Button>
        </Box>

        {/* Calendar Grid */}
        <Grid container spacing={1}>
          {weekDays.map((day, index) => {
            const dayTrainings = getTrainingsForDate(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <Grid item xs={12} sm={6} md={12/7} key={index}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    minHeight: 200,
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 3,
                      backgroundColor: 'action.hover'
                    }
                  }}
                  onClick={() => {
                    setSelectedDayForTraining(day);
                    setFormData({ ...formData, date: day });
                    setOpenDialog(true);
                  }}
                >
                  <CardContent sx={{ p: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <CalendarToday sx={{ fontSize: 16, mr: 1 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: isToday ? 'bold' : 'normal' }}>
                        {format(day, 'EEE', { locale: ru })}
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: isToday ? 'bold' : 'normal' }}>
                      {format(day, 'd')}
                    </Typography>
                    
                    <List dense>
                      {dayTrainings.map((training) => (
                        <ListItem key={training.id} sx={{ p: 0, mb: 0.5 }}>
                          <Paper 
                            sx={{ 
                              p: 1, 
                              width: '100%', 
                              bgcolor: 'primary.light', 
                              color: 'primary.contrastText',
                              position: 'relative'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(25, 118, 210, 0.8)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(25, 118, 210, 0.5)';
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                              {training.title}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                              <AccessTime sx={{ fontSize: 12, mr: 0.5 }} />
                              <Typography variant="caption">
                                {format(new Date(training.startTime), 'HH:mm')} - {format(new Date(training.endTime), 'HH:mm')}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                              <GroupIcon sx={{ fontSize: 12, mr: 0.5 }} />
                              <Typography variant="caption">
                                {groups.find(g => g.id === training.groupId)?.name || 'Unknown Group'}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 1, justifyContent: 'flex-end' }}>
                              <IconButton
                                size="small"
                                sx={{ color: 'white', p: 0.5 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTraining(training);
                                }}
                                title="Редактировать тренировку"
                              >
                                <Edit sx={{ fontSize: 14 }} />
                              </IconButton>
                              <IconButton
                                size="small"
                                sx={{ color: 'white', p: 0.5 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAttendanceDialog(training);
                                }}
                                title="Учет посещаемости"
                              >
                                <People sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                          </Paper>
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Create Training Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Создать новую тренировку
            {selectedDayForTraining && (
              <Typography variant="subtitle2" color="text.secondary">
                на {format(selectedDayForTraining, 'EEEE, d MMMM yyyy', { locale: ru })}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Название тренировки"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Описание"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <DatePicker
                  label="Дата тренировки"
                  value={formData.date}
                  onChange={(newValue) => setFormData({ ...formData, date: newValue })}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TimePicker
                  label="Время начала"
                  value={formData.startTime}
                  onChange={(newValue) => setFormData({ ...formData, startTime: newValue })}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TimePicker
                  label="Время окончания"
                  value={formData.endTime}
                  onChange={(newValue) => setFormData({ ...formData, endTime: newValue })}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Группа</InputLabel>
                  <Select
                    value={formData.groupId}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                  >
                    {groups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Тренер</InputLabel>
                  <Select
                    value={formData.trainerId}
                    onChange={(e) => setFormData({ ...formData, trainerId: e.target.value })}
                  >
                    {trainers.map((trainer) => (
                      <MenuItem key={trainer.id} value={trainer.id}>
                        {trainer.user?.firstName} {trainer.user?.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Филиал</InputLabel>
                  <Select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    {branches.map((branch) => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Recurring Training Settings */}
              <Grid item xs={12}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Настройки регулярных тренировок
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControl>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <input
                            type="checkbox"
                            checked={formData.isRecurring}
                            onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                          />
                          <Typography>Создать регулярную тренировку</Typography>
                        </Box>
                      </FormControl>
                    </Grid>
                    
                    {formData.isRecurring && (
                      <>
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" gutterBottom>
                            Выберите дни недели:
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {[
                              { value: 0, label: 'Вс' },
                              { value: 1, label: 'Пн' },
                              { value: 2, label: 'Вт' },
                              { value: 3, label: 'Ср' },
                              { value: 4, label: 'Чт' },
                              { value: 5, label: 'Пт' },
                              { value: 6, label: 'Сб' }
                            ].map((day) => (
                              <Chip
                                key={day.value}
                                label={day.label}
                                clickable
                                color={formData.daysOfWeek.includes(day.value) ? 'primary' : 'default'}
                                onClick={() => {
                                  const newDays = formData.daysOfWeek.includes(day.value)
                                    ? formData.daysOfWeek.filter(d => d !== day.value)
                                    : [...formData.daysOfWeek, day.value];
                                  setFormData({ ...formData, daysOfWeek: newDays });
                                }}
                              />
                            ))}
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <FormControl fullWidth>
                            <InputLabel>Повторение</InputLabel>
                            <Select
                              value={formData.recurrence}
                              onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
                            >
                              <MenuItem value="weekly">Еженедельно</MenuItem>
                              <MenuItem value="biweekly">Раз в две недели</MenuItem>
                              <MenuItem value="monthly">Ежемесячно</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">
                            Это создаст тренировки на следующие 4 недели в выбранные дни.
                          </Typography>
                        </Grid>
                      </>
                    )}
                  </Grid>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Отмена</Button>
            <Button onClick={handleCreateTraining} variant="contained">
              Создать тренировку
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Training Dialog */}
        <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Редактировать тренировку</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Название тренировки"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Описание"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <DatePicker
                  label="Дата тренировки"
                  value={formData.date}
                  onChange={(newValue) => setFormData({ ...formData, date: newValue })}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TimePicker
                  label="Время начала"
                  value={formData.startTime}
                  onChange={(newValue) => setFormData({ ...formData, startTime: newValue })}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TimePicker
                  label="Время окончания"
                  value={formData.endTime}
                  onChange={(newValue) => setFormData({ ...formData, endTime: newValue })}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Группа</InputLabel>
                  <Select
                    value={formData.groupId}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                  >
                    {groups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Тренер</InputLabel>
                  <Select
                    value={formData.trainerId}
                    onChange={(e) => setFormData({ ...formData, trainerId: e.target.value })}
                  >
                    {trainers.map((trainer) => (
                      <MenuItem key={trainer.id} value={trainer.id}>
                        {trainer.user?.firstName} {trainer.user?.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Филиал</InputLabel>
                  <Select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    {branches.map((branch) => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setEditDialog(false);
              resetForm();
            }}>Отмена</Button>
            <Button onClick={handleUpdateTraining} variant="contained">
              Сохранить изменения
            </Button>
          </DialogActions>
        </Dialog>

        {/* Attendance Dialog */}
        <Dialog open={attendanceDialog} onClose={() => setAttendanceDialog(false)} maxWidth="lg" fullWidth>
          <DialogTitle>
            Учет посещаемости: {selectedTraining?.title}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {selectedTraining && format(new Date(selectedTraining.startTime), 'EEEE, d MMMM yyyy, HH:mm', { locale: ru })}
            </Typography>
          </DialogTitle>
          <DialogContent>
            {attendanceData.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                В группе нет участников
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Клиент</TableCell>
                      <TableCell>Телефон</TableCell>
                      <TableCell align="center">Присутствовал</TableCell>
                      <TableCell align="center">Отсутствовал</TableCell>
                      <TableCell align="center">Уважительная причина</TableCell>
                      <TableCell>Примечания</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {attendanceData.map((item) => {
                      const currentStatus = item.attendance?.status || 'ABSENT';
                      return (
                        <TableRow key={item.client.id}>
                          <TableCell>
                            {item.client.firstName} {item.client.lastName}
                          </TableCell>
                          <TableCell>{item.client.phone || '-'}</TableCell>
                          <TableCell align="center">
                            <Radio
                              checked={currentStatus === 'PRESENT'}
                              onChange={() => handleAttendanceStatusChange(item.client.id, 'PRESENT' as 'PRESENT' | 'ABSENT' | 'EXCUSED')}
                              value="PRESENT"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Radio
                              checked={currentStatus === 'ABSENT'}
                              onChange={() => handleAttendanceStatusChange(item.client.id, 'ABSENT' as 'PRESENT' | 'ABSENT' | 'EXCUSED')}
                              value="ABSENT"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Radio
                              checked={currentStatus === 'EXCUSED'}
                              onChange={() => handleAttendanceStatusChange(item.client.id, 'EXCUSED' as 'PRESENT' | 'ABSENT' | 'EXCUSED')}
                              value="EXCUSED"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              fullWidth
                              placeholder="Примечания"
                              value={item.attendance?.notes || ''}
                              onChange={(e) => {
                                setAttendanceData(prev =>
                                  prev.map(att => {
                                    if (att.client.id === item.client.id) {
                                      return {
                                        ...att,
                                        attendance: {
                                          ...(att.attendance || {
                                            id: '',
                                            status: 'ABSENT' as 'PRESENT' | 'ABSENT' | 'EXCUSED',
                                            clientId: item.client.id,
                                            trainingId: selectedTraining?.id || '',
                                            createdAt: new Date().toISOString(),
                                            updatedAt: new Date().toISOString()
                                          } as Attendance),
                                          notes: e.target.value
                                        } as Attendance
                                      };
                                    }
                                    return att;
                                  })
                                );
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setAttendanceDialog(false);
              setSelectedTraining(null);
              setAttendanceData([]);
            }}>Отмена</Button>
            <Button onClick={handleSaveAttendance} variant="contained" disabled={attendanceData.length === 0}>
              Сохранить посещаемость
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Schedule;
