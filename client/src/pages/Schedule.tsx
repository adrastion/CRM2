import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
  Stack,
} from '@mui/material';
import { Autocomplete } from '@mui/material';
import { 
  Add, 
  CalendarToday,
  AccessTime,
  Group as GroupIcon,
  Edit,
  People,
  Delete,
  EmojiEvents,
  ChevronLeft,
  ChevronRight,
  Person,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import ClientNameLink from '../components/ClientNameLink';
import CompetitionsPanel from '../components/competitions/CompetitionsPanel';
import { Training, Group, Branch, Trainer, Client, Attendance, Competition, Hall } from '../types';
import { useAuth } from '../contexts/AuthContext';

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
  trainingType: 'group' | 'individual'; // Тип тренировки: групповая или индивидуальная
  groupId: string;
  selectedClientIds: string[]; // Выбранные клиенты для индивидуальной тренировки
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
  // Поля для индивидуальных тренировок
  price: string; // Цена индивидуальной тренировки
  trainerEarningType: 'percentage' | 'amount' | ''; // Тип заработка тренера: процент или сумма
  trainerEarningValue: string; // Значение (процент или сумма)
  // Замена тренера
  substituteTrainerId: string; // ID тренера-замены
  originalTrainerId: string; // ID оригинального тренера (если есть замена)
  competitionConflict: boolean; // Есть ли конфликт с соревнованием
}

const Schedule: React.FC = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionTab = searchParams.get('tab') === 'competitions' ? 'competitions' : 'schedule';
  const setSectionTab = (tab: 'schedule' | 'competitions') => {
    if (tab === 'competitions') {
      setSearchParams({ tab: 'competitions' });
    } else {
      setSearchParams({});
    }
  };
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [schoolEvents, setSchoolEvents] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [clients, setClients] = useState<Client[]>([]); // Все клиенты для выбора в индивидуальной тренировке
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setter reserved for client search UI
  const [, setClientSearchQuery] = useState<string>(''); // Поиск клиентов
  const [loading, setLoading] = useState(true);
  const [trainingTypeDialog, setTrainingTypeDialog] = useState(false); // Диалог выбора типа тренировки
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [attendanceDialog, setAttendanceDialog] = useState(false);
  const [competitionDialog, setCompetitionDialog] = useState(false);
  const [eventDialog, setEventDialog] = useState(false);
  const [eventDetailDialog, setEventDetailDialog] = useState(false);
  const [selectedSchoolEvent, setSelectedSchoolEvent] = useState<any | null>(null);
  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    type: 'parent_meeting' as 'parent_meeting' | 'other',
    date: new Date() as Date | null,
    startTime: null as Date | null,
    endTime: null as Date | null,
    location: '',
    branchId: '',
    groupId: '',
  });
  const [eventSaving, setEventSaving] = useState(false);
  const [createClientDialog, setCreateClientDialog] = useState(false);
  const [addClientDialog, setAddClientDialog] = useState(false); // Диалог добавления существующего клиента
  const [selectedClientsToAdd, setSelectedClientsToAdd] = useState<Client[]>([]); // Выбранные клиенты для добавления
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

  useEffect(() => {
    if (isMobile) {
      setViewMode('day');
    }
  }, [isMobile]);
  const [defaultTrainingDuration, setDefaultTrainingDuration] = useState<number>(60); // Длительность тренировки в минутах по умолчанию
  const [isSubmitting, setIsSubmitting] = useState(false); // Защита от двойного нажатия при создании тренировки
  const [isUpdating, setIsUpdating] = useState(false); // Индикатор обновления тренировки
  const [formData, setFormData] = useState<TrainingFormData>({
    title: '',
    description: '',
    date: new Date(),
    startTime: null,
    endTime: null,
    trainingType: 'group', // По умолчанию групповая тренировка
    groupId: '',
    selectedClientIds: [], // Выбранные клиенты для индивидуальной тренировки
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
    dateSchedules: [],
    price: '',
    trainerEarningType: '',
    trainerEarningValue: '',
    substituteTrainerId: '',
    originalTrainerId: '',
    competitionConflict: false
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [trainingsRes, groupsRes, trainersRes, branchesRes, clientsRes, eventsRes] = await Promise.all([
        apiService.getTrainings({ limit: 1000, page: 1 }),
        apiService.getGroups({ limit: 1000, page: 1 }),
        apiService.getTrainers({ limit: 1000, page: 1 }),
        apiService.getBranches({ limit: 1000, page: 1 }),
        apiService.getClients({ limit: 1000, page: 1 }),
        apiService.getSchoolEvents().catch(() => []),
      ]);
      
      // Логируем для отладки
      const individualTrainings = trainingsRes.data.filter((t: Training) => !t.groupId);
      console.log('Total trainings loaded:', trainingsRes.data.length);
      console.log('Individual trainings:', individualTrainings.length);
      if (individualTrainings.length > 0) {
        console.log('Individual training examples:', individualTrainings.slice(0, 3).map((t: Training) => ({
          id: t.id,
          title: t.title,
          startTime: t.startTime,
          groupId: t.groupId
        })));
      }
      
      setTrainings(trainingsRes.data);
      setGroups(groupsRes.data);
      setTrainers(trainersRes.data);
      setBranches(branchesRes.data);
      setClients(clientsRes.data || []); // Сохраняем клиентов
      setSchoolEvents(eventsRes || []);
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
        
        const [trainingsRes, competitionsRes, groupsRes, trainersRes, branchesRes, hallsRes, settingsRes, clientsRes, eventsRes] = await Promise.all([
          apiService.getTrainings({ limit: 1000, page: 1 }, abortController.signal),
          apiService.getCompetitions({ limit: 1000, page: 1 }, abortController.signal), // Загружаем до 1000 соревнований
          apiService.getGroups({ limit: 1000, page: 1 }, abortController.signal), // Загружаем все группы
          apiService.getTrainers({ limit: 1000, page: 1 }, abortController.signal),
          apiService.getBranches({ limit: 1000, page: 1 }, abortController.signal),
          apiService.getHalls({ limit: 1000, page: 1 }, abortController.signal).catch(() => ({ data: [], pagination: {} })),
          apiService.getSettings().catch(() => null), // Загружаем настройки, игнорируем ошибки если нет настроек
          apiService.getClients({ limit: 1000 }, abortController.signal).catch(() => ({ data: [] })), // Загружаем клиентов для индивидуальных тренировок
          apiService.getSchoolEvents(undefined, abortController.signal).catch(() => []),
        ]);
        
        if (!isMounted || abortController.signal.aborted) return;
        setTrainings(trainingsRes.data);
        setCompetitions(competitionsRes.data);
        setGroups(groupsRes.data);
        setTrainers(trainersRes.data);
        setBranches(branchesRes.data);
        setHalls(hallsRes.data || []);
        setClients(clientsRes?.data || []);
        setSchoolEvents(eventsRes || []);
        
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
      // Для групповой тренировки группа обязательна, для индивидуальной - клиенты
      if (formData.trainingType === 'group') {
      if (!formData.groupId) {
        alert('Пожалуйста, выберите группу');
        return;
        }
      } else {
        // Индивидуальная тренировка
        if (!formData.selectedClientIds || formData.selectedClientIds.length === 0) {
          alert('Пожалуйста, выберите хотя бы одного клиента');
          return;
        }
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
      // Всегда отправляем оригинального тренера в trainerId, контроллер сам определит, кто будет проводить
      const trainingData: any = {
        title: formData.title,
        description: formData.description,
        trainerId: formData.trainerId, // Оригинальный тренер
        branchId: formData.branchId,
        hallId: formData.hallId || undefined,
        isRecurring: formData.isRecurring,
        recurrence: formData.recurrence,
        daysOfWeek: formData.daysOfWeek,
        substituteTrainerId: formData.substituteTrainerId || undefined,
        originalTrainerId: formData.substituteTrainerId ? formData.trainerId : undefined
      };
      
      // Для групповой тренировки добавляем groupId, для индивидуальной - явно null
      if (formData.trainingType === 'group') {
        trainingData.groupId = formData.groupId;
      } else {
        trainingData.groupId = null; // Явно устанавливаем null для индивидуальных тренировок
      }

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
        // Используем batch создание для быстрого создания множества тренировок
        if (trainings.length > 1) {
          try {
            const batchResult = await apiService.createTrainingsBatch(trainings);
            if (batchResult.failedCount > 0) {
              const errorMessages = batchResult.failed.map((ft: any) => ft.error).join('; ');
              alert(`Создано тренировок: ${batchResult.createdCount}. Ошибок: ${batchResult.failedCount}. ${errorMessages}`);
            } else {
              alert(`Успешно создано ${batchResult.createdCount} тренировок`);
            }
            
            // Для индивидуальных тренировок создаем записи посещаемости для всех созданных тренировок
            if (formData.trainingType === 'individual' && formData.selectedClientIds.length > 0 && batchResult.created) {
              try {
                console.log('Creating attendances for batch individual trainings:', {
                  trainingsCount: batchResult.created.length,
                  selectedClientIds: formData.selectedClientIds
                });
                // Создаем посещаемость для каждой созданной тренировки
                for (const createdTraining of batchResult.created) {
                  if (createdTraining?.id) {
                    try {
                      // Небольшая задержка для обеспечения, что тренировка полностью создана в БД
                      await new Promise(resolve => setTimeout(resolve, 500));
                      
                      const attendances = formData.selectedClientIds.map(clientId => ({
                        clientId,
                        status: 'PRESENT',
                        notes: '',
                        shouldCharge: false // Для PRESENT статуса shouldCharge должен быть false
                      }));
                      
                      await apiService.bulkUpdateAttendance(createdTraining.id, attendances);
                      console.log(`Attendances created for training ${createdTraining.id}`);
                      
                      // Небольшая задержка между запросами
                      await new Promise(resolve => setTimeout(resolve, 200));
                    } catch (attendanceError: any) {
                      console.error(`Error creating attendances for training ${createdTraining.id}:`, attendanceError);
                      console.error('Error details:', attendanceError.response?.data);
                    }
                  }
                }
                console.log('All attendances created for batch trainings');
                // Обновляем данные после создания посещаемости
                await fetchData();
                // Обновляем данные посещаемости для созданных тренировок
                if (batchResult.created && batchResult.created.length > 0) {
                  for (const createdTraining of batchResult.created) {
                    if (createdTraining?.id) {
                      try {
                        // Небольшая задержка для обеспечения, что данные посещаемости уже созданы
                        await new Promise(resolve => setTimeout(resolve, 300));
                        const response = await apiService.getAttendancesByTraining(createdTraining.id);
                        console.log(`Refreshed attendance data for training ${createdTraining.id}:`, response);
                        // Если диалог посещаемости открыт для этой тренировки, обновляем данные
                        if (selectedTraining && selectedTraining.id === createdTraining.id) {
                          setAttendanceData(response.clients || []);
                        }
                      } catch (err) {
                        console.error(`Error refreshing attendance data for training ${createdTraining.id}:`, err);
                      }
                    }
                  }
                }
              } catch (attendanceError: any) {
                console.error('Error creating attendances for recurring individual trainings:', attendanceError);
                console.error('Error details:', attendanceError.response?.data);
                alert('Тренировки созданы, но не удалось добавить клиентов в посещаемость для некоторых тренировок');
                await fetchData();
              }
            } else {
              // Обновляем данные после создания регулярных тренировок (если не индивидуальные)
              await fetchData();
            }
          } catch (batchErr: any) {
            console.error('Error creating trainings batch:', batchErr);
            // Если batch не удался, пробуем создавать по одной с задержками
            const createdTrainings = [];
            const failedTrainings = [];
            for (let i = 0; i < trainings.length; i++) {
              const training = trainings[i];
              try {
                const createdTraining = await apiService.createTraining(training);
                createdTrainings.push({ training, createdTraining });
                
                // Для индивидуальных тренировок создаем записи посещаемости
                const trainingIdForFallback = createdTraining?.id || createdTraining?.data?.id;
                if (formData.trainingType === 'individual' && formData.selectedClientIds.length > 0 && trainingIdForFallback) {
                  try {
                    // Небольшая задержка для обеспечения, что тренировка полностью создана в БД
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    const attendances = formData.selectedClientIds.map(clientId => ({
                      clientId,
                      status: 'PRESENT',
                      notes: '',
                      shouldCharge: false // Для PRESENT статуса shouldCharge должен быть false
                    }));
                    await apiService.bulkUpdateAttendance(trainingIdForFallback, attendances);
                  } catch (attendanceError) {
                    console.error('Error creating attendances for individual training:', attendanceError);
                  }
                }
                
                // Увеличиваем задержку между запросами (500ms), чтобы избежать 429 ошибки
                if (i < trainings.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              } catch (err: any) {
                console.error('Error creating training:', err);
                failedTrainings.push({
                  training,
                  error: err.response?.data?.error || err.message || 'Неизвестная ошибка'
                });
              }
            }
            
            if (failedTrainings.length > 0) {
              const errorMessages = failedTrainings.map(ft => ft.error).join('; ');
              alert(`Создано тренировок: ${createdTrainings.length}. Ошибок: ${failedTrainings.length}. ${errorMessages}`);
            } else {
              alert(`Успешно создано ${createdTrainings.length} тренировок`);
            }
            // Обновляем данные после создания тренировок
            await fetchData();
          }
        } else if (trainings.length === 1) {
          // Для одной тренировки используем обычный метод
          try {
            const createdTraining = await apiService.createTraining(trainings[0]);
            alert('Тренировка успешно создана');
            
            // Для индивидуальных тренировок создаем записи посещаемости
            const trainingIdForRecurring = createdTraining?.id || createdTraining?.data?.id;
            if (formData.trainingType === 'individual' && formData.selectedClientIds.length > 0 && trainingIdForRecurring) {
              try {
                // Небольшая задержка для обеспечения, что тренировка полностью создана в БД
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const attendances = formData.selectedClientIds.map(clientId => ({
                  clientId,
                  status: 'PRESENT',
                  notes: '',
                  shouldCharge: false // Для PRESENT статуса shouldCharge должен быть false
                }));
                console.log('Creating attendances for individual training (recurring single):', {
                  trainingId: trainingIdForRecurring,
                  attendances: attendances
                });
                await apiService.bulkUpdateAttendance(trainingIdForRecurring, attendances);
                console.log('Attendances created successfully for recurring training');
                await fetchData();
              } catch (attendanceError: any) {
                console.error('Error creating attendances for individual training:', attendanceError);
                console.error('Error details:', attendanceError.response?.data);
                alert('Тренировка создана, но не удалось добавить клиентов в посещаемость: ' + (attendanceError.response?.data?.error || attendanceError.message));
                await fetchData();
              }
            } else {
              await fetchData();
            }
          } catch (err: any) {
            const errorMessage = err.response?.data?.error || err.message || 'Ошибка создания тренировки';
            alert(`Ошибка создания тренировки: ${errorMessage}`);
            throw err;
          }
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

        const trainingToCreate = {
          ...trainingData,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        };
        
        console.log('Creating training with data:', JSON.stringify(trainingToCreate, null, 2));
        console.log('Training type:', formData.trainingType);
        console.log('Selected client IDs:', formData.selectedClientIds);
        
        const createdTraining = await apiService.createTraining(trainingToCreate);
        console.log('Training created:', createdTraining);
        console.log('Training ID:', createdTraining?.id);
        console.log('Training data structure:', {
          hasId: !!createdTraining?.id,
          hasData: !!createdTraining?.data,
          hasDataId: !!createdTraining?.data?.id
        });
        
        // Для индивидуальной тренировки создаем записи посещаемости для выбранных клиентов
        const trainingId = createdTraining?.id || createdTraining?.data?.id;
        if (formData.trainingType === 'individual' && formData.selectedClientIds.length > 0 && trainingId) {
          console.log('Creating attendances for individual training. Training ID:', trainingId);
          try {
            // Небольшая задержка для обеспечения, что тренировка полностью создана в БД
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const attendances = formData.selectedClientIds.map(clientId => ({
              clientId,
              status: 'PRESENT',
              notes: '',
              shouldCharge: false // Для PRESENT статуса shouldCharge должен быть false
            }));
            console.log('Creating attendances for individual training:', {
              trainingId: trainingId,
              attendances: attendances
            });
            console.log('Calling bulkUpdateAttendance with:', {
              trainingId: trainingId,
              attendances: attendances
            });
            
            const attendanceResult = await apiService.bulkUpdateAttendance(trainingId, attendances);
            console.log('Attendances created successfully:', attendanceResult);
            console.log('Attendance result type:', typeof attendanceResult);
            console.log('Attendance result is array:', Array.isArray(attendanceResult));
            console.log('Attendance result length:', Array.isArray(attendanceResult) ? attendanceResult.length : 'not an array');
            console.log('Attendance result keys:', attendanceResult ? Object.keys(attendanceResult) : 'null');
            
            // Проверяем, что записи действительно созданы
            if (Array.isArray(attendanceResult) && attendanceResult.length > 0) {
              console.log('Successfully created', attendanceResult.length, 'attendance records');
              attendanceResult.forEach((att: any, index: number) => {
                console.log(`Attendance ${index + 1}:`, {
                  id: att.id,
                  clientId: att.clientId,
                  trainingId: att.trainingId,
                  status: att.status,
                  client: att.client ? `${att.client.lastName} ${att.client.firstName}` : 'no client data'
                });
              });
            } else {
              console.warn('WARNING: No attendance records were created or result is not an array!');
              console.warn('Result:', attendanceResult);
            }
            
            // Дополнительная задержка перед обновлением данных
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Обновляем данные после создания посещаемости
            await fetchData();
            
            // Обновляем данные посещаемости для созданной тренировки
            try {
              console.log('Fetching attendance data for training:', trainingId);
              const response = await apiService.getAttendancesByTraining(trainingId);
              console.log('Refreshed attendance data:', response);
              console.log('Clients in response:', response.clients?.length || 0);
              console.log('Full response:', JSON.stringify(response, null, 2));
              
              // Всегда обновляем данные посещаемости, если диалог открыт для этой тренировки
              if (selectedTraining && selectedTraining.id === trainingId) {
                console.log('Updating attendance data in dialog');
                setAttendanceData(response.clients || []);
              } else {
                console.log('Dialog not open for this training. selectedTraining:', selectedTraining?.id, 'trainingId:', trainingId);
              }
            } catch (err) {
              console.error('Error refreshing attendance data:', err);
            }
          } catch (attendanceError: any) {
            console.error('Error creating attendances for individual training:', attendanceError);
            console.error('Error details:', attendanceError.response?.data);
            alert('Тренировка создана, но не удалось добавить клиентов в посещаемость: ' + (attendanceError.response?.data?.error || attendanceError.message));
            await fetchData();
          }
        } else {
          await fetchData();
        }
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
      trainingType: 'group',
      groupId: '',
      selectedClientIds: [],
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
      dateSchedules: [],
      price: '',
      trainerEarningType: '',
      trainerEarningValue: '',
      substituteTrainerId: '',
      originalTrainerId: '',
      competitionConflict: false
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
      trainingType: training.groupId ? 'group' : 'individual', // Определяем тип на основе наличия groupId
      groupId: training.groupId || '',
      selectedClientIds: [], // При редактировании клиенты загружаются отдельно через attendance
      trainerId: training.originalTrainerId || training.trainerId || '', // Используем оригинального тренера, если есть замена
      branchId: training.branchId || '',
      hallId: training.hallId || '',
      isRecurring: training.isRecurring || false,
      recurrence: training.recurrence || 'weekly',
      daysOfWeek: daySchedules.map(ds => ds.dayOfWeek),
      recurrenceStartDate,
      recurrenceEndDate,
      recurrenceMode,
      daySchedules,
      dateSchedules,
      price: training.price ? training.price.toString() : '',
      trainerEarningType: training.trainerEarningType || '',
      trainerEarningValue: training.trainerEarningValue ? training.trainerEarningValue.toString() : '',
      substituteTrainerId: training.substituteTrainerId || '',
      originalTrainerId: training.originalTrainerId || '',
      competitionConflict: false
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
    if (!editingTraining || isUpdating) return;

    try {
      setIsUpdating(true);
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
          // Находим все тренировки из серии
          const allTrainings = await apiService.getTrainings({ limit: 1000, page: 1 });
          const seriesTrainings = allTrainings.data.filter((t: Training) => 
            t.title === editingTraining.title &&
            t.groupId === editingTraining.groupId &&
            t.trainerId === editingTraining.trainerId &&
            t.branchId === editingTraining.branchId &&
            t.isRecurring &&
            !t.isCancelled
          );
          
          // Используем batch удаление для быстрого удаления всех тренировок серии
          if (seriesTrainings.length > 0) {
            const trainingIds = seriesTrainings.map(t => t.id);
            try {
              await apiService.deleteTrainingsBatch(trainingIds);
            } catch (err: any) {
              console.error('Error deleting trainings batch:', err);
              // Если batch не удался, пробуем удалять по одной
          for (const t of seriesTrainings) {
                try {
            await apiService.deleteTraining(t.id);
                } catch (deleteErr: any) {
                  console.error('Error deleting training:', deleteErr);
                  // Продолжаем удаление остальных
                }
              }
            }
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
          trainerId: formData.trainerId, // Всегда отправляем оригинального тренера (контроллер сам определит, кто будет проводить)
          branchId: formData.branchId,
          hallId: formData.hallId || undefined,
          isRecurring: true,
          recurrence: formData.recurrence,
          daysOfWeek: formData.daysOfWeek,
          substituteTrainerId: formData.substituteTrainerId || undefined,
          originalTrainerId: formData.substituteTrainerId ? formData.trainerId : undefined
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

        // Create all recurring trainings with error handling and rate limiting
        const createdTrainings = [];
        const failedTrainings = [];
        for (let i = 0; i < trainings.length; i++) {
          const training = trainings[i];
          try {
          await apiService.createTraining(training);
            createdTrainings.push(training);
            // Увеличиваем задержку между запросами (300ms), чтобы избежать 429 ошибки
            if (i < trainings.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          } catch (err: any) {
            console.error('Error creating training:', err);
            // Если ошибка 429, ждем дольше и повторяем
            if (err.response?.status === 429) {
              console.warn('Rate limit hit, waiting before retry...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              try {
                await apiService.createTraining(training);
                createdTrainings.push(training);
                // После успешного повтора добавляем дополнительную задержку
                if (i < trainings.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              } catch (retryErr: any) {
                console.error('Error creating training after retry:', retryErr);
                failedTrainings.push({
                  training,
                  error: retryErr.response?.data?.error || retryErr.message || 'Неизвестная ошибка (после повтора)'
                });
                // Если повторная попытка тоже не удалась, ждем перед следующим запросом
                if (i < trainings.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              }
            } else {
              failedTrainings.push({
                training,
                error: err.response?.data?.error || err.message || 'Неизвестная ошибка'
              });
            }
          }
        }
        
        // Если были ошибки при создании, показываем предупреждение
        if (failedTrainings.length > 0) {
          const errorMessages = failedTrainings.map(ft => ft.error).join('; ');
          alert(`Создано тренировок: ${createdTrainings.length}. Ошибок: ${failedTrainings.length}. ${errorMessages}`);
          // Если не удалось создать ни одной тренировки, не обновляем список
          if (createdTrainings.length === 0) {
            throw new Error('Не удалось создать ни одной тренировки');
          }
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
        trainerId: formData.trainerId, // Всегда отправляем оригинального тренера (контроллер сам определит, кто будет проводить)
        branchId: formData.branchId,
        hallId: formData.hallId || undefined,
          isRecurring: false,
        recurrence: null,
        substituteTrainerId: formData.substituteTrainerId || undefined,
        originalTrainerId: formData.substituteTrainerId ? formData.trainerId : undefined
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

      // Обновляем данные только если все прошло успешно
      try {
      await fetchData();
      } catch (fetchErr: any) {
        console.error('Error fetching data after training update:', fetchErr);
        // Не блокируем процесс, но логируем ошибку
      }
      
      setEditDialog(false);
      resetForm();
      setIsUpdating(false);
    } catch (error: any) {
      console.error('Error updating training:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Не удалось обновить тренировку';
      alert(`Ошибка обновления тренировки: ${errorMessage}`);
      
      // Важно: перезагружаем данные даже при ошибке, чтобы восстановить список тренировок
      // Это необходимо, так как при обновлении регулярной тренировки старые тренировки могли быть удалены
      try {
        await fetchData();
      } catch (fetchErr: any) {
        console.error('Error fetching data after failed training update:', fetchErr);
        // Показываем дополнительное предупреждение, если не удалось загрузить данные
        alert('Внимание: произошла ошибка при обновлении тренировки. Пожалуйста, обновите страницу.');
      }
      
      setIsUpdating(false);
      // Не закрываем диалог при ошибке, чтобы пользователь мог исправить данные
      // setEditDialog(false); - убрано, чтобы диалог оставался открытым
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for delete action
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
    setAttendanceDialog(true);
    // Загружаем данные посещаемости асинхронно после открытия диалога
    try {
      // Небольшая задержка для обеспечения, что данные посещаемости уже созданы
      await new Promise(resolve => setTimeout(resolve, 300));
      const response = await apiService.getAttendancesByTraining(training.id);
      console.log('Attendance data loaded:', response);
      // API returns { training, clients: [...] }
      setAttendanceData(response.clients || []);
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

  const getSchoolEventsForDate = (date: Date) => {
    return schoolEvents.filter((event) => isSameDay(new Date(event.startTime), date));
  };

  const openCreateEventDialog = (day?: Date | null) => {
    const base = day || selectedDate || new Date();
    const start = new Date(base);
    start.setHours(18, 0, 0, 0);
    const end = new Date(base);
    end.setHours(19, 0, 0, 0);
    setSelectedSchoolEvent(null);
    setEventFormData({
      title: '',
      description: '',
      type: 'parent_meeting',
      date: base,
      startTime: start,
      endTime: end,
      location: '',
      branchId: '',
      groupId: '',
    });
    setEventDialog(true);
  };

  const openEditEventDialog = (event: any) => {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    setSelectedSchoolEvent(event);
    setEventFormData({
      title: event.title || '',
      description: event.description || '',
      type: event.type === 'parent_meeting' ? 'parent_meeting' : 'other',
      date: start,
      startTime: start,
      endTime: end,
      location: event.location || '',
      branchId: event.branchId || '',
      groupId: event.groupId || '',
    });
    setEventDetailDialog(false);
    setEventDialog(true);
  };

  const combineEventDateTime = (date: Date | null, time: Date | null) => {
    if (!date || !time) return null;
    const result = new Date(date);
    result.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return result;
  };

  const handleSaveSchoolEvent = async () => {
    const startTime = combineEventDateTime(eventFormData.date, eventFormData.startTime);
    const endTime = combineEventDateTime(eventFormData.date, eventFormData.endTime);
    if (!eventFormData.title.trim()) {
      alert('Укажите название события');
      return;
    }
    if (!startTime || !endTime) {
      alert('Укажите дату и время');
      return;
    }
    if (endTime <= startTime) {
      alert('Время окончания должно быть позже начала');
      return;
    }

    try {
      setEventSaving(true);
      const payload = {
        title: eventFormData.title.trim(),
        description: eventFormData.description.trim() || null,
        type: eventFormData.type,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        location: eventFormData.location.trim() || null,
        branchId: eventFormData.branchId || null,
        groupId: eventFormData.groupId || null,
      };
      if (selectedSchoolEvent?.id) {
        await apiService.updateSchoolEvent(selectedSchoolEvent.id, payload);
      } else {
        await apiService.createSchoolEvent(payload);
      }
      setEventDialog(false);
      setSelectedSchoolEvent(null);
      const events = await apiService.getSchoolEvents().catch(() => []);
      setSchoolEvents(events || []);
    } catch (err: any) {
      console.error('Error saving school event:', err);
      alert(err.response?.data?.error || 'Не удалось сохранить событие');
    } finally {
      setEventSaving(false);
    }
  };

  const handleDeleteSchoolEvent = async () => {
    if (!selectedSchoolEvent?.id) return;
    if (!window.confirm('Удалить это событие?')) return;
    try {
      await apiService.deleteSchoolEvent(selectedSchoolEvent.id);
      setEventDetailDialog(false);
      setSelectedSchoolEvent(null);
      setSchoolEvents((prev) => prev.filter((e) => e.id !== selectedSchoolEvent.id));
    } catch (err: any) {
      console.error('Error deleting school event:', err);
      alert(err.response?.data?.error || 'Не удалось удалить событие');
    }
  };

  const schoolEventTypeLabel = (type: string) =>
    type === 'parent_meeting' ? 'Родительское собрание' : 'Мероприятие';

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for schedule grid
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
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 1, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" component="h1" sx={{ fontWeight: 700, fontSize: { xs: 18, md: 20 } }}>
            Календарный план
          </Typography>
          {sectionTab === 'schedule' && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<Add />}
              sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}
              onClick={() => {
                setSelectedDayForTraining(null);
                setFormData({ ...formData, date: new Date() });
                setTrainingTypeDialog(true);
              }}
            >
              Добавить тренировку
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}
              onClick={() => openCreateEventDialog(selectedDate)}
            >
              Добавить событие
            </Button>
          </Stack>
          )}
        </Box>

        <Tabs
          value={sectionTab}
          onChange={(_, v) => setSectionTab(v)}
          variant={isNarrow ? 'fullWidth' : 'standard'}
          sx={{
            mb: 1,
            minHeight: 40,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { minHeight: 40, py: 0.5, textTransform: 'none', fontSize: { xs: 13, md: 14 } },
          }}
        >
          <Tab value="schedule" label="Расписание" icon={<CalendarToday sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab value="competitions" label="Соревнования" icon={<EmojiEvents sx={{ fontSize: 18 }} />} iconPosition="start" />
        </Tabs>

        {sectionTab === 'competitions' ? (
          <CompetitionsPanel embedded />
        ) : (
        <>
        {/* Filters and View Toggle */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', width: { xs: '100%', md: 'auto' } }}>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
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
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
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
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
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
            size="small"
            onChange={(e, newMode) => {
              if (newMode !== null) setViewMode(newMode);
              }}
            aria-label="view mode"
            sx={{ width: { xs: '100%', sm: 'auto' }, '& .MuiToggleButton-root': { flex: { xs: 1, sm: 'none' } } }}
          >
            <ToggleButton value="day" aria-label="day view">
              День
            </ToggleButton>
            <ToggleButton value="week" aria-label="week view" sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
              Неделя
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Week / Day Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <IconButton
            onClick={() =>
              setSelectedDate(
                viewMode === 'day' || isMobile
                  ? subDays(selectedDate, 1)
                  : new Date(selectedDate.getTime() - 7 * 24 * 60 * 60 * 1000)
              )
            }
            size="small"
          >
            <ChevronLeft />
          </IconButton>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: { xs: 14, md: 16 }, textAlign: 'center' }}>
            {viewMode === 'day' || isMobile
              ? format(selectedDate, 'd MMMM yyyy, EEE', { locale: ru })
              : `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'd MMMM', { locale: ru })} — ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'd MMMM', { locale: ru })}`}
          </Typography>
          <IconButton
            onClick={() =>
              setSelectedDate(
                viewMode === 'day' || isMobile
                  ? addDays(selectedDate, 1)
                  : new Date(selectedDate.getTime() + 7 * 24 * 60 * 60 * 1000)
              )
            }
            size="small"
          >
            <ChevronRight />
          </IconButton>
        </Box>

        {/* Calendar Grid - Week View (desktop) / Day list (mobile) */}
        {isMobile || viewMode === 'day' ? (
          (() => {
            const day = selectedDate;
            const dayTrainings = getTrainingsForDate(day).slice().sort(
              (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
            );
            const dayCompetitions = getCompetitionsForDate(day);
            const dayEvents = getSchoolEventsForDate(day);
            const isToday = isSameDay(day, new Date());
            return (
              <Stack spacing={1.5}>
                <Card variant="outlined" sx={{ bgcolor: isToday ? 'action.selected' : undefined }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: (dayCompetitions.length || dayEvents.length) ? 1 : 0 }}>
                      <Typography sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                        {format(day, 'EEEE, d MMMM', { locale: ru })}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        <Button
                          size="small"
                          startIcon={<Add />}
                          onClick={() => {
                            setSelectedDayForTraining(day);
                            setFormData({ ...formData, date: day });
                            setTrainingTypeDialog(true);
                          }}
                        >
                          Тренировка
                        </Button>
                        <Button
                          size="small"
                          startIcon={<Add />}
                          onClick={() => openCreateEventDialog(day)}
                        >
                          Событие
                        </Button>
                      </Stack>
                    </Box>
                    {dayCompetitions.map((competition) => (
                      <Chip
                        key={competition.id}
                        icon={<EmojiEvents sx={{ fontSize: 14 }} />}
                        label={competition.name}
                        size="small"
                        color="warning"
                        sx={{ mr: 0.5, mb: 0.5 }}
                        onClick={() => {
                          setSelectedCompetition(competition);
                          setCompetitionDialog(true);
                        }}
                      />
                    ))}
                    {dayEvents.map((event) => (
                      <Chip
                        key={event.id}
                        icon={<CalendarToday sx={{ fontSize: 14 }} />}
                        label={event.title}
                        size="small"
                        color="info"
                        sx={{ mr: 0.5, mb: 0.5 }}
                        onClick={() => {
                          setSelectedSchoolEvent(event);
                          setEventDetailDialog(true);
                        }}
                      />
                    ))}
                  </CardContent>
                </Card>
                {dayEvents.length > 0 && dayEvents.map((event) => (
                  <Paper
                    key={`evt-${event.id}`}
                    sx={{
                      p: 1.5,
                      bgcolor: '#E3F2FD',
                      color: '#0D47A1',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setSelectedSchoolEvent(event);
                      setEventDetailDialog(true);
                    }}
                  >
                    <Typography sx={{ fontWeight: 700 }}>{event.title}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      {schoolEventTypeLabel(event.type)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <AccessTime sx={{ fontSize: 14 }} />
                      <Typography variant="body2">
                        {format(new Date(event.startTime), 'HH:mm')} – {format(new Date(event.endTime), 'HH:mm')}
                      </Typography>
                    </Box>
                    {event.location && (
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>
                        {event.location}
                      </Typography>
                    )}
                  </Paper>
                ))}
                {dayTrainings.length === 0 ? (
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">Нет тренировок на этот день</Typography>
                  </Paper>
                ) : (
                  dayTrainings.map((training) => {
                    const group = groups.find((g) => g.id === training.groupId);
                    const trainer = trainers.find((t) => t.id === training.trainerId);
                    const hall = halls.find((h) => h.id === training.hallId);
                    const groupColor = group?.color || '#4880FF';
                    const isLightColor = isColorLight(groupColor);
                    return (
                      <Paper
                        key={training.id}
                        sx={{
                          p: 1.5,
                          bgcolor: groupColor,
                          color: isLightColor ? '#000' : '#fff',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleOpenAttendanceDialog(training)}
                      >
                        <Typography sx={{ fontWeight: 700 }}>{training.title || group?.name || 'Тренировка'}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <AccessTime sx={{ fontSize: 14 }} />
                          <Typography variant="body2">
                            {format(new Date(training.startTime), 'HH:mm')} – {format(new Date(training.endTime), 'HH:mm')}
                          </Typography>
                        </Box>
                        {trainer?.user && (
                          <Typography variant="body2" sx={{ mt: 0.25, opacity: 0.9 }}>
                            {trainer.user.lastName} {trainer.user.firstName}
                          </Typography>
                        )}
                        {hall && (
                          <Typography variant="caption" sx={{ opacity: 0.85 }}>
                            Зал: {hall.name}
                          </Typography>
                        )}
                      </Paper>
                    );
                  })
                )}
              </Stack>
            );
          })()
        ) : viewMode === 'week' ? (
          <Paper sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
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
                const dayEvents = getSchoolEventsForDate(day);
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
                        setTrainingTypeDialog(true);
                      }}
                    >
                      {/* Competitions / events in header */}
                      {(dayCompetitions.length > 0 || dayEvents.length > 0) && (
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
                          {dayEvents.map((event) => (
                            <Chip
                              key={event.id}
                              icon={<CalendarToday sx={{ fontSize: 12 }} />}
                              label={event.title}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.6rem',
                                bgcolor: 'info.main',
                                color: '#fff',
                                mb: 0.5,
                                '& .MuiChip-label': {
                                  px: 0.5
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSchoolEvent(event);
                                setEventDetailDialog(true);
                              }}
                            />
                          ))}
                        </Box>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize', mt: (dayCompetitions.length > 0 || dayEvents.length > 0) ? 2 : 0 }}>
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
                          const substituteTrainer = training.substituteTrainerId ? trainers.find(t => t.id === training.substituteTrainerId) : null;
                          const hall = halls.find(h => h.id === training.hallId);
                          const branch = branches.find(b => b.id === training.branchId);
                          const groupColor = group?.color || '#4880FF';
                          const isLightColor = isColorLight(groupColor);
                          const style = getTrainingBlockStyle(training, day, timeTrainings);
                          const startTime = format(new Date(training.startTime), 'HH:mm');
                          const endTime = format(new Date(training.endTime), 'HH:mm');
                          const trainerName = trainer?.user 
                            ? `${trainer.user.lastName} ${trainer.user.firstName.charAt(0)}.`
                            : 'Тренер';
                          const isSubstitute = !!training.substituteTrainerId;
                          const availableSpots = group?.maxMembers ? group.maxMembers : (training.groupId ? '?' : 'Индивидуальная');
                          
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
                                {training.groupId ? `Свободно ${availableSpots} мест` : 'Индивидуальная тренировка'}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, gap: 0.25 }}>
                                <People sx={{ fontSize: 10 }} />
                                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                                  {isSubstitute && substituteTrainer?.user 
                                    ? `Замена: ${substituteTrainer.user.lastName} ${substituteTrainer.user.firstName.charAt(0)}.`
                                    : trainerName}
                                </Typography>
                                {isSubstitute && (
                                  <Chip 
                                    label="Замена" 
                                    size="small" 
                                    sx={{ 
                                      height: 14, 
                                      fontSize: '0.5rem', 
                                      ml: 0.5,
                                      bgcolor: 'warning.main',
                                      color: 'white'
                                    }} 
                                  />
                                )}
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
        ) : null}

        {/* Training Type Selection Dialog */}
        <Dialog open={trainingTypeDialog} onClose={() => setTrainingTypeDialog(false)} maxWidth="sm" fullWidth fullScreen={isNarrow}>
          <DialogTitle>
            Какое занятие вы хотите добавить?
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                onClick={() => {
                  setFormData(prev => ({ ...prev, trainingType: 'group', groupId: '', selectedClientIds: [] }));
                  setTrainingTypeDialog(false);
                  setOpenDialog(true);
                }}
                sx={{ py: 2 }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <GroupIcon sx={{ fontSize: 40 }} />
                  <Typography variant="h6">Тренировка группы</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Создать тренировку для группы
                  </Typography>
                </Box>
              </Button>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                onClick={() => {
                  setFormData(prev => ({ ...prev, trainingType: 'individual', groupId: '', selectedClientIds: [] }));
                  setTrainingTypeDialog(false);
                  setOpenDialog(true);
                }}
                sx={{ py: 2 }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Person sx={{ fontSize: 40 }} />
                  <Typography variant="h6">Индивидуальная тренировка</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Создать разовую тренировку для выбранных клиентов
                  </Typography>
                </Box>
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTrainingTypeDialog(false)}>Отмена</Button>
          </DialogActions>
        </Dialog>

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
              
              {/* Тип тренировки отображается как информационный блок (уже выбран в предыдущем диалоге) */}
              <Grid item xs={12}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'background.default' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Тип тренировки
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                    {formData.trainingType === 'group' ? 'Тренировка для группы' : 'Индивидуальная тренировка (разовая)'}
                  </Typography>
                </Box>
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
              
              {/* Поле выбора группы - показывается только для групповой тренировки */}
              {formData.trainingType === 'group' && (
              <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
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
              )}
              
              {/* Выбор клиентов для индивидуальной тренировки */}
              {formData.trainingType === 'individual' && (
                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    disableCloseOnSelect
                    options={clients.filter(c => c.isActive)}
                    getOptionLabel={(option) => {
                      const fullName = [option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ').trim();
                      return fullName || `${option.firstName} ${option.lastName}`;
                    }}
                    value={clients.filter(c => formData.selectedClientIds.includes(c.id))}
                    onChange={(event, newValue) => {
                      setFormData({
                        ...formData,
                        selectedClientIds: newValue.map(client => client.id)
                      });
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Клиенты"
                        placeholder="Начните вводить ФИО, телефон или email..."
                        required
                      />
                    )}
                    renderOption={(props, option) => {
                      const isSelected = formData.selectedClientIds.includes(option.id);
                      return (
                        <li {...props} key={option.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <Checkbox
                              checked={isSelected}
                              sx={{ mr: 1 }}
                            />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body1">
                                {[option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ').trim() || `${option.firstName} ${option.lastName}`}
                              </Typography>
                              {(option.phone || option.email) && (
                                <Typography variant="body2" color="text.secondary">
                                  {option.phone || option.email}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </li>
                      );
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option.id}
                          label={[option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ').trim() || `${option.firstName} ${option.lastName}`}
                        />
                      ))
                    }
                    filterOptions={(options, { inputValue }) => {
                      const query = inputValue.toLowerCase();
                      return options.filter(option => {
                        const fullName = [option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ').toLowerCase();
                        const phone = (option.phone || '').toLowerCase();
                        const email = (option.email || '').toLowerCase();
                        return fullName.includes(query) || phone.includes(query) || email.includes(query);
                      });
                    }}
                  />
                </Grid>
              )}
              
              {/* Поля для индивидуальной тренировки: цена и заработок тренера */}
              {formData.trainingType === 'individual' && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Цена тренировки (руб.)"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Тип заработка тренера</InputLabel>
                      <Select
                        value={formData.trainerEarningType}
                        onChange={(e) => setFormData({ ...formData, trainerEarningType: e.target.value as 'percentage' | 'amount' | '', trainerEarningValue: '' })}
                      >
                        <MenuItem value="">Не указано</MenuItem>
                        <MenuItem value="percentage">Процент</MenuItem>
                        <MenuItem value="amount">Фиксированная сумма</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  {formData.trainerEarningType && (
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label={formData.trainerEarningType === 'percentage' ? 'Процент (%)' : 'Сумма (руб.)'}
                        type="number"
                        value={formData.trainerEarningValue}
                        onChange={(e) => setFormData({ ...formData, trainerEarningValue: e.target.value })}
                        inputProps={{ min: 0, step: formData.trainerEarningType === 'percentage' ? 0.1 : 0.01 }}
                      />
                    </Grid>
                  )}
                </>
              )}
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Тренер</InputLabel>
                  <Select
                    value={formData.trainerId}
                    onChange={async (e) => {
                      const trainerId = e.target.value;
                      setFormData({ ...formData, trainerId, substituteTrainerId: '', competitionConflict: false });
                      
                      // Проверяем конфликты с соревнованиями, если указаны дата и время
                      if (trainerId && formData.date && formData.startTime && formData.endTime) {
                        const startDate = new Date(formData.date);
                        startDate.setHours(formData.startTime.getHours(), formData.startTime.getMinutes());
                        const endDate = new Date(formData.date);
                        endDate.setHours(formData.endTime.getHours(), formData.endTime.getMinutes());
                        
                        try {
                          // Проверяем конфликты через локальную проверку
                          const trainerCompetitions = competitions.filter(comp => {
                            const compStart = new Date(comp.startDate);
                            const compEnd = new Date(comp.endDate);
                            return comp.trainers?.some(ct => ct.trainerId === trainerId) &&
                                   compStart <= endDate && compEnd >= startDate;
                          });
                          
                          if (trainerCompetitions.length > 0) {
                            setFormData(prev => ({ ...prev, competitionConflict: true }));
                          }
                        } catch (err) {
                          console.error('Error checking competition conflicts:', err);
                        }
                      }
                    }}
                  >
                    {trainers.map((trainer) => (
                      <MenuItem key={trainer.id} value={trainer.id}>
                        {trainer.user ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim() : `Тренер #${trainer.id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {/* Поле для выбора замены тренера - показывается только для OWNER, ADMIN или тренера с canViewAllGroups */}
              {(user?.role === 'OWNER' || user?.role === 'ADMIN' || (user?.role === 'TRAINER' && trainers.find(t => t.userId === user?.id)?.canViewAllGroups)) && formData.trainerId && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Замена тренера (необязательно)</InputLabel>
                    <Select
                      value={formData.substituteTrainerId}
                      onChange={(e) => {
                        const substituteTrainerId = e.target.value;
                        setFormData({ 
                          ...formData, 
                          substituteTrainerId,
                          originalTrainerId: substituteTrainerId ? formData.trainerId : '',
                          competitionConflict: false
                        });
                      }}
                    >
                      <MenuItem value="">
                        <em>Не выбрана</em>
                      </MenuItem>
                      {trainers.filter(t => t.id !== formData.trainerId).map((trainer) => (
                        <MenuItem key={trainer.id} value={trainer.id}>
                          {trainer.user ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim() : `Тренер #${trainer.id}`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {/* Предупреждение о конфликте с соревнованием */}
              {formData.competitionConflict && !formData.substituteTrainerId && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    У выбранного тренера есть соревнование в указанные даты. Пожалуйста, выберите замену тренера.
                  </Alert>
                </Grid>
              )}
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
        <Dialog open={editDialog} onClose={() => !isUpdating && setEditDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Редактировать тренировку
            {isUpdating && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', ml: 2 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Обновление...
                </Typography>
              </Box>
            )}
          </DialogTitle>
          <DialogContent>
            {isUpdating && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 3 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ ml: 2 }}>
                  Идет обновление тренировки. Пожалуйста, подождите...
                </Typography>
              </Box>
            )}
            <Box sx={{ opacity: isUpdating ? 0.5 : 1, pointerEvents: isUpdating ? 'none' : 'auto' }}>
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
                    onChange={async (e) => {
                      const trainerId = e.target.value;
                      setFormData({ ...formData, trainerId, substituteTrainerId: '', competitionConflict: false });
                      
                      // Проверяем конфликты с соревнованиями, если указаны дата и время
                      if (trainerId && formData.date && formData.startTime && formData.endTime) {
                        const startDate = new Date(formData.date);
                        startDate.setHours(formData.startTime.getHours(), formData.startTime.getMinutes());
                        const endDate = new Date(formData.date);
                        endDate.setHours(formData.endTime.getHours(), formData.endTime.getMinutes());
                        
                        try {
                          // Проверяем конфликты через локальную проверку
                          const trainerCompetitions = competitions.filter(comp => {
                            const compStart = new Date(comp.startDate);
                            const compEnd = new Date(comp.endDate);
                            return comp.trainers?.some(ct => ct.trainerId === trainerId) &&
                                   compStart <= endDate && compEnd >= startDate;
                          });
                          
                          if (trainerCompetitions.length > 0) {
                            setFormData(prev => ({ ...prev, competitionConflict: true }));
                          }
                        } catch (err) {
                          console.error('Error checking competition conflicts:', err);
                        }
                      }
                    }}
                  >
                    {trainers.map((trainer) => (
                      <MenuItem key={trainer.id} value={trainer.id}>
                        {trainer.user ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim() : `Тренер #${trainer.id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {/* Поле для выбора замены тренера - показывается только для OWNER, ADMIN или тренера с canViewAllGroups */}
              {(user?.role === 'OWNER' || user?.role === 'ADMIN' || (user?.role === 'TRAINER' && trainers.find(t => t.userId === user?.id)?.canViewAllGroups)) && formData.trainerId && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Замена тренера (необязательно)</InputLabel>
                    <Select
                      value={formData.substituteTrainerId}
                      onChange={(e) => {
                        const substituteTrainerId = e.target.value;
                        setFormData({ 
                          ...formData, 
                          substituteTrainerId,
                          originalTrainerId: substituteTrainerId ? formData.trainerId : '',
                          competitionConflict: false
                        });
                      }}
                    >
                      <MenuItem value="">
                        <em>Не выбрана</em>
                      </MenuItem>
                      {trainers.filter(t => t.id !== formData.trainerId).map((trainer) => (
                        <MenuItem key={trainer.id} value={trainer.id}>
                          {trainer.user ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim() : `Тренер #${trainer.id}`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {/* Предупреждение о конфликте с соревнованием */}
              {formData.competitionConflict && !formData.substituteTrainerId && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    У выбранного тренера есть соревнование в указанные даты. Пожалуйста, выберите замену тренера.
                  </Alert>
                </Grid>
              )}
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
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => {
                if (!isUpdating) {
              setEditDialog(false);
              resetForm();
                }
              }}
              disabled={isUpdating}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleUpdateTraining} 
              variant="contained"
              disabled={isUpdating}
              startIcon={isUpdating ? <CircularProgress size={16} /> : null}
            >
              {isUpdating ? 'Обновление...' : 'Сохранить изменения'}
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
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={async () => {
                    if (!selectedTraining) return;
                    
                    // Используем уже загруженные тренировки из состояния вместо нового запроса
                    // Проверяем, является ли тренировка частью регулярной серии
                    let shouldDeleteSeries = false;
                    let seriesTrainings: Training[] = [];
                    
                    if (selectedTraining.isRecurring) {
                      try {
                        // Используем уже загруженные тренировки из состояния
                        seriesTrainings = trainings.filter((t: Training) => 
                          t.title === selectedTraining.title &&
                          (t.groupId === selectedTraining.groupId || (!t.groupId && !selectedTraining.groupId)) &&
                          t.trainerId === selectedTraining.trainerId &&
                          t.branchId === selectedTraining.branchId &&
                          t.isRecurring &&
                          !t.isCancelled &&
                          t.id !== selectedTraining.id
                        );
                        
                        if (seriesTrainings.length > 0) {
                          const confirmMessage = `Эта тренировка является частью регулярной серии (${seriesTrainings.length + 1} тренировок).\n\nУдалить всю серию тренировок?`;
                          shouldDeleteSeries = window.confirm(confirmMessage);
                        } else {
                          // Это единственная тренировка в серии, просто подтверждаем удаление
                          if (!window.confirm('Вы уверены, что хотите удалить эту тренировку?')) {
                            return;
                          }
                        }
                      } catch (error) {
                        console.error('Error checking training series:', error);
                        // В случае ошибки просто спрашиваем об удалении одной тренировки
                        if (!window.confirm('Вы уверены, что хотите удалить эту тренировку?')) {
                          return;
                        }
                      }
                    } else {
                      // Обычная тренировка - просто подтверждаем удаление
                      if (!window.confirm('Вы уверены, что хотите удалить эту тренировку?')) {
                        return;
                      }
                    }
                    
                    try {
                      if (shouldDeleteSeries && seriesTrainings.length > 0) {
                        // Удаляем всю серию - включаем текущую тренировку
                        const allSeriesTrainings = [...seriesTrainings, selectedTraining];
                        const trainingIds = allSeriesTrainings.map(t => t.id);
                        
                        try {
                          await apiService.deleteTrainingsBatch(trainingIds);
                          alert(`Успешно удалено ${allSeriesTrainings.length} тренировок из серии`);
                        } catch (err: any) {
                          console.error('Error deleting trainings batch:', err);
                          
                          // Если batch не удался из-за 429, пробуем удалять по одной с задержками
                          if (err.response?.status === 429) {
                            alert('Слишком много запросов. Удаление может занять некоторое время...');
                            let deletedCount = 0;
                            for (let i = 0; i < allSeriesTrainings.length; i++) {
                              const t = allSeriesTrainings[i];
                              try {
                                await apiService.deleteTraining(t.id);
                                deletedCount++;
                                // Задержка между запросами для избежания 429
                                if (i < allSeriesTrainings.length - 1) {
                                  await new Promise(resolve => setTimeout(resolve, 500));
                                }
                              } catch (deleteErr: any) {
                                console.error('Error deleting training:', deleteErr);
                                // Если ошибка 429, ждем дольше и повторяем
                                if (deleteErr.response?.status === 429) {
                                  await new Promise(resolve => setTimeout(resolve, 2000));
                                  try {
                                    await apiService.deleteTraining(t.id);
                                    deletedCount++;
                                  } catch (retryErr: any) {
                                    console.error('Error deleting training after retry:', retryErr);
                                  }
                                }
                              }
                            }
                            alert(`Удалено ${deletedCount} из ${allSeriesTrainings.length} тренировок из серии`);
                          } else {
                            // Другая ошибка - пробуем удалять по одной
                            for (const t of allSeriesTrainings) {
                              try {
                                await apiService.deleteTraining(t.id);
                                await new Promise(resolve => setTimeout(resolve, 300));
                              } catch (deleteErr: any) {
                                console.error('Error deleting training:', deleteErr);
                              }
                            }
                            alert(`Удалено ${allSeriesTrainings.length} тренировок из серии`);
                          }
                        }
                      } else {
                        // Удаляем только одну тренировку
                        try {
                          await apiService.deleteTraining(selectedTraining.id);
                          alert('Тренировка успешно удалена');
                        } catch (error: any) {
                          // Если ошибка 429, ждем и повторяем
                          if (error.response?.status === 429) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            try {
                              await apiService.deleteTraining(selectedTraining.id);
                              alert('Тренировка успешно удалена');
                            } catch (retryErr: any) {
                              throw retryErr;
                            }
                          } else {
                            throw error;
                          }
                        }
                      }
                      
                      await fetchData();
                      setAttendanceDialog(false);
                      setSelectedTraining(null);
                    } catch (error: any) {
                      console.error('Error deleting training:', error);
                      alert('Не удалось удалить тренировку: ' + (error.response?.data?.error || error.message));
                    }
                  }}
                >
                  Удалить тренировку
                </Button>
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
                  startIcon={<Person />}
                  onClick={() => {
                    setAddClientDialog(true);
                  }}
                >
                  Добавить клиента
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
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedTraining?.groupId ? 'В группе нет участников' : 'Нет клиентов в тренировке'}
              </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Person />}
                  onClick={() => setAddClientDialog(true)}
                >
                  Добавить клиента
                </Button>
              </Box>
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
                            <ClientNameLink clientId={item.client.id} client={item.client} />
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

        {/* Add Existing Client Dialog */}
        <Dialog open={addClientDialog} onClose={() => {
          setAddClientDialog(false);
          setSelectedClientsToAdd([]);
        }} maxWidth="md" fullWidth>
          <DialogTitle>Добавить клиентов в тренировку</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Autocomplete
                multiple
                disableCloseOnSelect
                options={clients.filter(client => client.isActive && !attendanceData.find(item => item.client.id === client.id))}
                getOptionLabel={(option) => {
                  const fullName = [option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ').trim();
                  return fullName || `${option.firstName} ${option.lastName}`;
                }}
                value={selectedClientsToAdd}
                onChange={(event, newValue) => {
                  setSelectedClientsToAdd(newValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Выберите клиентов (можно несколько)"
                    placeholder="Начните вводить ФИО, телефон или email..."
                  />
                )}
                renderOption={(props, option) => {
                  const isSelected = selectedClientsToAdd.some(c => c.id === option.id);
                  return (
                    <li {...props} key={option.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Checkbox
                          checked={isSelected}
                          sx={{ mr: 1 }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body1">
                            {[option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ').trim() || `${option.firstName} ${option.lastName}`}
                          </Typography>
                          {(option.phone || option.email) && (
                            <Typography variant="body2" color="text.secondary">
                              {option.phone || option.email}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </li>
                  );
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      label={[option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ').trim() || `${option.firstName} ${option.lastName}`}
                      size="small"
                    />
                  ))
                }
                filterOptions={(options, { inputValue }) => {
                  const query = inputValue.toLowerCase();
                  return options.filter(option => {
                    const fullName = [option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ').toLowerCase();
                    const phone = (option.phone || '').toLowerCase();
                    const email = (option.email || '').toLowerCase();
                    return fullName.includes(query) || phone.includes(query) || email.includes(query);
                  });
                }}
              />
            </Box>
            {clients.filter(client => client.isActive && !attendanceData.find(item => item.client.id === client.id)).length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                Все активные клиенты уже добавлены в тренировку
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setAddClientDialog(false);
              setSelectedClientsToAdd([]);
            }}>Отмена</Button>
            <Button
              variant="contained"
              onClick={async () => {
                if (!selectedTraining || selectedClientsToAdd.length === 0) return;
                
                try {
                  // Добавляем выбранных клиентов в список посещаемости
                  const newAttendanceItems = selectedClientsToAdd
                    .filter(client => !attendanceData.find(item => item.client.id === client.id))
                    .map(client => ({
                      client,
                      attendance: {
                        id: '',
                        status: 'PRESENT' as 'PRESENT' | 'ABSENT' | 'EXCUSED',
                        clientId: client.id,
                        trainingId: selectedTraining.id,
                        notes: '',
                        shouldCharge: false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                      } as Attendance
                    }));
                  
                  setAttendanceData(prev => [...prev, ...newAttendanceItems]);
                  
                  // Сохраняем посещаемость на сервере
                  const attendances = newAttendanceItems.map(item => ({
                    clientId: item.client.id,
                    status: item.attendance.status,
                    notes: item.attendance.notes || '',
                    shouldCharge: item.attendance.shouldCharge
                  }));
                  
                  if (attendances.length > 0) {
                    await apiService.bulkUpdateAttendance(selectedTraining.id, attendances);
                  }
                  
                  setAddClientDialog(false);
                  setSelectedClientsToAdd([]);
                } catch (error: any) {
                  console.error('Error adding clients to training:', error);
                  alert('Не удалось добавить клиентов: ' + (error.response?.data?.error || error.message));
                }
              }}
              disabled={selectedClientsToAdd.length === 0}
            >
              Добавить ({selectedClientsToAdd.length})
            </Button>
          </DialogActions>
        </Dialog>
        </>
        )}

        <Dialog open={eventDialog} onClose={() => setEventDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{selectedSchoolEvent ? 'Редактировать событие' : 'Добавить событие'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Название"
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Тип</InputLabel>
                  <Select
                    value={eventFormData.type}
                    label="Тип"
                    onChange={(e) =>
                      setEventFormData((prev) => ({
                        ...prev,
                        type: e.target.value as 'parent_meeting' | 'other',
                      }))
                    }
                  >
                    <MenuItem value="parent_meeting">Родительское собрание</MenuItem>
                    <MenuItem value="other">Другое мероприятие</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <DatePicker
                  label="Дата"
                  value={eventFormData.date}
                  onChange={(date) => setEventFormData((prev) => ({ ...prev, date }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TimePicker
                  label="Начало"
                  value={eventFormData.startTime}
                  onChange={(time) => setEventFormData((prev) => ({ ...prev, startTime: time }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TimePicker
                  label="Конец"
                  value={eventFormData.endTime}
                  onChange={(time) => setEventFormData((prev) => ({ ...prev, endTime: time }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Описание"
                  multiline
                  rows={2}
                  value={eventFormData.description}
                  onChange={(e) => setEventFormData((prev) => ({ ...prev, description: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Место"
                  value={eventFormData.location}
                  onChange={(e) => setEventFormData((prev) => ({ ...prev, location: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Филиал</InputLabel>
                  <Select
                    value={eventFormData.branchId}
                    label="Филиал"
                    onChange={(e) => setEventFormData((prev) => ({ ...prev, branchId: e.target.value }))}
                  >
                    <MenuItem value="">Не выбран</MenuItem>
                    {branches.map((b) => (
                      <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Группа</InputLabel>
                  <Select
                    value={eventFormData.groupId}
                    label="Группа"
                    onChange={(e) => setEventFormData((prev) => ({ ...prev, groupId: e.target.value }))}
                  >
                    <MenuItem value="">Не выбрана</MenuItem>
                    {groups.filter((g) => g.isActive).map((g) => (
                      <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEventDialog(false)} sx={{ textTransform: 'none' }}>
              Отмена
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveSchoolEvent}
              disabled={eventSaving}
              sx={{ textTransform: 'none' }}
            >
              {eventSaving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={eventDetailDialog} onClose={() => setEventDetailDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{selectedSchoolEvent?.title || 'Событие'}</DialogTitle>
          <DialogContent>
            {selectedSchoolEvent && (
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {schoolEventTypeLabel(selectedSchoolEvent.type)}
                </Typography>
                <Typography variant="body2">
                  {format(new Date(selectedSchoolEvent.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
                  {' – '}
                  {format(new Date(selectedSchoolEvent.endTime), 'HH:mm')}
                </Typography>
                {selectedSchoolEvent.location && (
                  <Typography variant="body2">Место: {selectedSchoolEvent.location}</Typography>
                )}
                {selectedSchoolEvent.branch?.name && (
                  <Typography variant="body2">Филиал: {selectedSchoolEvent.branch.name}</Typography>
                )}
                {selectedSchoolEvent.group?.name && (
                  <Typography variant="body2">Группа: {selectedSchoolEvent.group.name}</Typography>
                )}
                {selectedSchoolEvent.description && (
                  <Typography variant="body2">{selectedSchoolEvent.description}</Typography>
                )}
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button color="error" onClick={handleDeleteSchoolEvent} sx={{ textTransform: 'none' }}>
              Удалить
            </Button>
            <Button onClick={() => setEventDetailDialog(false)} sx={{ textTransform: 'none' }}>
              Закрыть
            </Button>
            <Button
              variant="contained"
              onClick={() => selectedSchoolEvent && openEditEventDialog(selectedSchoolEvent)}
              sx={{ textTransform: 'none' }}
            >
              Изменить
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Schedule;
