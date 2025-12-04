import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Link,
  ToggleButton,
  ToggleButtonGroup,
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
  Delete,
  Remove,
  EmojiEvents,
  ChevronLeft,
  ChevronRight,
  MeetingRoom,
  Person,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import { Training, Group, Branch, Trainer, Client, Attendance, Competition, Hall } from '../types';

interface DaySchedule {
  dayOfWeek: number;
  startTime: Date | null;
  endTime: Date | null;
}

interface DateSchedule {
  date: Date;
  startTime: Date | null;
  endTime: Date | null;
}

interface TrainingFormData {
  title: string;
  description: string;
  date: Date | null;
  startTime: Date | null;
  endTime: Date | null;
  groupId: string;
  trainerId: string;
  branchId: string;
  hallId: string;
  isRecurring: boolean;
  recurrence: string;
  daysOfWeek: number[];
  recurrenceStartDate: Date | null;
  recurrenceEndDate: Date | null;
  recurrenceMode: 'days' | 'dates'; // 'days' - по дням недели, 'dates' - по конкретным датам
  daySchedules: DaySchedule[]; // Расписание по дням недели
  dateSchedules: DateSchedule[]; // Расписание по конкретным датам
}

const Schedule: React.FC = () => {
  const navigate = useNavigate();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [attendanceDialog, setAttendanceDialog] = useState(false);
  const [competitionDialog, setCompetitionDialog] = useState(false);
  const [createClientDialog, setCreateClientDialog] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [attendanceData, setAttendanceData] = useState<Array<{client: Client, attendance: Attendance | null}>>([]);
  const [clientFormData, setClientFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    phone: '',
  });
  const [clientFormErrors, setClientFormErrors] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDayForTraining, setSelectedDayForTraining] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [filterBranchId, setFilterBranchId] = useState<string>('');
  const [filterHallId, setFilterHallId] = useState<string>('');
  const [filterTrainerId, setFilterTrainerId] = useState<string>('');
  const [defaultTrainingDuration, setDefaultTrainingDuration] = useState<number>(60); // Длительность тренировки в минутах по умолчанию
  const [isSubmitting, setIsSubmitting] = useState(false); // Защита от двойного нажатия при создании тренировки
  const [formData, setFormData] = useState<TrainingFormData>({
    title: '',
    description: '',
    date: new Date(),
    startTime: null,
    endTime: null,
    groupId: '',
    trainerId: '',
    branchId: '',
    hallId: '',
    isRecurring: false,
    recurrence: 'weekly',
    daysOfWeek: [],
    recurrenceStartDate: new Date(),
    recurrenceEndDate: null,
    recurrenceMode: 'days',
    daySchedules: [],
    dateSchedules: []
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [trainingsRes, groupsRes, trainersRes, branchesRes] = await Promise.all([
        apiService.getTrainings({ limit: 1000, page: 1 }), // Загружаем до 1000 тренировок
        apiService.getGroups({ limit: 1000, page: 1 }), // Загружаем все группы
        apiService.getTrainers({ limit: 1000, page: 1 }),
        apiService.getBranches({ limit: 1000, page: 1 })
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
        
        // Автоматически удаляем дубликаты тренировок при загрузке
        try {
          const duplicateResult = await apiService.removeDuplicateTrainings();
          if (duplicateResult?.removedCount > 0) {
            console.log(`Автоматически удалено ${duplicateResult.removedCount} дублирующихся тренировок`);
          }
        } catch (duplicateError) {
          // Игнорируем ошибки удаления дубликатов, продолжаем загрузку
          console.warn('Не удалось проверить дубликаты тренировок:', duplicateError);
        }
        
        if (!isMounted || abortController.signal.aborted) return;
        
        const [trainingsRes, competitionsRes, groupsRes, trainersRes, branchesRes, hallsRes, settingsRes] = await Promise.all([
          apiService.getTrainings({ limit: 1000, page: 1 }, abortController.signal), // Загружаем до 1000 тренировок
          apiService.getCompetitions({ limit: 1000, page: 1 }, abortController.signal), // Загружаем до 1000 соревнований
          apiService.getGroups({ limit: 1000, page: 1 }, abortController.signal), // Загружаем все группы
          apiService.getTrainers({ limit: 1000, page: 1 }, abortController.signal),
          apiService.getBranches({ limit: 1000, page: 1 }, abortController.signal),
          apiService.getHalls({ limit: 1000, page: 1 }, abortController.signal).catch(() => ({ data: [], pagination: {} })),
          apiService.getSettings().catch(() => null) // Загружаем настройки, игнорируем ошибки если нет настроек
        ]);
        
        if (!isMounted || abortController.signal.aborted) return;
        setTrainings(trainingsRes.data);
        setCompetitions(competitionsRes.data);
        setGroups(groupsRes.data);
        setTrainers(trainersRes.data);
        setBranches(branchesRes.data);
        setHalls(hallsRes.data || []);
        
        // Устанавливаем длительность тренировки по умолчанию из настроек
        if (settingsRes?.data?.defaultTrainingDuration) {
          setDefaultTrainingDuration(settingsRes.data.defaultTrainingDuration);
        }
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
    // Защита от двойного нажатия
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      
      // Проверка обязательных полей
      if (!formData.title || !formData.title.trim()) {
        alert('Пожалуйста, укажите название тренировки');
        return;
      }
      if (!formData.groupId) {
        alert('Пожалуйста, выберите группу');
        return;
      }
      if (!formData.trainerId) {
        alert('Пожалуйста, выберите тренера');
        return;
      }
      if (!formData.branchId) {
        alert('Пожалуйста, выберите филиал');
        return;
      }

      // Для нерегулярных тренировок проверяем дату и время
      if (!formData.isRecurring) {
      if (!formData.startTime || !formData.endTime || !formData.date) {
        alert('Пожалуйста, выберите дату, время начала и окончания');
        return;
      }
      }

      if (formData.isRecurring) {
        if (formData.recurrenceMode === 'days') {
          if (formData.daySchedules.length === 0) {
            alert('Пожалуйста, добавьте хотя бы один день недели с расписанием');
        return;
      }
          // Проверяем, что для всех дней задано время
          for (const daySchedule of formData.daySchedules) {
            if (!daySchedule.startTime || !daySchedule.endTime) {
              alert(`Пожалуйста, укажите время для всех выбранных дней недели`);
              return;
            }
          }
          if (!formData.recurrenceStartDate || !formData.recurrenceEndDate) {
            alert('Пожалуйста, выберите дату начала и окончания регулярных тренировок');
            return;
          }
          if (formData.recurrenceEndDate < formData.recurrenceStartDate) {
            alert('Дата окончания не может быть раньше даты начала');
            return;
          }
        } else if (formData.recurrenceMode === 'dates') {
          if (formData.dateSchedules.length === 0) {
            alert('Пожалуйста, добавьте хотя бы одну дату с расписанием');
            return;
          }
          // Проверяем, что для всех дат задано время
          for (const dateSchedule of formData.dateSchedules) {
            if (!dateSchedule.startTime || !dateSchedule.endTime) {
              alert(`Пожалуйста, укажите время для всех выбранных дат`);
              return;
            }
          }
        }
      }

      // Базовые данные для тренировки
      const trainingData = {
        title: formData.title,
        description: formData.description,
        groupId: formData.groupId,
        trainerId: formData.trainerId,
        branchId: formData.branchId,
        hallId: formData.hallId || undefined,
        isRecurring: formData.isRecurring,
        recurrence: formData.recurrence,
        daysOfWeek: formData.daysOfWeek
      };

      if (formData.isRecurring) {
        const trainings = [];
        
        if (formData.recurrenceMode === 'days') {
          // Create trainings by days of week
          const startDate = new Date(formData.recurrenceStartDate!);
          startDate.setHours(0, 0, 0, 0); // Сбрасываем время до начала дня
          
          const endDate = new Date(formData.recurrenceEndDate!);
          endDate.setHours(23, 59, 59, 999); // Устанавливаем время до конца дня
          
          // Iterate through each day in the date range
          const currentDate = new Date(startDate);
          currentDate.setHours(0, 0, 0, 0);
          
          // Создаем массив для отслеживания созданных тренировок (для отладки)
          let createdCount = 0;
          
          while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            
            // Find schedule for this day of week
            const daySchedule = formData.daySchedules.find(ds => ds.dayOfWeek === dayOfWeek);
            if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
              const trainingDate = new Date(currentDate);
              trainingDate.setHours(0, 0, 0, 0); // Сбрасываем время для даты тренировки
            
            const recurringStartTime = new Date(trainingDate);
              recurringStartTime.setHours(daySchedule.startTime.getHours(), daySchedule.startTime.getMinutes(), 0, 0);
            
            const recurringEndTime = new Date(trainingDate);
              recurringEndTime.setHours(daySchedule.endTime.getHours(), daySchedule.endTime.getMinutes(), 0, 0);

            trainings.push({
              ...trainingData,
              startTime: recurringStartTime.toISOString(),
              endTime: recurringEndTime.toISOString()
            });
              createdCount++;
            }
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          console.log(`Создано тренировок: ${createdCount} из диапазона ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
        } else if (formData.recurrenceMode === 'dates') {
          // Create trainings by specific dates
          for (const dateSchedule of formData.dateSchedules) {
            if (dateSchedule.startTime && dateSchedule.endTime) {
              const trainingDate = new Date(dateSchedule.date);
              
              const recurringStartTime = new Date(trainingDate);
              recurringStartTime.setHours(dateSchedule.startTime.getHours(), dateSchedule.startTime.getMinutes());
              
              const recurringEndTime = new Date(trainingDate);
              recurringEndTime.setHours(dateSchedule.endTime.getHours(), dateSchedule.endTime.getMinutes());

              trainings.push({
                ...trainingData,
                startTime: recurringStartTime.toISOString(),
                endTime: recurringEndTime.toISOString()
              });
            }
          }
        }
        
        // Create all recurring trainings
        for (const training of trainings) {
          await apiService.createTraining(training);
        }
      } else {
        // Create single training
        if (!formData.date || !formData.startTime || !formData.endTime) {
          alert('Пожалуйста, выберите дату, время начала и окончания');
          return;
        }
        
        const baseDate = formData.date;
        const startTime = new Date(baseDate);
        startTime.setHours(formData.startTime.getHours(), formData.startTime.getMinutes());
        
        const endTime = new Date(baseDate);
        endTime.setHours(formData.endTime.getHours(), formData.endTime.getMinutes());

        await apiService.createTraining({
          ...trainingData,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        });
      }

      await fetchData();
      setOpenDialog(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating training:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Не удалось создать тренировку';
      const errorDetails = error?.response?.data?.data;
      if (errorDetails && Array.isArray(errorDetails)) {
        const details = errorDetails.map((e: any) => `${e.field}: ${e.message}`).join('\n');
        alert(`Ошибка создания тренировки:\n${details}`);
      } else {
        alert(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
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
      hallId: '',
      isRecurring: false,
      recurrence: 'weekly',
      daysOfWeek: [],
      recurrenceStartDate: new Date(),
      recurrenceEndDate: null,
      recurrenceMode: 'days',
      daySchedules: [],
      dateSchedules: []
    });
    setEditingTraining(null);
  };

  const handleEditTraining = async (training: Training) => {
    setEditingTraining(training);
    const startDate = new Date(training.startTime);
    const endDate = new Date(training.endTime);
    
    // Если это регулярная тренировка, находим все тренировки серии для определения параметров
    let recurrenceStartDate = new Date();
    let recurrenceEndDate = null;
    let recurrenceMode: 'days' | 'dates' = 'days';
    let daySchedules: DaySchedule[] = [];
    let dateSchedules: DateSchedule[] = [];
    
    if (training.isRecurring) {
      try {
        const allTrainings = await apiService.getTrainings({ limit: 1000, page: 1 });
        const seriesTrainings = allTrainings.data.filter((t: Training) => 
          t.title === training.title &&
          t.groupId === training.groupId &&
          t.trainerId === training.trainerId &&
          t.branchId === training.branchId &&
          t.isRecurring &&
          !t.isCancelled
        );
        
        if (seriesTrainings.length > 0) {
          // Находим минимальную и максимальную даты
          const dates = seriesTrainings.map(t => new Date(t.startTime));
          dates.sort((a, b) => a.getTime() - b.getTime());
          recurrenceStartDate = dates[0];
          recurrenceEndDate = dates[dates.length - 1];
          
          // Определяем дни недели и время для каждого дня
          const dayMap = new Map<number, { startTime: Date; endTime: Date }>();
          seriesTrainings.forEach(t => {
            const date = new Date(t.startTime);
            const dayOfWeek = date.getDay();
            const start = new Date(t.startTime);
            const end = new Date(t.endTime);
            
            if (!dayMap.has(dayOfWeek)) {
              dayMap.set(dayOfWeek, { startTime: start, endTime: end });
            }
          });
          
          // Создаем daySchedules
          daySchedules = Array.from(dayMap.entries()).map(([dayOfWeek, times]) => ({
            dayOfWeek,
            startTime: times.startTime,
            endTime: times.endTime
          }));
          
          recurrenceMode = 'days';
        }
      } catch (error) {
        console.error('Error loading series trainings:', error);
      }
    }
    
    setFormData({
      title: training.title || '',
      description: training.description || '',
      date: startDate,
      startTime: startDate,
      endTime: endDate,
      groupId: training.groupId || '',
      trainerId: training.trainerId || '',
      branchId: training.branchId || '',
      hallId: training.hallId || '',
      isRecurring: training.isRecurring || false,
      recurrence: training.recurrence || 'weekly',
      daysOfWeek: daySchedules.map(ds => ds.dayOfWeek),
      recurrenceStartDate,
      recurrenceEndDate,
      recurrenceMode,
      daySchedules,
      dateSchedules
    });
    
    // Загружаем залы для филиала тренировки
    if (training.branchId) {
      try {
        const hallsRes = await apiService.getHalls({ branchId: training.branchId });
        setHalls(hallsRes.data);
      } catch (err) {
        console.error('Error fetching halls:', err);
        setHalls([]);
      }
    }
    
    setEditDialog(true);
  };

  const handleUpdateTraining = async () => {
    if (!editingTraining) return;

    try {
      // Для нерегулярных тренировок проверяем дату и время
      if (!formData.isRecurring) {
      if (!formData.startTime || !formData.endTime || !formData.date) {
        alert('Пожалуйста, выберите дату, время начала и окончания');
        return;
      }
      }

      if (formData.isRecurring) {
        if (formData.recurrenceMode === 'days') {
          if (formData.daySchedules.length === 0) {
            alert('Пожалуйста, добавьте хотя бы один день недели с расписанием');
            return;
          }
          // Проверяем, что для всех дней задано время
          for (const daySchedule of formData.daySchedules) {
            if (!daySchedule.startTime || !daySchedule.endTime) {
              alert(`Пожалуйста, укажите время для всех выбранных дней недели`);
              return;
            }
          }
          if (!formData.recurrenceStartDate || !formData.recurrenceEndDate) {
            alert('Пожалуйста, выберите дату начала и окончания регулярных тренировок');
            return;
          }
          if (formData.recurrenceEndDate < formData.recurrenceStartDate) {
            alert('Дата окончания не может быть раньше даты начала');
            return;
          }
        } else if (formData.recurrenceMode === 'dates') {
          if (formData.dateSchedules.length === 0) {
            alert('Пожалуйста, добавьте хотя бы одну дату с расписанием');
            return;
          }
          // Проверяем, что для всех дат задано время
          for (const dateSchedule of formData.dateSchedules) {
            if (!dateSchedule.startTime || !dateSchedule.endTime) {
              alert(`Пожалуйста, укажите время для всех выбранных дат`);
              return;
            }
          }
        }
      }

      // Если тренировка становится регулярной или уже регулярная
      if (formData.isRecurring) {
        // Если редактируем регулярную тренировку - удаляем всю серию и создаем заново
        if (editingTraining.isRecurring) {
          // Находим и удаляем все тренировки из серии
          const allTrainings = await apiService.getTrainings({ limit: 1000, page: 1 });
          const seriesTrainings = allTrainings.data.filter((t: Training) => 
            t.title === editingTraining.title &&
            t.groupId === editingTraining.groupId &&
            t.trainerId === editingTraining.trainerId &&
            t.branchId === editingTraining.branchId &&
            t.isRecurring &&
            !t.isCancelled
          );
          
          // Удаляем все тренировки из серии
          for (const t of seriesTrainings) {
            await apiService.deleteTraining(t.id);
          }
        } else {
          // Если нерегулярная тренировка становится регулярной - удаляем старую
          await apiService.deleteTraining(editingTraining.id);
        }
        
        // Создаем новые регулярные тренировки
        const trainingData = {
          title: formData.title,
          description: formData.description,
          groupId: formData.groupId,
          trainerId: formData.trainerId,
          branchId: formData.branchId,
          hallId: formData.hallId || undefined,
          isRecurring: true,
          recurrence: formData.recurrence,
          daysOfWeek: formData.daysOfWeek
        };

        const trainings = [];
        
        if (formData.recurrenceMode === 'days') {
          const startDate = new Date(formData.recurrenceStartDate!);
          startDate.setHours(0, 0, 0, 0); // Сбрасываем время до начала дня
          
          const endDate = new Date(formData.recurrenceEndDate!);
          endDate.setHours(23, 59, 59, 999); // Устанавливаем время до конца дня
          
          const currentDate = new Date(startDate);
          currentDate.setHours(0, 0, 0, 0);
          
          while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            const daySchedule = formData.daySchedules.find(ds => ds.dayOfWeek === dayOfWeek);
            if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
              const trainingDate = new Date(currentDate);
              trainingDate.setHours(0, 0, 0, 0); // Сбрасываем время для даты тренировки
              
              const recurringStartTime = new Date(trainingDate);
              recurringStartTime.setHours(daySchedule.startTime.getHours(), daySchedule.startTime.getMinutes(), 0, 0);
              
              const recurringEndTime = new Date(trainingDate);
              recurringEndTime.setHours(daySchedule.endTime.getHours(), daySchedule.endTime.getMinutes(), 0, 0);

              trainings.push({
                ...trainingData,
                startTime: recurringStartTime.toISOString(),
                endTime: recurringEndTime.toISOString()
              });
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } else if (formData.recurrenceMode === 'dates') {
          for (const dateSchedule of formData.dateSchedules) {
            if (dateSchedule.date && dateSchedule.startTime && dateSchedule.endTime) {
              const trainingDate = new Date(dateSchedule.date);
              
              const recurringStartTime = new Date(trainingDate);
              recurringStartTime.setHours(dateSchedule.startTime.getHours(), dateSchedule.startTime.getMinutes());
              
              const recurringEndTime = new Date(trainingDate);
              recurringEndTime.setHours(dateSchedule.endTime.getHours(), dateSchedule.endTime.getMinutes());

              trainings.push({
                ...trainingData,
                startTime: recurringStartTime.toISOString(),
                endTime: recurringEndTime.toISOString()
              });
            }
          }
        }

        // Create all recurring trainings
        for (const training of trainings) {
          await apiService.createTraining(training);
        }
      } else {
        // Обновляем одну нерегулярную тренировку
        if (!formData.date || !formData.startTime || !formData.endTime) {
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
        hallId: formData.hallId || undefined,
          isRecurring: false,
          recurrence: null
        };

        // Если редактируем регулярную тренировку, которая становится нерегулярной
        if (editingTraining.isRecurring) {
          // Находим и удаляем все тренировки из серии
          const allTrainings = await apiService.getTrainings({ limit: 1000, page: 1 });
          const seriesTrainings = allTrainings.data.filter((t: Training) => 
            t.title === editingTraining.title &&
            t.groupId === editingTraining.groupId &&
            t.trainerId === editingTraining.trainerId &&
            t.branchId === editingTraining.branchId &&
            t.isRecurring &&
            !t.isCancelled
          );
          
          // Удаляем все тренировки из серии
          for (const t of seriesTrainings) {
            if (t.id !== editingTraining.id) {
              await apiService.deleteTraining(t.id);
            }
          }
        }

      await apiService.updateTraining(editingTraining.id, trainingData);
      }

      await fetchData();
      setEditDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error updating training:', error);
      alert('Не удалось обновить тренировку');
    }
  };

  const handleDeleteTraining = async (training: Training) => {
    if (!window.confirm(`Вы уверены, что хотите удалить тренировку "${training.title}"?`)) {
      return;
    }

    try {
      await apiService.deleteTraining(training.id);
      // Сразу обновляем локальное состояние, чтобы тренировка исчезла из интерфейса
      setTrainings(prevTrainings => prevTrainings.filter(t => t.id !== training.id));
      alert('Тренировка успешно удалена');
    } catch (error) {
      console.error('Error deleting training:', error);
      alert('Не удалось удалить тренировку');
      // В случае ошибки обновляем данные с сервера
      await fetchData();
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
          // Определяем shouldCharge по умолчанию
          // Логика: shouldCharge=true означает НЕ списывать средства (галочка стоит)
          let shouldCharge = false;
          if (status === 'EXCUSED') {
            shouldCharge = true; // По умолчанию для уважительной причины галочка стоит (не списываем)
          } else if (status === 'ABSENT') {
            shouldCharge = false; // По умолчанию для пропуска без причины галочка не стоит (списываем)
          }

          if (item.attendance) {
            return {
              ...item,
              attendance: {
                ...item.attendance,
                status: status as 'PRESENT' | 'ABSENT' | 'EXCUSED',
                shouldCharge: item.attendance.shouldCharge !== undefined ? item.attendance.shouldCharge : shouldCharge
              } as Attendance
            };
          } else {
            return {
              ...item,
              attendance: {
                id: '',
                status: status as 'PRESENT' | 'ABSENT' | 'EXCUSED',
                notes: '',
                shouldCharge: shouldCharge,
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

  const handleShouldChargeChange = (clientId: string, shouldCharge: boolean) => {
    setAttendanceData(prev => 
      prev.map(item => {
        if (item.client.id === clientId) {
          if (item.attendance) {
            return {
              ...item,
              attendance: {
                ...item.attendance,
                shouldCharge: shouldCharge
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
      const attendances = attendanceData.map(item => {
        const status = item.attendance?.status || 'ABSENT';
        // Определяем shouldCharge по умолчанию
        let defaultShouldCharge = false;
        if (status === 'EXCUSED') {
          defaultShouldCharge = true; // По умолчанию для EXCUSED галочка стоит
        } else if (status === 'ABSENT') {
          defaultShouldCharge = false; // По умолчанию для ABSENT галочка не стоит
        }
        return {
        clientId: item.client.id,
          status: status,
          notes: item.attendance?.notes || '',
          shouldCharge: item.attendance?.shouldCharge !== undefined ? item.attendance.shouldCharge : defaultShouldCharge
        };
      });

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

  const handleCreateClient = async () => {
    if (!selectedTraining) return;

    // Validate required fields
    const errors: Record<string, string> = {};
    if (!clientFormData.firstName || clientFormData.firstName.trim().length < 2) {
      errors.firstName = 'Имя обязательно (минимум 2 символа)';
    }
    if (!clientFormData.lastName || clientFormData.lastName.trim().length < 2) {
      errors.lastName = 'Фамилия обязательна (минимум 2 символа)';
    }
    
    if (Object.keys(errors).length > 0) {
      setClientFormErrors(errors);
      return;
    }

    try {
      // Create client
      const newClient = await apiService.createClient({
        firstName: clientFormData.firstName.trim(),
        lastName: clientFormData.lastName.trim(),
        middleName: clientFormData.middleName?.trim() || '',
        phone: clientFormData.phone?.trim() || '',
      });

      // Automatically add client to the group from the training
      if (selectedTraining.groupId) {
        await apiService.addClientToGroup(selectedTraining.groupId, newClient.id);
      }

      // Refresh attendance data
      const response = await apiService.getAttendancesByTraining(selectedTraining.id);
      setAttendanceData(response.clients || []);

      // Close dialog and reset form
      setCreateClientDialog(false);
      setClientFormData({
        firstName: '',
        lastName: '',
        middleName: '',
        phone: '',
      });
      setClientFormErrors({});
      
      alert('Клиент создан и добавлен в группу');
    } catch (error: any) {
      console.error('Error creating client:', error);
      alert(error.response?.data?.error || 'Не удалось создать клиента');
    }
  };

  // Helper function to check if color is light
  const isColorLight = (color: string): boolean => {
    if (!color) return false;
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
  };

  // Helper function to add default duration to start time
  const addDefaultDuration = (startTime: Date | null): Date | null => {
    if (!startTime) return null;
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + defaultTrainingDuration);
    return endTime;
  };

  const getCompetitionsForDate = (date: Date): Competition[] => {
    return competitions.filter((competition: Competition) => {
      const startDate = new Date(competition.startDate);
      const endDate = new Date(competition.endDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate >= startDate && checkDate <= endDate;
    });
  };

  const getTrainingsForDate = (date: Date) => {
    let filtered = trainings.filter(training => 
      !training.isCancelled && isSameDay(new Date(training.startTime), date)
    );
    
    // Применяем фильтры
    if (filterBranchId) {
      filtered = filtered.filter(t => t.branchId === filterBranchId);
    }
    if (filterHallId) {
      filtered = filtered.filter(t => t.hallId === filterHallId);
    }
    if (filterTrainerId) {
      filtered = filtered.filter(t => t.trainerId === filterTrainerId);
    }
    
    return filtered;
  };

  // Получить все тренировки для недели (для недельного вида)
  const getTrainingsForWeek = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(23, 59, 59, 999);
    
    let filtered = trainings.filter(training => {
      if (training.isCancelled) return false;
      const trainingDate = new Date(training.startTime);
      return trainingDate >= weekStart && trainingDate <= weekEnd;
    });
    
    // Применяем фильтры
    if (filterBranchId) {
      filtered = filtered.filter(t => t.branchId === filterBranchId);
    }
    if (filterHallId) {
      filtered = filtered.filter(t => t.hallId === filterHallId);
    }
    if (filterTrainerId) {
      filtered = filtered.filter(t => t.trainerId === filterTrainerId);
    }
    
    return filtered;
  };

  // Генерация временных слотов (с 8:00 до 22:00)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 22; hour++) {
      slots.push(hour);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Группировать тренировки по времени начала для отображения в одну строку
  // Проверка, пересекаются ли два временных интервала
  const doTimeIntervalsOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
    return start1 < end2 && start2 < end1;
  };

  const groupTrainingsByTime = (trainings: Training[], day: Date) => {
    // Фильтруем тренировки для этого дня
    const dayTrainings = trainings.filter(training => {
      const start = new Date(training.startTime);
      return isSameDay(start, day);
    });
    
    // Создаем граф пересечений (транзитивное замыкание)
    const groups: Training[][] = [];
    const processed = new Set<string>();
    
    dayTrainings.forEach(training => {
      if (processed.has(training.id)) return;
      
      // Находим все тренировки, которые пересекаются с текущей (включая транзитивные)
      const overlappingGroup: Training[] = [];
      const toProcess = [training];
      
      while (toProcess.length > 0) {
        const current = toProcess.pop()!;
        if (processed.has(current.id)) continue;
        
        overlappingGroup.push(current);
        processed.add(current.id);
        
        const currentStart = new Date(current.startTime);
        const currentEnd = new Date(current.endTime);
        
        // Находим все тренировки, которые пересекаются с текущей
        dayTrainings.forEach(otherTraining => {
          if (processed.has(otherTraining.id)) return;
          
          const otherStart = new Date(otherTraining.startTime);
          const otherEnd = new Date(otherTraining.endTime);
          
          if (doTimeIntervalsOverlap(currentStart, currentEnd, otherStart, otherEnd)) {
            toProcess.push(otherTraining);
          }
        });
      }
      
      // Сортируем группу по времени начала
      overlappingGroup.sort((a, b) => {
        const aStart = new Date(a.startTime).getTime();
        const bStart = new Date(b.startTime).getTime();
        return aStart - bStart;
      });
      
      if (overlappingGroup.length > 0) {
        groups.push(overlappingGroup);
      }
    });
    
    // Преобразуем в формат, совместимый с существующим кодом
    const result: { [key: string]: Training[] } = {};
    groups.forEach((group, index) => {
      // Используем время начала первой тренировки в группе как ключ
      const firstTraining = group[0];
      const start = new Date(firstTraining.startTime);
      const timeKey = `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}_${index}`;
      result[timeKey] = group;
    });
    
    return result;
  };

  // Получить тренировки для конкретного дня и времени
  const getTrainingsForDayAndTime = (day: Date, hour: number) => {
    const dayStart = new Date(day);
    dayStart.setHours(hour, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(hour + 1, 0, 0, 0);
    
    return getTrainingsForWeek().filter(training => {
      const trainingStart = new Date(training.startTime);
      return trainingStart >= dayStart && trainingStart < dayEnd;
    });
  };

  // Вычислить реальную высоту часа на основе тренировок
  const getHourHeight = (hour: number): number => {
    let maxRowHeight = 60; // Базовая высота
    const weekTrainings = getTrainingsForWeek();
    
    weekTrainings.forEach(t => {
      const tStart = new Date(t.startTime);
      const tEnd = new Date(t.endTime);
      const startHour = tStart.getHours();
      const endHour = tEnd.getHours();
      
      // Проверяем, пересекается ли тренировка с этим часом
      // Тренировка пересекается с часом, если:
      // 1. Начинается в этом часу
      // 2. Заканчивается в этом часу
      // 3. Начинается до этого часа и заканчивается после этого часа
      const intersectsHour = (startHour === hour) || 
                             (endHour === hour) || 
                             (startHour < hour && endHour > hour);
      
      if (intersectsHour) {
        // Вычисляем, какая часть тренировки приходится на этот час
        let minutesInThisHour = 0;
        let isEndingInThisHour = false;
        
        if (startHour === hour && endHour === hour) {
          // Тренировка полностью в этом часу
          minutesInThisHour = (tEnd.getTime() - tStart.getTime()) / (1000 * 60);
        } else if (startHour === hour) {
          // Тренировка начинается в этом часу
          const hourEnd = new Date(tStart);
          hourEnd.setHours(hour + 1, 0, 0, 0);
          minutesInThisHour = (hourEnd.getTime() - tStart.getTime()) / (1000 * 60);
        } else if (endHour === hour) {
          // Тренировка заканчивается в этом часу
          const hourStart = new Date(tEnd);
          hourStart.setHours(hour, 0, 0, 0);
          minutesInThisHour = (tEnd.getTime() - hourStart.getTime()) / (1000 * 60);
          isEndingInThisHour = true;
        } else {
          // Тренировка полностью покрывает этот час
          minutesInThisHour = 60;
        }
        
        // Высота контента (примерно 5 строк по 14px + padding 12px)
        const contentHeight = 5 * 14 + 12;
        
        // Высота на основе длительности части тренировки в этом часу (60px за час)
        const durationHeight = (minutesInThisHour / 60) * 60;
        
        // Если тренировка заканчивается в этом часу, нужно убедиться, что высота
        // достаточна для размещения всего блока тренировки
        // Высота блока рассчитывается на основе контента, поэтому используем contentHeight
        let requiredHeight;
        if (isEndingInThisHour) {
          // Для тренировок, заканчивающихся в этом часу, высота должна быть достаточной
          // для размещения всего блока (контента), а не только части часа
          requiredHeight = Math.max(contentHeight, durationHeight) + 20; // Больший запас для окончания
        } else {
          // Для остальных случаев используем стандартный расчет
          requiredHeight = Math.max(durationHeight, contentHeight) + 15; // +15px запас
        }
        
        if (requiredHeight > maxRowHeight) {
          maxRowHeight = requiredHeight;
        }
      }
    });
    
    return maxRowHeight;
  };

  // Вычислить позицию и высоту блока тренировки
  const getTrainingBlockStyle = (training: Training, day: Date, overlappingTrainings: Training[] = []) => {
    const start = new Date(training.startTime);
    const end = new Date(training.endTime);
    const dayStart = new Date(day);
    dayStart.setHours(8, 0, 0, 0);
    
    // Проверяем, что тренировка в этот день
    if (!isSameDay(start, day)) {
      return { display: 'none' };
    }
    
    const startHour = start.getHours();
    const startMinutes = start.getMinutes();
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    
    // Вычисляем позицию top с учетом реальных высот строк
    let top = 0;
    for (let hour = 8; hour < startHour; hour++) {
      top += getHourHeight(hour);
    }
    // Добавляем позицию внутри часа (пропорционально минутам)
    const hourHeight = getHourHeight(startHour);
    top += (startMinutes / 60) * hourHeight;
    
    // Высота контента рассчитывается более точно
    // Элементы контента:
    // 1. Название зала (если несколько тренировок) - ~10px
    // 2. Название тренировки - ~16px
    // 3. Время - ~16px
    // 4. Название зала (если одна тренировка) - ~16px (опционально)
    // 5. Свободные места - ~16px
    // 6. Тренер с иконкой - ~20px
    // Padding: 12px (0.75 * 16px) сверху и снизу = 24px
    const hasHallLabel = overlappingTrainings.length > 1; // Показывается только если несколько тренировок
    const hasSingleHallLabel = overlappingTrainings.length === 1; // Показывается только если одна тренировка
    let contentHeight = 0;
    
    if (hasHallLabel) contentHeight += 10; // Название зала сверху
    contentHeight += 16; // Название тренировки
    contentHeight += 16; // Время
    if (hasSingleHallLabel) contentHeight += 16; // Название зала (если одна тренировка)
    contentHeight += 16; // Свободные места
    contentHeight += 20; // Тренер с иконкой
    contentHeight += 24; // Padding (12px сверху + 12px снизу)
    contentHeight += 4; // Небольшой запас для безопасности
    
    // Вычисляем минимальную высоту на основе длительности тренировки
    // Используем базовую высоту часа (60px) для расчета минимальной высоты
    const baseHourHeight = 60;
    const minHeightByDuration = (durationMinutes / 60) * baseHourHeight;
    
    // Высота блока должна быть достаточной для контента
    // Используем максимальную из: высота контента или минимальная по длительности
    const finalHeight = Math.max(contentHeight, minHeightByDuration);
    
    // Если есть пересекающиеся тренировки, размещаем их рядом
    const total = overlappingTrainings.length;
    if (total > 1) {
      // Находим индекс текущей тренировки в группе (сортируем по времени начала)
      const sorted = [...overlappingTrainings].sort((a, b) => {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
      const index = sorted.findIndex(t => t.id === training.id);
      
      // Вычисляем ширину и позицию с учетом отступов
      const gap = 4; // Отступ между блоками
      const totalGaps = (total - 1) * gap;
      const width = `calc((100% - ${totalGaps}px) / ${total})`;
      const left = index === 0 
        ? '2px' 
        : `calc(2px + ${index} * (${width} + ${gap}px))`;
      
      return {
        top: `${top}px`,
        height: `${finalHeight}px`,
        position: 'absolute' as const,
        width,
        left,
        zIndex: 1
      };
    } else {
      // Одна тренировка - занимает всю ширину
      return {
        top: `${top}px`,
        height: `${finalHeight}px`,
        position: 'absolute' as const,
        width: 'calc(100% - 4px)',
        left: '2px',
        zIndex: 1
      };
    }
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
    <LocalizationProvider 
      dateAdapter={AdapterDateFns} 
      adapterLocale={ru}
    >
      <Box data-onboarding="schedule-page">
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

        {/* Filters and View Toggle */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Филиал</InputLabel>
            <Select
                value={filterBranchId}
                onChange={(e) => setFilterBranchId(e.target.value)}
                label="Филиал"
            >
                <MenuItem value="">Все филиалы</MenuItem>
                {branches.filter(b => b.isActive).map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Зал</InputLabel>
            <Select
                value={filterHallId}
                onChange={(e) => setFilterHallId(e.target.value)}
                label="Зал"
            >
                <MenuItem value="">Все залы</MenuItem>
                {halls.filter(h => h.isActive && (!filterBranchId || h.branchId === filterBranchId)).map((hall) => (
                  <MenuItem key={hall.id} value={hall.id}>
                    {hall.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Тренер</InputLabel>
            <Select
              value={filterTrainerId}
              onChange={(e) => setFilterTrainerId(e.target.value)}
                label="Тренер"
            >
                <MenuItem value="">Все тренеры</MenuItem>
              {trainers.map((trainer) => (
                <MenuItem key={trainer.id} value={trainer.id}>
                  {trainer.user 
                      ? `${trainer.user.lastName} ${trainer.user.firstName.charAt(0)}.`
                    : `Тренер #${trainer.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          </Box>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => {
              if (newMode !== null) setViewMode(newMode);
              }}
            aria-label="view mode"
          >
            <ToggleButton value="day" aria-label="day view">
              День
            </ToggleButton>
            <ToggleButton value="week" aria-label="week view">
              Неделя
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Week Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <IconButton
            onClick={() => setSelectedDate(new Date(selectedDate.getTime() - 7 * 24 * 60 * 60 * 1000))}
            size="small"
          >
            <ChevronLeft />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
            {format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'd MMMM', { locale: ru })} {format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'EEE', { locale: ru })} - {format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'd MMMM', { locale: ru })} {format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'EEE', { locale: ru })}
          </Typography>
          <IconButton
            onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 7 * 24 * 60 * 60 * 1000))}
            size="small"
          >
            <ChevronRight />
          </IconButton>
        </Box>

        {/* Calendar Grid - Week View */}
        {viewMode === 'week' ? (
          <Paper sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
            <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
              {/* Time column */}
              <Box sx={{ width: 80, flexShrink: 0, borderRight: 1, borderColor: 'divider' }}>
                <Box sx={{ 
                  height: 60, 
                  borderBottom: 1, 
                  borderColor: 'divider', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  bgcolor: 'background.default'
                }}>
                  <Typography variant="caption" color="text.secondary">Время</Typography>
                </Box>
                {timeSlots.map((hour) => {
                  // Используем функцию getHourHeight для расчета высоты строки
                  const maxRowHeight = getHourHeight(hour);
                  
                  return (
                    <Box
                      key={hour}
                      sx={{
                        minHeight: maxRowHeight,
                        height: maxRowHeight, // Фиксированная высота для синхронизации
                        borderBottom: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'flex-end',
                        pr: 1,
                        pt: 0.5
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {hour}:00
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
              
              {/* Day columns */}
              {weekDays.map((day, dayIndex) => {
                const isToday = isSameDay(day, new Date());
                const dayTrainings = getTrainingsForDate(day);
                const dayCompetitions = getCompetitionsForDate(day);
                const groupedTrainings = groupTrainingsByTime(dayTrainings, day);
                
                return (
                  <Box
                    key={dayIndex}
                    sx={{
                      flex: 1,
                      minWidth: 150,
                      borderRight: dayIndex < weekDays.length - 1 ? 1 : 0,
                      borderColor: 'divider',
                      position: 'relative'
                    }}
                  >
                    {/* Day header */}
                    <Box
                      sx={{
                        height: 60,
                        borderBottom: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isToday ? 'action.selected' : 'background.default',
                        cursor: 'pointer',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        '&:hover': {
                          bgcolor: 'action.hover'
                        }
                      }}
                      onClick={() => {
                        setSelectedDayForTraining(day);
                        setFormData({ ...formData, date: day });
                        setOpenDialog(true);
                      }}
                    >
                      {/* Competitions in header */}
                      {dayCompetitions.length > 0 && (
                        <Box sx={{ position: 'absolute', top: 2, left: 2, right: 2 }}>
                          {dayCompetitions.map((competition) => (
                            <Chip
                              key={competition.id}
                              icon={<EmojiEvents sx={{ fontSize: 12 }} />}
                              label={competition.name}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.6rem',
                                bgcolor: 'warning.main',
                                color: '#fff',
                                mb: 0.5,
                                '& .MuiChip-label': {
                                  px: 0.5
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCompetition(competition);
                                setCompetitionDialog(true);
                              }}
                            />
                          ))}
                        </Box>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize', mt: dayCompetitions.length > 0 ? 2 : 0 }}>
                        {format(day, 'EEE', { locale: ru })}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: isToday ? 'bold' : 'normal' }}>
                        {format(day, 'd')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'lowercase' }}>
                        {format(day, 'MMMM', { locale: ru })}
                      </Typography>
                    </Box>
                    
                    {/* Time slots container */}
                    <Box sx={{ position: 'relative', minHeight: timeSlots.length * 60 }}>
                      {/* Hour lines - только для визуального разделения */}
                      {timeSlots.map((hour) => {
                        // Используем функцию getHourHeight для расчета высоты строки
                        const maxRowHeight = getHourHeight(hour);
                        
                        return (
                          <Box
                            key={hour}
                            sx={{
                              minHeight: maxRowHeight,
                              height: maxRowHeight, // Фиксированная высота для синхронизации
                              borderBottom: 1,
                              borderColor: 'divider',
                              position: 'relative'
                            }}
                          />
                        );
                      })}
                      
                      {/* Training blocks grouped by time */}
                      {Object.entries(groupedTrainings).map(([timeKey, timeTrainings]) => {
                        return timeTrainings.map((training) => {
                          const group = groups.find(g => g.id === training.groupId);
                          const trainer = trainers.find(t => t.id === training.trainerId);
                          const hall = halls.find(h => h.id === training.hallId);
                          const branch = branches.find(b => b.id === training.branchId);
                          const groupColor = group?.color || '#1976d2';
                          const isLightColor = isColorLight(groupColor);
                          const style = getTrainingBlockStyle(training, day, timeTrainings);
                          const startTime = format(new Date(training.startTime), 'HH:mm');
                          const endTime = format(new Date(training.endTime), 'HH:mm');
                          const trainerName = trainer?.user 
                            ? `${trainer.user.lastName} ${trainer.user.firstName.charAt(0)}.`
                            : 'Тренер';
                          const availableSpots = group?.maxMembers ? group.maxMembers : '?';
                          
                          return (
                            <Paper
                              key={training.id}
                              sx={{
                                ...style,
                                p: 0.75,
                                bgcolor: groupColor,
                                color: isLightColor ? '#000' : '#fff',
                                cursor: 'pointer',
                                borderRadius: 1,
                                boxShadow: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                boxSizing: 'border-box',
                                overflow: 'hidden', // Предотвращаем выход контента за границы
                                '&:hover': {
                                  boxShadow: 3,
                                  zIndex: 2
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAttendanceDialog(training);
                              }}
                            >
                              {/* Hall label at the top */}
                              {(hall || branch) && timeTrainings.length > 1 && (
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    display: 'block', 
                                    fontSize: '0.6rem', 
                                    fontWeight: 'bold',
                                    mb: 0.25,
                                    opacity: 0.9
                                  }}
                                >
                                  {hall ? hall.name : branch?.name}
                                </Typography>
                              )}
                              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', fontSize: '0.7rem' }}>
                                {training.title}
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', mt: 0.25 }}>
                                {startTime}-{endTime}
                              </Typography>
                              {hall && timeTrainings.length === 1 && (
                                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', mt: 0.25 }}>
                                  {hall.name}
                                </Typography>
                              )}
                              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', mt: 0.25 }}>
                                Свободно {availableSpots} мест
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, gap: 0.25 }}>
                                <People sx={{ fontSize: 10 }} />
                                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                                  {trainerName}
                                </Typography>
                              </Box>
                            </Paper>
                          );
                        });
                      })}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        ) : (
          /* Day View - пока оставляем старый вид */
        <Grid container spacing={1}>
          {weekDays.map((day, index) => {
            const dayTrainings = getTrainingsForDate(day);
            const dayCompetitions = getCompetitionsForDate(day);
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
                      {dayTrainings.map((training) => {
                        const group = groups.find(g => g.id === training.groupId);
                        const groupColor = group?.color || '#1976d2';
                        const isLightColor = isColorLight(groupColor);
                        
                        return (
                        <ListItem key={training.id} sx={{ p: 0, mb: 0.5 }}>
                          <Paper 
                            sx={{ 
                              p: 1, 
                              width: '100%', 
                              bgcolor: groupColor,
                              color: isLightColor ? '#000' : '#fff',
                              cursor: 'pointer',
                              '&:hover': {
                                opacity: 0.9,
                                transform: 'scale(1.02)',
                                transition: 'all 0.2s'
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAttendanceDialog(training);
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
                          </Paper>
                        </ListItem>
                      );
                      })}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
        )}

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
              
              {/* Recurring Training Checkbox - moved to top */}
              <Grid item xs={12}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'background.default' }}>
                  <FormControl>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Checkbox
                        checked={formData.isRecurring}
                        onChange={(e) => {
                          const isRecurring = e.target.checked;
                          setFormData({ 
                            ...formData, 
                            isRecurring,
                            // Сбрасываем расписания при переключении
                            daySchedules: isRecurring ? formData.daySchedules : [],
                            dateSchedules: isRecurring ? formData.dateSchedules : []
                          });
                        }}
                      />
                      <Typography variant="subtitle1" fontWeight="medium">
                        Создать регулярную тренировку
                      </Typography>
                    </Box>
                  </FormControl>
                </Box>
              </Grid>

              {/* Показываем эти поля только если НЕ регулярная тренировка */}
              {!formData.isRecurring && (
                <>
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
                      views={['year', 'month', 'day']}
                      openTo="day"
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
                </>
              )}
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
                        {trainer.user ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim() : `Тренер #${trainer.id}`}
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
                    onChange={async (e) => {
                      const branchId = e.target.value;
                      setFormData({ ...formData, branchId, hallId: '' }); // Сбрасываем зал при смене филиала
                      // Загружаем залы для выбранного филиала
                      if (branchId) {
                        try {
                          const hallsRes = await apiService.getHalls({ branchId });
                          setHalls(hallsRes.data);
                        } catch (err) {
                          console.error('Error fetching halls:', err);
                          setHalls([]);
                        }
                      } else {
                        setHalls([]);
                      }
                    }}
                  >
                    {branches.map((branch) => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Зал (необязательно)</InputLabel>
                  <Select
                    value={formData.hallId}
                    onChange={(e) => setFormData({ ...formData, hallId: e.target.value })}
                    disabled={!formData.branchId}
                  >
                    <MenuItem value="">
                      <em>Не выбран</em>
                    </MenuItem>
                    {halls.filter(h => h.isActive).map((hall) => (
                      <MenuItem key={hall.id} value={hall.id}>
                        {hall.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Recurring Training Settings */}
              {formData.isRecurring && (
              <Grid item xs={12}>
                  <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'rgba(25, 118, 210, 0.05)' }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                    Настройки регулярных тренировок
                  </Typography>
                  
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      {/* Mode Selection */}
                    <Grid item xs={12}>
                      <FormControl>
                          <RadioGroup
                            row
                            value={formData.recurrenceMode}
                            onChange={(e) => {
                              const mode = e.target.value as 'days' | 'dates';
                              setFormData({ 
                                ...formData, 
                                recurrenceMode: mode,
                                daySchedules: mode === 'days' ? formData.daySchedules : [],
                                dateSchedules: mode === 'dates' ? formData.dateSchedules : []
                              });
                            }}
                          >
                            <FormControlLabel value="days" control={<Radio />} label="По дням недели" />
                            <FormControlLabel value="dates" control={<Radio />} label="По конкретным датам" />
                          </RadioGroup>
                      </FormControl>
                    </Grid>
                    
                      {/* Mode: Days of Week */}
                      {formData.recurrenceMode === 'days' && (
                        <>
                          <Grid item xs={12} sm={6}>
                            <DatePicker
                              label="Дата начала регулярных тренировок"
                              value={formData.recurrenceStartDate}
                              onChange={(newValue) => setFormData({ ...formData, recurrenceStartDate: newValue })}
                              slotProps={{
                                textField: {
                                  fullWidth: true
                                }
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <DatePicker
                              label="Дата окончания регулярных тренировок"
                              value={formData.recurrenceEndDate}
                              onChange={(newValue) => setFormData({ ...formData, recurrenceEndDate: newValue })}
                              slotProps={{
                                textField: {
                                  fullWidth: true
                                }
                              }}
                            />
                          </Grid>
                          
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" gutterBottom>
                              Добавьте дни недели с расписанием:
                          </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {[
                                { value: 0, label: 'Воскресенье' },
                                { value: 1, label: 'Понедельник' },
                                { value: 2, label: 'Вторник' },
                                { value: 3, label: 'Среда' },
                                { value: 4, label: 'Четверг' },
                                { value: 5, label: 'Пятница' },
                                { value: 6, label: 'Суббота' }
                              ].map((day) => {
                                const daySchedule = formData.daySchedules.find(ds => ds.dayOfWeek === day.value);
                                const isSelected = !!daySchedule;
                                
                                return (
                                  <Paper key={day.value} sx={{ p: 2, border: isSelected ? '2px solid' : '1px solid', borderColor: isSelected ? 'primary.main' : 'divider' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                      <Checkbox
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            // Add day schedule
                                            const defaultTime = formData.startTime || new Date();
                                            defaultTime.setHours(10, 0);
                                            const defaultEndTime = formData.endTime || new Date();
                                            defaultEndTime.setHours(11, 0);
                                            
                                            setFormData({
                                              ...formData,
                                              daySchedules: [
                                                ...formData.daySchedules,
                                                {
                                                  dayOfWeek: day.value,
                                                  startTime: new Date(defaultTime),
                                                  endTime: new Date(defaultEndTime)
                                                }
                                              ]
                                            });
                                          } else {
                                            // Remove day schedule
                                            setFormData({
                                              ...formData,
                                              daySchedules: formData.daySchedules.filter(ds => ds.dayOfWeek !== day.value)
                                            });
                                          }
                                        }}
                                      />
                                      <Typography sx={{ minWidth: 120 }}>{day.label}</Typography>
                                      {isSelected && daySchedule && (
                                        <>
                                          <TimePicker
                                            label="Начало"
                                            value={daySchedule.startTime}
                                            onChange={(newValue) => {
                                              const endTime = addDefaultDuration(newValue);
                                              setFormData({
                                                ...formData,
                                                daySchedules: formData.daySchedules.map(ds =>
                                                  ds.dayOfWeek === day.value
                                                    ? { ...ds, startTime: newValue, endTime: endTime || ds.endTime }
                                                    : ds
                                                )
                                              });
                                            }}
                                            slotProps={{
                                              textField: {
                                                size: 'small',
                                                sx: { width: 140 }
                                              }
                                            }}
                                          />
                                          <TimePicker
                                            label="Окончание"
                                            value={daySchedule.endTime}
                                            onChange={(newValue) => {
                                              setFormData({
                                                ...formData,
                                                daySchedules: formData.daySchedules.map(ds =>
                                                  ds.dayOfWeek === day.value
                                                    ? { ...ds, endTime: newValue }
                                                    : ds
                                                )
                                              });
                                }}
                                            slotProps={{
                                              textField: {
                                                size: 'small',
                                                sx: { width: 140 }
                                              }
                                            }}
                                          />
                                        </>
                                      )}
                                    </Box>
                                  </Paper>
                                );
                              })}
                          </Box>
                        </Grid>
                        </>
                      )}
                        
                      {/* Mode: Specific Dates */}
                      {formData.recurrenceMode === 'dates' && (
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" gutterBottom>
                            Добавьте конкретные даты с расписанием:
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {formData.dateSchedules.map((dateSchedule, index) => (
                              <Paper key={index} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Grid container spacing={2} alignItems="center">
                                  <Grid item xs={12} sm={4}>
                                    <DatePicker
                                      label="Дата"
                                      value={dateSchedule.date}
                                      onChange={(newValue) => {
                                        const newSchedules = [...formData.dateSchedules];
                                        newSchedules[index].date = newValue || new Date();
                                        setFormData({ ...formData, dateSchedules: newSchedules });
                                      }}
                                      slotProps={{
                                        textField: {
                                          fullWidth: true,
                                          size: 'small'
                                        }
                                      }}
                                    />
                                  </Grid>
                                  <Grid item xs={12} sm={3}>
                                    <TimePicker
                                      label="Начало"
                                      value={dateSchedule.startTime}
                                      onChange={(newValue) => {
                                        const endTime = addDefaultDuration(newValue);
                                        const newSchedules = [...formData.dateSchedules];
                                        newSchedules[index].startTime = newValue;
                                        if (endTime) {
                                          newSchedules[index].endTime = endTime;
                                        }
                                        setFormData({ ...formData, dateSchedules: newSchedules });
                                      }}
                                      slotProps={{
                                        textField: {
                                          fullWidth: true,
                                          size: 'small'
                                        }
                                      }}
                                    />
                                  </Grid>
                                  <Grid item xs={12} sm={3}>
                                    <TimePicker
                                      label="Окончание"
                                      value={dateSchedule.endTime}
                                      onChange={(newValue) => {
                                        const newSchedules = [...formData.dateSchedules];
                                        newSchedules[index].endTime = newValue;
                                        setFormData({ ...formData, dateSchedules: newSchedules });
                                      }}
                                      slotProps={{
                                        textField: {
                                          fullWidth: true,
                                          size: 'small'
                                        }
                                      }}
                                    />
                                  </Grid>
                                  <Grid item xs={12} sm={2}>
                                    <IconButton
                                      color="error"
                                      onClick={() => {
                                        setFormData({
                                          ...formData,
                                          dateSchedules: formData.dateSchedules.filter((_, i) => i !== index)
                                        });
                                      }}
                                    >
                                      <Delete />
                                    </IconButton>
                        </Grid>
                                </Grid>
                              </Paper>
                            ))}
                            <Button
                              variant="outlined"
                              startIcon={<Add />}
                              onClick={() => {
                                const defaultTime = formData.startTime || new Date();
                                defaultTime.setHours(10, 0);
                                const defaultEndTime = formData.endTime || new Date();
                                defaultEndTime.setHours(11, 0);
                                
                                setFormData({
                                  ...formData,
                                  dateSchedules: [
                                    ...formData.dateSchedules,
                                    {
                                      date: new Date(),
                                      startTime: new Date(defaultTime),
                                      endTime: new Date(defaultEndTime)
                                    }
                                  ]
                                });
                              }}
                            >
                              Добавить дату
                            </Button>
                          </Box>
                        </Grid>
                    )}
                  </Grid>
                </Box>
              </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)} disabled={isSubmitting}>Отмена</Button>
            <Button onClick={handleCreateTraining} variant="contained" disabled={isSubmitting}>
              {isSubmitting ? 'Создание...' : 'Создать тренировку'}
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
              
              {/* Recurring Training Checkbox - moved to top */}
              <Grid item xs={12}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'background.default' }}>
                  <FormControl>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Checkbox
                        checked={formData.isRecurring}
                        onChange={(e) => {
                          const isRecurring = e.target.checked;
                          setFormData({ 
                            ...formData, 
                            isRecurring,
                            // Сбрасываем расписания при переключении
                            daySchedules: isRecurring ? formData.daySchedules : [],
                            dateSchedules: isRecurring ? formData.dateSchedules : []
                          });
                        }}
                      />
                      <Typography variant="subtitle1" fontWeight="medium">
                        Создать регулярную тренировку
                      </Typography>
                    </Box>
                  </FormControl>
                </Box>
              </Grid>

              {/* Показываем эти поля только если НЕ регулярная тренировка */}
              {!formData.isRecurring && (
                <>
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
                      views={['year', 'month', 'day']}
                      openTo="day"
                />
              </Grid>
              <Grid item xs={6}>
                <TimePicker
                  label="Время начала"
                  value={formData.startTime}
                      onChange={(newValue) => {
                        const endTime = addDefaultDuration(newValue);
                        setFormData({ ...formData, startTime: newValue, endTime });
                      }}
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
                </>
              )}
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
                        {trainer.user ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim() : `Тренер #${trainer.id}`}
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
                    onChange={async (e) => {
                      const branchId = e.target.value;
                      setFormData({ ...formData, branchId, hallId: '' }); // Сбрасываем зал при смене филиала
                      // Загружаем залы для выбранного филиала
                      if (branchId) {
                        try {
                          const hallsRes = await apiService.getHalls({ branchId });
                          setHalls(hallsRes.data);
                        } catch (err) {
                          console.error('Error fetching halls:', err);
                          setHalls([]);
                        }
                      } else {
                        setHalls([]);
                      }
                    }}
                  >
                    {branches.map((branch) => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Зал (необязательно)</InputLabel>
                  <Select
                    value={formData.hallId}
                    onChange={(e) => setFormData({ ...formData, hallId: e.target.value })}
                    disabled={!formData.branchId}
                  >
                    <MenuItem value="">
                      <em>Не выбран</em>
                    </MenuItem>
                    {halls.filter(h => h.isActive).map((hall) => (
                      <MenuItem key={hall.id} value={hall.id}>
                        {hall.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Recurring Training Settings */}
              {formData.isRecurring && (
                <Grid item xs={12}>
                  <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'rgba(25, 118, 210, 0.05)' }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                      Настройки регулярных тренировок
                    </Typography>
                    
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      {/* Mode Selection */}
                      <Grid item xs={12}>
                        <FormControl>
                          <RadioGroup
                            row
                            value={formData.recurrenceMode}
                            onChange={(e) => {
                              const mode = e.target.value as 'days' | 'dates';
                              setFormData({ 
                                ...formData, 
                                recurrenceMode: mode,
                                daySchedules: mode === 'days' ? formData.daySchedules : [],
                                dateSchedules: mode === 'dates' ? formData.dateSchedules : []
                              });
                            }}
                          >
                            <FormControlLabel value="days" control={<Radio />} label="По дням недели" />
                            <FormControlLabel value="dates" control={<Radio />} label="По конкретным датам" />
                          </RadioGroup>
                        </FormControl>
                      </Grid>

                      {/* Mode: Days of Week */}
                      {formData.recurrenceMode === 'days' && (
                        <>
                          <Grid item xs={12} sm={6}>
                            <DatePicker
                              label="Дата начала регулярных тренировок"
                              value={formData.recurrenceStartDate}
                              onChange={(newValue) => setFormData({ ...formData, recurrenceStartDate: newValue })}
                              slotProps={{
                                textField: {
                                  fullWidth: true
                                }
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <DatePicker
                              label="Дата окончания регулярных тренировок"
                              value={formData.recurrenceEndDate}
                              onChange={(newValue) => setFormData({ ...formData, recurrenceEndDate: newValue })}
                              slotProps={{
                                textField: {
                                  fullWidth: true
                                }
                              }}
                            />
                          </Grid>
                          
                          <Grid item xs={12}>
                            <Typography variant="subtitle2" gutterBottom>
                              Добавьте дни недели с расписанием:
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {[
                                { value: 0, label: 'Воскресенье' },
                                { value: 1, label: 'Понедельник' },
                                { value: 2, label: 'Вторник' },
                                { value: 3, label: 'Среда' },
                                { value: 4, label: 'Четверг' },
                                { value: 5, label: 'Пятница' },
                                { value: 6, label: 'Суббота' }
                              ].map((day) => {
                                const daySchedule = formData.daySchedules.find(ds => ds.dayOfWeek === day.value);
                                const isSelected = !!daySchedule;
                                
                                return (
                                  <Paper key={day.value} sx={{ p: 2, border: isSelected ? '2px solid' : '1px solid', borderColor: isSelected ? 'primary.main' : 'divider' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                      <Checkbox
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            // Add day schedule
                                            const defaultTime = formData.startTime || new Date();
                                            defaultTime.setHours(10, 0);
                                            const defaultEndTime = formData.endTime || new Date();
                                            defaultEndTime.setHours(11, 0);
                                            
                                            setFormData({
                                              ...formData,
                                              daySchedules: [
                                                ...formData.daySchedules,
                                                {
                                                  dayOfWeek: day.value,
                                                  startTime: new Date(defaultTime),
                                                  endTime: new Date(defaultEndTime)
                                                }
                                              ]
                                            });
                                          } else {
                                            // Remove day schedule
                                            setFormData({
                                              ...formData,
                                              daySchedules: formData.daySchedules.filter(ds => ds.dayOfWeek !== day.value)
                                            });
                                          }
                                        }}
                                      />
                                      <Typography sx={{ minWidth: 120 }}>{day.label}</Typography>
                                      {isSelected && daySchedule && (
                                        <>
                                          <TimePicker
                                            label="Начало"
                                            value={daySchedule.startTime}
                                            onChange={(newValue) => {
                                              const endTime = addDefaultDuration(newValue);
                                              setFormData({
                                                ...formData,
                                                daySchedules: formData.daySchedules.map(ds =>
                                                  ds.dayOfWeek === day.value
                                                    ? { ...ds, startTime: newValue, endTime: endTime || ds.endTime }
                                                    : ds
                                                )
                                              });
                                            }}
                                            slotProps={{
                                              textField: {
                                                size: 'small',
                                                sx: { width: 140 }
                                              }
                                            }}
                                          />
                                          <TimePicker
                                            label="Окончание"
                                            value={daySchedule.endTime}
                                            onChange={(newValue) => {
                                              setFormData({
                                                ...formData,
                                                daySchedules: formData.daySchedules.map(ds =>
                                                  ds.dayOfWeek === day.value
                                                    ? { ...ds, endTime: newValue }
                                                    : ds
                                                )
                                              });
                                            }}
                                            slotProps={{
                                              textField: {
                                                size: 'small',
                                                sx: { width: 140 }
                                              }
                                            }}
                                          />
                                        </>
                                      )}
                                    </Box>
                                  </Paper>
                                );
                              })}
                            </Box>
                          </Grid>
                        </>
                      )}

                      {/* Mode: Specific Dates */}
                      {formData.recurrenceMode === 'dates' && (
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" gutterBottom>
                            Добавьте конкретные даты с расписанием:
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {formData.dateSchedules.map((dateSchedule, index) => (
                              <Paper key={index} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Grid container spacing={2} alignItems="center">
                                  <Grid item xs={12} sm={4}>
                                    <DatePicker
                                      label="Дата"
                                      value={dateSchedule.date}
                                      onChange={(newValue) => {
                                        const newSchedules = [...formData.dateSchedules];
                                        newSchedules[index].date = newValue || new Date();
                                        setFormData({ ...formData, dateSchedules: newSchedules });
                                      }}
                                      slotProps={{
                                        textField: {
                                          fullWidth: true,
                                          size: 'small'
                                        }
                                      }}
                                    />
                                  </Grid>
                                  <Grid item xs={12} sm={3}>
                                    <TimePicker
                                      label="Начало"
                                      value={dateSchedule.startTime}
                                      onChange={(newValue) => {
                                        const endTime = addDefaultDuration(newValue);
                                        const newSchedules = [...formData.dateSchedules];
                                        newSchedules[index].startTime = newValue;
                                        if (endTime) {
                                          newSchedules[index].endTime = endTime;
                                        }
                                        setFormData({ ...formData, dateSchedules: newSchedules });
                                      }}
                                      slotProps={{
                                        textField: {
                                          fullWidth: true,
                                          size: 'small'
                                        }
                                      }}
                                    />
                                  </Grid>
                                  <Grid item xs={12} sm={3}>
                                    <TimePicker
                                      label="Окончание"
                                      value={dateSchedule.endTime}
                                      onChange={(newValue) => {
                                        const newSchedules = [...formData.dateSchedules];
                                        newSchedules[index].endTime = newValue;
                                        setFormData({ ...formData, dateSchedules: newSchedules });
                                      }}
                                      slotProps={{
                                        textField: {
                                          fullWidth: true,
                                          size: 'small'
                                        }
                                      }}
                                    />
                                  </Grid>
                                  <Grid item xs={12} sm={2}>
                                    <IconButton
                                      color="error"
                                      onClick={() => {
                                        setFormData({
                                          ...formData,
                                          dateSchedules: formData.dateSchedules.filter((_, i) => i !== index)
                                        });
                                      }}
                                    >
                                      <Delete />
                                    </IconButton>
                                  </Grid>
                                </Grid>
                              </Paper>
                            ))}
                            <Button
                              variant="outlined"
                              startIcon={<Add />}
                              onClick={() => {
                                const defaultTime = formData.startTime || new Date();
                                defaultTime.setHours(10, 0);
                                const defaultEndTime = formData.endTime || new Date();
                                defaultEndTime.setHours(11, 0);
                                
                                setFormData({
                                  ...formData,
                                  dateSchedules: [
                                    ...formData.dateSchedules,
                                    {
                                      date: new Date(),
                                      startTime: new Date(defaultTime),
                                      endTime: new Date(defaultEndTime)
                                    }
                                  ]
                                });
                              }}
                            >
                              Добавить дату
                            </Button>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                </Grid>
              )}
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                Учет посещаемости: {selectedTraining?.title}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {selectedTraining && format(new Date(selectedTraining.startTime), 'EEEE, d MMMM yyyy, HH:mm', { locale: ru })}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={() => {
                    if (selectedTraining) {
                      handleEditTraining(selectedTraining);
                      setAttendanceDialog(false);
                    }
                  }}
                >
                  Редактировать тренировку
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() => {
                    setClientFormData({
                      firstName: '',
                      lastName: '',
                      middleName: '',
                      phone: '',
                    });
                    setClientFormErrors({});
                    setCreateClientDialog(true);
                  }}
                >
                  Создать клиента
                </Button>
              </Box>
            </Box>
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
                      <TableCell align="center">Списать средства</TableCell>
                      <TableCell>Примечания</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {attendanceData.map((item) => {
                      const currentStatus = item.attendance?.status || 'ABSENT';
                      return (
                        <TableRow key={item.client.id}>
                          <TableCell>
                            <Link
                              component="button"
                              variant="body2"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/clients?clientId=${item.client.id}`);
                              }}
                              sx={{
                                cursor: 'pointer',
                                textDecoration: 'none',
                                '&:hover': {
                                  textDecoration: 'underline',
                                },
                              }}
                            >
                            {item.client.firstName} {item.client.lastName}
                            </Link>
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
                          <TableCell align="center">
                            {(currentStatus === 'ABSENT' || currentStatus === 'EXCUSED') && (
                              <Checkbox
                                checked={item.attendance?.shouldCharge !== undefined ? item.attendance.shouldCharge : (currentStatus === 'EXCUSED')}
                                onChange={(e) => handleShouldChargeChange(item.client.id, e.target.checked)}
                                title="Не списывать средства за пропуск"
                              />
                            )}
                            {currentStatus === 'PRESENT' && (
                              <Typography variant="body2" color="text.secondary">-</Typography>
                            )}
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

        {/* Create Client Dialog */}
        <Dialog open={createClientDialog} onClose={() => setCreateClientDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Создать нового клиента</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Клиент будет автоматически добавлен в группу: {groups.find(g => g.id === selectedTraining?.groupId)?.name || 'Неизвестная группа'}
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Имя"
                  required
                  value={clientFormData.firstName}
                  onChange={(e) => {
                    setClientFormData({ ...clientFormData, firstName: e.target.value });
                    if (clientFormErrors.firstName) {
                      setClientFormErrors({ ...clientFormErrors, firstName: '' });
                    }
                  }}
                  error={!!clientFormErrors.firstName}
                  helperText={clientFormErrors.firstName}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Фамилия"
                  required
                  value={clientFormData.lastName}
                  onChange={(e) => {
                    setClientFormData({ ...clientFormData, lastName: e.target.value });
                    if (clientFormErrors.lastName) {
                      setClientFormErrors({ ...clientFormErrors, lastName: '' });
                    }
                  }}
                  error={!!clientFormErrors.lastName}
                  helperText={clientFormErrors.lastName}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Отчество"
                  value={clientFormData.middleName}
                  onChange={(e) => setClientFormData({ ...clientFormData, middleName: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Телефон"
                  value={clientFormData.phone}
                  onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                  placeholder="+1234567890"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setCreateClientDialog(false);
              setClientFormData({
                firstName: '',
                lastName: '',
                middleName: '',
                phone: '',
              });
              setClientFormErrors({});
            }}>
              Отмена
            </Button>
            <Button onClick={handleCreateClient} variant="contained">
              Создать
            </Button>
          </DialogActions>
        </Dialog>

        {/* Competition Dialog */}
        <Dialog 
          open={competitionDialog} 
          onClose={() => {
            setCompetitionDialog(false);
            setSelectedCompetition(null);
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmojiEvents sx={{ color: 'warning.main' }} />
              <Typography variant="h6">
                {selectedCompetition?.name}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedCompetition && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Место проведения
                  </Typography>
                  <Typography variant="body1">
                    {selectedCompetition.location}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Дата начала
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(selectedCompetition.startDate), 'd MMMM yyyy', { locale: ru })}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Дата окончания
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(selectedCompetition.endDate), 'd MMMM yyyy', { locale: ru })}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Дата регистрации
                  </Typography>
                  <Typography variant="body1">
                    {selectedCompetition.registrationDate 
                      ? format(new Date(selectedCompetition.registrationDate), 'd MMMM yyyy', { locale: ru })
                      : 'Не указана'}
                  </Typography>
                </Grid>
                {selectedCompetition.registrationTime && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Время регистрации
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(selectedCompetition.registrationTime), 'HH:mm', { locale: ru })}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Chip
                    label={selectedCompetition.isElectronicRegistration ? 'Электронная регистрация' : 'Обычная регистрация'}
                    color={selectedCompetition.isElectronicRegistration ? 'primary' : 'default'}
                    size="small"
                  />
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setCompetitionDialog(false);
              setSelectedCompetition(null);
            }}>
              Закрыть
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Schedule;
