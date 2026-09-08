import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Chip,
  IconButton,
  CircularProgress,
  Alert,
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
  Checkbox,
  Snackbar,
  Divider,
  FormControlLabel,
  useMediaQuery,
  useTheme,
  Stack,
} from '@mui/material';
import { Autocomplete } from '@mui/material';
import { Add, Edit, Delete, People, CalendarToday } from '@mui/icons-material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import ClientNameLink from '../components/ClientNameLink';
import AttendanceExcelExport from '../components/AttendanceExcelExport';
import { Group, Branch, Trainer, Client, GroupScheduleItem, Hall } from '../types';
import { validateGroupForm, validateTrainerForm, validateBranchForm } from '../utils/validation';
import {
  GROUP_SALARY_SCHEME_OPTIONS,
  salaryRateFieldLabel,
  salarySchemeHint,
  normalizeSalaryScheme,
} from '../utils/salarySchemes';

const Groups: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const [groups, setGroups] = useState<Group[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [membersDialog, setMembersDialog] = useState(false);
  const [trainingDialog, setTrainingDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [shouldCreatePaymentsAfterSchedule, setShouldCreatePaymentsAfterSchedule] = useState(false); // Флаг для создания платежей после создания графика
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [clientSearchQuery] = useState<string>(''); // Поиск клиентов (setClientSearchQuery reserved for UI)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [halls, setHalls] = useState<Hall[]>([]);
  const [createTrainerDialog, setCreateTrainerDialog] = useState(false);
  const [createBranchDialog, setCreateBranchDialog] = useState(false);
  const [trainerFormData, setTrainerFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    middleName: '',
    phone: '',
    qualification: '',
    experience: '',
    specialization: '',
    salaryType: 'fixed',
    salaryAmount: '',
    salaryPercentage: '',
    canViewAllGroups: false,
  });
  const [branchFormData, setBranchFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    description: '',
  });
  const [trainerFormErrors, setTrainerFormErrors] = useState<Record<string, string>>({});
  const [branchFormErrors, setBranchFormErrors] = useState<Record<string, string>>({});
  const [trainingFormData, setTrainingFormData] = useState({
    title: '',
    description: '',
    date: new Date() as Date | null,
    startTime: null as Date | null,
    endTime: null as Date | null,
    groupId: '',
    trainerId: '',
    branchId: '',
    hallId: '',
    isRecurring: false,
    recurrence: 'weekly',
    daysOfWeek: [] as number[],
    recurrenceStartDate: new Date() as Date | null,
    recurrenceEndDate: null as Date | null,
    recurrenceMode: 'days' as 'days' | 'dates',
    daySchedules: [] as Array<{ dayOfWeek: number; startTime: Date | null; endTime: Date | null }>,
  });
  const LAST_GROUP_COLOR_KEY = 'crm2.lastGroupColor';
  const DEFAULT_GROUP_COLOR = '#4880FF';

  const getLastGroupColor = () => {
    try {
      return localStorage.getItem(LAST_GROUP_COLOR_KEY) || DEFAULT_GROUP_COLOR;
    } catch {
      return DEFAULT_GROUP_COLOR;
    }
  };

  const emptyGroupForm = () => ({
    name: '',
    description: '',
    maxMembers: '',
    ageMin: '',
    ageMax: '',
    color: getLastGroupColor(),
    branchId: '',
    trainerId: '',
    schedule: [] as GroupScheduleItem[],
    isMonthlyPayment: false,
    monthlyPaymentAmount: '',
    paymentDueDay: '',
    createPaymentsImmediately: false,
    salaryScheme: 'per_training_person' as string,
    salaryRate: '',
  });

  const [formData, setFormData] = useState(emptyGroupForm);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [groupsRes, branchesRes, trainersRes, clientsRes] = await Promise.all([
        apiService.getGroups(),
        apiService.getBranches(),
        apiService.getTrainers(),
        apiService.getClients({ limit: 100 }),
      ]);
      setGroups(groupsRes.data);
      setBranches(branchesRes.data);
      setTrainers(trainersRes.data);
      setClients(clientsRes.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Ошибка загрузки данных';
      setError(errorMessage);
      console.error('Error fetching data:', err);
      console.error('Error details:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });
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
        setError(null);
        const [groupsRes, branchesRes, trainersRes, clientsRes] = await Promise.all([
          apiService.getGroups({ limit: 1000, page: 1 }, abortController.signal),
          apiService.getBranches(undefined, abortController.signal),
          apiService.getTrainers(undefined, abortController.signal),
          apiService.getClients({ limit: 100 }, abortController.signal),
        ]);
        if (!isMounted || abortController.signal.aborted) return;
        setGroups(groupsRes.data);
        setBranches(branchesRes.data);
        setTrainers(trainersRes.data);
        setClients(clientsRes.data);
      } catch (err: any) {
        // Ignore cancelled requests
        if (err?.code === 'ERR_CANCELED' || err?.message === 'canceled' || abortController.signal.aborted) {
          return;
        }
        if (!isMounted) return;
        setError(err.response?.data?.error || 'Ошибка загрузки данных');
        console.error('Error fetching data:', err);
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

  const handleCreateGroup = async (openTrainingDialog: boolean = false) => {
    try {
      const groupData = {
        ...formData,
        maxMembers: formData.maxMembers ? parseInt(formData.maxMembers) : undefined,
        ageMin: formData.ageMin ? parseInt(formData.ageMin) : undefined,
        ageMax: formData.ageMax ? parseInt(formData.ageMax) : undefined,
        schedule: formData.schedule.length > 0 ? formData.schedule : undefined,
        isMonthlyPayment: formData.isMonthlyPayment,
        monthlyPaymentAmount: formData.monthlyPaymentAmount ? parseFloat(formData.monthlyPaymentAmount) : undefined,
        paymentDueDay: formData.paymentDueDay ? parseInt(formData.paymentDueDay) : undefined,
        salaryScheme: formData.salaryScheme || 'per_training_person',
        salaryRate: formData.salaryRate !== '' ? parseFloat(formData.salaryRate) : null,
        trainerSalaryType: null,
        trainerMonthlyPercentage: null,
        trainerPerVisitPercentage: null,
        trainerPerVisitAmount: null,
      };
      const createdGroup = await apiService.createGroup(groupData);

      try {
        localStorage.setItem(LAST_GROUP_COLOR_KEY, formData.color || DEFAULT_GROUP_COLOR);
      } catch {
        /* ignore */
      }
      
      // Добавляем выбранных участников в группу
      if (selectedClientIds && selectedClientIds.length > 0 && createdGroup && createdGroup.id) {
        try {
          for (const clientId of selectedClientIds) {
            try {
              await apiService.addClientToGroup(createdGroup.id, clientId);
            } catch (addErr: any) {
              console.error(`Error adding client ${clientId} to group:`, addErr);
              // Продолжаем добавлять остальных клиентов даже если один не добавился
            }
          }
        } catch (err: any) {
          console.error('Error adding clients to group:', err);
          // Не блокируем процесс, так как группа уже создана
        }
      }
      
      // Обновляем данные, но не блокируем процесс, если будет ошибка
      try {
        await fetchData();
      } catch (fetchErr: any) {
        console.error('Error fetching data after group creation:', fetchErr);
        // Показываем предупреждение, но не блокируем процесс
        const fetchErrorMessage = fetchErr.response?.data?.error || fetchErr.message || 'Ошибка обновления списка групп';
        console.warn(`Группа создана, но возникла ошибка при обновлении данных: ${fetchErrorMessage}`);
        // Не показываем ошибку пользователю, так как группа уже создана
      }
      
      setOpenDialog(false);
      setFormErrors({});
      setSelectedClientIds([]); // Очищаем выбранных клиентов
      
      // Сохраняем флаг создания платежей, если группа с ежемесячной оплатой
      if (formData.isMonthlyPayment && formData.createPaymentsImmediately) {
        setShouldCreatePaymentsAfterSchedule(true);
      } else {
        setShouldCreatePaymentsAfterSchedule(false);
      }
      
      // Если нужно открыть диалог создания тренировки
      if (openTrainingDialog && createdGroup && createdGroup.id) {
        // Загружаем полные данные группы для корректного отображения
        try {
          const fullGroup = await apiService.getGroup(createdGroup.id);
          await handleOpenTrainingDialog(fullGroup);
        } catch (err) {
          console.error('Error fetching created group:', err);
          // Если не удалось загрузить, используем созданную группу
          await handleOpenTrainingDialog(createdGroup);
        }
      }
      
      setFormData(emptyGroupForm());
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Ошибка создания группы';
      setError(errorMessage);
      console.error('Error creating group:', err);
      console.error('Error details:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
        stack: err.stack
      });
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Функции для управления графиком тренировок (reserved for schedule UI)
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const addScheduleItem = () => {
    setFormData(prev => ({
      ...prev,
      schedule: [...prev.schedule, { dayOfWeek: 1, startTime: '18:00', endTime: '19:30' }]
    }));
  };

  const removeScheduleItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== index)
    }));
  };

  const updateScheduleItem = (index: number, field: 'dayOfWeek' | 'startTime' | 'endTime', value: number | string) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  /* eslint-enable @typescript-eslint/no-unused-vars */

  // Функции для создания тренера и филиала
  const handleCreateTrainerFromGroup = async () => {
    const errors = validateTrainerForm(trainerFormData);
    setTrainerFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
      setSnackbarOpen(true);
      return;
    }

    try {
      const createdTrainer = await apiService.createTrainer({
        ...trainerFormData,
        salaryScheme: 'per_training_person',
        salaryRate: 0,
        salaryType: 'per_training_person',
        salaryAmount: 0,
      });
      // Обновляем список тренеров
      const trainersRes = await apiService.getTrainers();
      setTrainers(trainersRes.data);
      // Автоматически выбираем созданного тренера
      setFormData(prev => ({ ...prev, trainerId: createdTrainer.id }));
      // Закрываем диалог и очищаем форму
      setCreateTrainerDialog(false);
      setTrainerFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        middleName: '',
        phone: '',
        qualification: '',
        experience: '',
        specialization: '',
        salaryType: 'fixed',
        salaryAmount: '',
        salaryPercentage: '',
        canViewAllGroups: false,
      });
      setTrainerFormErrors({});
      setSnackbarMessage('Тренер успешно создан');
      setSnackbarOpen(true);
    } catch (err: any) {
      setSnackbarMessage(err.response?.data?.error || 'Ошибка создания тренера');
      setSnackbarOpen(true);
      console.error('Error creating trainer:', err);
    }
  };

  const handleCreateBranchFromGroup = async () => {
    const errors = validateBranchForm(branchFormData);
    setBranchFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
      setSnackbarOpen(true);
      return;
    }

    try {
      const createdBranch = await apiService.createBranch(branchFormData);
      // Обновляем список филиалов
      const branchesRes = await apiService.getBranches();
      setBranches(branchesRes.data);
      // Автоматически выбираем созданный филиал
      setFormData(prev => ({ ...prev, branchId: createdBranch.id }));
      // Закрываем диалог и очищаем форму
      setCreateBranchDialog(false);
      setBranchFormData({
        name: '',
        address: '',
        phone: '',
        email: '',
        description: '',
      });
      setBranchFormErrors({});
      setSnackbarMessage('Филиал успешно создан');
      setSnackbarOpen(true);
    } catch (err: any) {
      setSnackbarMessage(err.response?.data?.error || 'Ошибка создания филиала');
      setSnackbarOpen(true);
      console.error('Error creating branch:', err);
    }
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    // Парсим schedule из JSON строки, если она есть
    let schedule: GroupScheduleItem[] = [];
    if (group.schedule) {
      if (typeof group.schedule === 'string') {
        try {
          schedule = JSON.parse(group.schedule);
        } catch (e) {
          console.error('Error parsing schedule:', e);
        }
      } else if (Array.isArray(group.schedule)) {
        schedule = group.schedule;
      }
    }
    setFormData({
      name: group.name || '',
      description: group.description || '',
      maxMembers: group.maxMembers?.toString() || '',
      ageMin: group.ageMin?.toString() || '',
      ageMax: group.ageMax?.toString() || '',
      color: group.color || DEFAULT_GROUP_COLOR,
      branchId: group.branchId || '',
      trainerId: group.trainerId || '',
      schedule: schedule,
      isMonthlyPayment: group.isMonthlyPayment || false,
      monthlyPaymentAmount: group.monthlyPaymentAmount?.toString() || '',
      paymentDueDay: group.paymentDueDay?.toString() || '',
      createPaymentsImmediately: false,
      salaryScheme: group.salaryScheme
        ? normalizeSalaryScheme(group.salaryScheme)
        : 'per_training_person',
      salaryRate: group.salaryRate != null ? String(group.salaryRate) : '',
    });
    setEditDialog(true);
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup) return;
    
    try {
      const groupData = {
        ...formData,
        maxMembers: formData.maxMembers ? parseInt(formData.maxMembers) : undefined,
        ageMin: formData.ageMin ? parseInt(formData.ageMin) : undefined,
        ageMax: formData.ageMax ? parseInt(formData.ageMax) : undefined,
        schedule: formData.schedule.length > 0 ? formData.schedule : undefined,
        isMonthlyPayment: formData.isMonthlyPayment,
        monthlyPaymentAmount: formData.monthlyPaymentAmount ? parseFloat(formData.monthlyPaymentAmount) : undefined,
        paymentDueDay: formData.paymentDueDay ? parseInt(formData.paymentDueDay) : undefined,
        salaryScheme: formData.salaryScheme || 'per_training_person',
        salaryRate: formData.salaryRate !== '' ? parseFloat(formData.salaryRate) : null,
        trainerSalaryType: null,
        trainerMonthlyPercentage: null,
        trainerPerVisitPercentage: null,
        trainerPerVisitAmount: null,
      };
      await apiService.updateGroup(editingGroup.id, groupData);
      await fetchData();
      setEditDialog(false);
      setEditingGroup(null);
      setFormErrors({});
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления группы');
      console.error('Error updating group:', err);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить эту группу?')) {
      try {
        await apiService.deleteGroup(groupId);
        await fetchData();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления группы');
        console.error('Error deleting group:', err);
      }
    }
  };

  const handleOpenMembersDialog = async (group: Group) => {
    setSelectedGroup(group);
    // Refresh group data to get latest members
    try {
      const updatedGroup = await apiService.getGroup(group.id);
      setSelectedGroup(updatedGroup);
    } catch (err: any) {
      console.error('Error fetching group:', err);
    }
    setMembersDialog(true);
  };

  const handleOpenTrainingDialog = async (group: Group | any) => {
    // Если группа только что создана, загружаем полные данные
    let fullGroup = group;
    if (group && group.id) {
      try {
        fullGroup = await apiService.getGroup(group.id);
        setSelectedGroup(fullGroup);
      } catch (err) {
        console.error('Error fetching group:', err);
        setSelectedGroup(group);
      }
    } else {
      setSelectedGroup(group);
    }
    
    // Загружаем залы для филиала группы
    if (fullGroup.branchId) {
      try {
        const hallsRes = await apiService.getHalls({ branchId: fullGroup.branchId });
        setHalls(hallsRes.data);
      } catch (err) {
        console.error('Error fetching halls:', err);
        setHalls([]);
      }
    }

    // Предзаполняем форму данными группы
    const today = new Date();
    today.setHours(18, 0, 0, 0); // По умолчанию 18:00
    const endTime = new Date(today);
    endTime.setHours(19, 30, 0, 0); // По умолчанию 19:30

    // Если у группы есть график, используем первый день для предзаполнения
    let scheduleStartTime = today;
    let scheduleEndTime = endTime;
    
    // Парсим schedule, если он в виде строки
    let schedule: GroupScheduleItem[] = [];
    if (fullGroup.schedule) {
      if (typeof fullGroup.schedule === 'string') {
        try {
          schedule = JSON.parse(fullGroup.schedule);
        } catch (e) {
          console.error('Error parsing schedule:', e);
        }
      } else if (Array.isArray(fullGroup.schedule)) {
        schedule = fullGroup.schedule;
      }
    }
    
    if (schedule && schedule.length > 0) {
      const firstSchedule = schedule[0];
      const [startHours, startMinutes] = firstSchedule.startTime.split(':').map(Number);
      const [endHours, endMinutes] = firstSchedule.endTime.split(':').map(Number);
      scheduleStartTime = new Date(today);
      scheduleStartTime.setHours(startHours, startMinutes, 0, 0);
      scheduleEndTime = new Date(today);
      scheduleEndTime.setHours(endHours, endMinutes, 0, 0);
    }

    setTrainingFormData({
      title: fullGroup.name,
      description: fullGroup.description || '',
      date: new Date(),
      startTime: scheduleStartTime,
      endTime: scheduleEndTime,
      groupId: fullGroup.id,
      trainerId: fullGroup.trainerId,
      branchId: fullGroup.branchId,
      hallId: '',
      isRecurring: false,
      recurrence: 'weekly',
      daysOfWeek: [],
      recurrenceStartDate: new Date(),
      recurrenceEndDate: null,
      recurrenceMode: 'days',
      daySchedules: [],
    });
    setTrainingDialog(true);
  };

  const handleCreateTraining = async () => {
    if (!selectedGroup) return;

    // Валидация
    if (!trainingFormData.title || !trainingFormData.title.trim()) {
      alert('Пожалуйста, укажите название тренировки');
      return;
    }

    // Для нерегулярных тренировок проверяем дату и время
    if (!trainingFormData.isRecurring) {
      if (!trainingFormData.date || !trainingFormData.startTime || !trainingFormData.endTime) {
        alert('Пожалуйста, выберите дату, время начала и окончания');
        return;
      }
    }

    // Для регулярных тренировок проверяем расписание
    if (trainingFormData.isRecurring) {
      if (trainingFormData.recurrenceMode === 'days') {
        if (trainingFormData.daySchedules.length === 0) {
          alert('Пожалуйста, добавьте хотя бы один день недели с расписанием');
          return;
        }
        // Проверяем, что для всех дней задано время
        for (const daySchedule of trainingFormData.daySchedules) {
          if (!daySchedule.startTime || !daySchedule.endTime) {
            alert('Пожалуйста, укажите время для всех выбранных дней недели');
            return;
          }
        }
        if (!trainingFormData.recurrenceStartDate || !trainingFormData.recurrenceEndDate) {
          alert('Пожалуйста, выберите дату начала и окончания регулярных тренировок');
          return;
        }
        if (trainingFormData.recurrenceEndDate < trainingFormData.recurrenceStartDate) {
          alert('Дата окончания не может быть раньше даты начала');
          return;
        }
      }
    }

    try {
      const trainingData = {
        title: trainingFormData.title.trim(),
        description: trainingFormData.description.trim() || undefined,
        groupId: trainingFormData.groupId,
        trainerId: trainingFormData.trainerId,
        branchId: trainingFormData.branchId,
        hallId: trainingFormData.hallId || undefined,
        isRecurring: trainingFormData.isRecurring,
        recurrence: trainingFormData.recurrence,
        daysOfWeek: trainingFormData.daysOfWeek,
      };

      if (trainingFormData.isRecurring) {
        const trainings = [];
        
        if (trainingFormData.recurrenceMode === 'days') {
          const startDate = new Date(trainingFormData.recurrenceStartDate!);
          startDate.setHours(0, 0, 0, 0);
          
          const endDate = new Date(trainingFormData.recurrenceEndDate!);
          endDate.setHours(23, 59, 59, 999);
          
          const currentDate = new Date(startDate);
          currentDate.setHours(0, 0, 0, 0);
          
          while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            const daySchedule = trainingFormData.daySchedules.find(ds => ds.dayOfWeek === dayOfWeek);
            if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
              const trainingDate = new Date(currentDate);
              trainingDate.setHours(0, 0, 0, 0);
              
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
        }

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
          } catch (batchErr: any) {
            console.error('Error creating trainings batch:', batchErr);
            // Если batch не удался, пробуем создавать по одной с задержками
            const createdTrainings = [];
            const failedTrainings = [];
            for (let i = 0; i < trainings.length; i++) {
              const training = trainings[i];
              try {
                await apiService.createTraining(training);
                createdTrainings.push(training);
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
          }
        } else if (trainings.length === 1) {
          // Для одной тренировки используем обычный метод
          try {
            await apiService.createTraining(trainings[0]);
            alert('Тренировка успешно создана');
          } catch (err: any) {
            const errorMessage = err.response?.data?.error || err.message || 'Ошибка создания тренировки';
            alert(`Ошибка создания тренировки: ${errorMessage}`);
            throw err;
          }
        }
      } else {
        // Создаем одну нерегулярную тренировку
        const startTime = new Date(trainingFormData.date!);
        startTime.setHours(trainingFormData.startTime!.getHours(), trainingFormData.startTime!.getMinutes(), 0, 0);
        
        const endTime = new Date(trainingFormData.date!);
        endTime.setHours(trainingFormData.endTime!.getHours(), trainingFormData.endTime!.getMinutes(), 0, 0);

        try {
          await apiService.createTraining({
            ...trainingData,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          });
        } catch (err: any) {
          const errorMessage = err.response?.data?.error || err.message || 'Ошибка создания тренировки';
          alert(`Ошибка создания тренировки: ${errorMessage}`);
          console.error('Error creating training:', err);
          throw err; // Пробрасываем ошибку, чтобы не закрывать диалог
        }
      }

      // Обновляем данные после создания тренировок
      try {
        await fetchData();
      } catch (fetchErr: any) {
        console.error('Error fetching data after training creation:', fetchErr);
        // Не блокируем процесс, так как тренировки уже созданы
      }
      
      // Если нужно создать платежи сразу после создания графика
      if (shouldCreatePaymentsAfterSchedule && selectedGroup) {
        try {
          // Получаем полные данные группы с клиентами
          const fullGroup = await apiService.getGroup(selectedGroup.id);
          
          if (fullGroup.isMonthlyPayment && fullGroup.monthlyPaymentAmount && fullGroup.memberships) {
            const monthlyAmount = Number(fullGroup.monthlyPaymentAmount);
            const today = new Date();
            const dueDate = new Date(today);
            // Используем paymentDueDay группы или текущий день
            const paymentDay = fullGroup.paymentDueDay || today.getDate();
            dueDate.setDate(paymentDay);
            if (dueDate < today) {
              // Если день уже прошел, устанавливаем на следующий месяц
              dueDate.setMonth(dueDate.getMonth() + 1);
            }
            dueDate.setHours(23, 59, 59, 999);
            
            // Создаем платежи для всех активных клиентов группы
            const activeMemberships = fullGroup.memberships.filter(
              (m: any) => m.isActive && !m.leftAt
            );
            
            let createdCount = 0;
            let errorCount = 0;
            
            for (const membership of activeMemberships) {
              try {
                // Проверяем, не существует ли уже платеж для этого клиента и группы в текущем месяце
                const currentMonth = today.getMonth();
                const currentYear = today.getFullYear();
                const monthStart = new Date(currentYear, currentMonth, 1);
                const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
                
                const existingPayments = await apiService.getPayments({
                  clientId: membership.clientId,
                  groupId: fullGroup.id,
                  limit: 100
                });
                
                const hasExistingPayment = existingPayments.data?.some((p: any) => {
                  const paymentDate = new Date(p.createdAt);
                  return (
                    p.isMonthlyPayment &&
                    p.groupId === fullGroup.id &&
                    paymentDate >= monthStart &&
                    paymentDate <= monthEnd
                  );
                });
                
                if (!hasExistingPayment) {
                  await apiService.createPayment({
                    clientId: membership.clientId,
                    groupId: fullGroup.id,
                    branchId: fullGroup.branchId,
                    amount: monthlyAmount,
                    originalAmount: monthlyAmount,
                    type: 'monthly_payment',
                    status: 'pending',
                    dueDate: dueDate.toISOString(),
                    isMonthlyPayment: true
                  });
                  createdCount++;
                }
              } catch (paymentErr: any) {
                console.error(`Error creating payment for client ${membership.clientId}:`, paymentErr);
                errorCount++;
              }
            }
            
            if (createdCount > 0) {
              alert(`Создано платежей: ${createdCount}${errorCount > 0 ? `. Ошибок: ${errorCount}` : ''}`);
            }
          }
        } catch (paymentErr: any) {
          console.error('Error creating payments after schedule:', paymentErr);
          // Не показываем ошибку пользователю, так как тренировки уже созданы
        } finally {
          setShouldCreatePaymentsAfterSchedule(false);
        }
      }
      
      setTrainingDialog(false);
      setSelectedGroup(null);
      setTrainingFormData({
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
      });
      
      // Показываем сообщение только для нерегулярных тренировок (для регулярных уже показано выше)
      if (!trainingFormData.isRecurring) {
        alert('Тренировка успешно создана');
      }
      
      // Перенаправляем на страницу расписания
      navigate('/schedule');
    } catch (err: any) {
      // Ошибка уже обработана выше, просто логируем
      console.error('Error in handleCreateTraining:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Ошибка создания тренировки';
      alert(errorMessage);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for add-client UI
  const handleAddClientToGroup = async () => {
    if (!selectedGroup || !selectedClientId) return;

    try {
      await apiService.addClientToGroup(selectedGroup.id, selectedClientId);
      // Refresh group data
      const updatedGroup = await apiService.getGroup(selectedGroup.id);
      setSelectedGroup(updatedGroup);
      // Refresh groups list
      await fetchData();
      setSelectedClientId('');
      setSelectedClientIds([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка добавления клиента в группу');
      console.error('Error adding client to group:', err);
    }
  };

  const handleAddMultipleClientsToGroup = async () => {
    if (!selectedGroup || !selectedClientIds || selectedClientIds.length === 0) return;

    const maxMembers = selectedGroup.maxMembers;
    const currentMembers = selectedGroup.memberships?.filter(m => m.isActive).length || 0;
    
    if (maxMembers && currentMembers + selectedClientIds.length > maxMembers) {
      setError(`Нельзя добавить ${selectedClientIds.length} клиентов. Максимум участников: ${maxMembers}, сейчас: ${currentMembers}, можно добавить: ${maxMembers - currentMembers}`);
      return;
    }

    try {
      const errors: string[] = [];
      const successes: string[] = [];

      for (const clientId of selectedClientIds) {
        try {
          await apiService.addClientToGroup(selectedGroup.id, clientId);
          successes.push(clientId);
        } catch (err: any) {
          const client = clients.find(c => c.id === clientId);
          const clientName = client ? [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ') || `${client.firstName} ${client.lastName}` : clientId;
          errors.push(`${clientName}: ${err.response?.data?.error || 'Ошибка добавления'}`);
        }
      }

      // Refresh group data
      const updatedGroup = await apiService.getGroup(selectedGroup.id);
      setSelectedGroup(updatedGroup);
      // Refresh groups list
      await fetchData();
      
      if (errors.length > 0) {
        setError(`Добавлено: ${successes.length}, ошибок: ${errors.length}. ${errors.join('; ')}`);
      } else {
        setError(null);
      }
      
      setSelectedClientIds([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка добавления клиентов в группу');
      console.error('Error adding clients to group:', err);
    }
  };

  const handleRemoveClientFromGroup = async (clientId: string) => {
    if (!selectedGroup) return;

    if (window.confirm('Вы уверены, что хотите удалить этого клиента из группы?')) {
      try {
        await apiService.removeClientFromGroup(selectedGroup.id, clientId);
        // Refresh group data
        const updatedGroup = await apiService.getGroup(selectedGroup.id);
        setSelectedGroup(updatedGroup);
        // Refresh groups list
        await fetchData();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления клиента из группы');
        console.error('Error removing client from group:', err);
      }
    }
  };

  // Get available clients (not already in group)
  const getAvailableClients = () => {
    let availableClients = clients;
    if (selectedGroup) {
      const memberIds = selectedGroup.memberships?.filter(m => m.isActive).map(m => m.clientId) || [];
      availableClients = clients.filter(client => !memberIds.includes(client.id) && client.isActive);
    }
    // Применяем поиск, если он задан
    if (clientSearchQuery) {
      const query = clientSearchQuery.toLowerCase();
      availableClients = availableClients.filter(client => {
        const fullName = [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ').toLowerCase();
        const phone = (client.phone || '').toLowerCase();
        const email = (client.email || '').toLowerCase();
        return fullName.includes(query) || phone.includes(query) || email.includes(query);
      });
    }
    return availableClients;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box data-onboarding="groups-page">
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: 20, md: 24 } }}>
          Группы
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}
          onClick={() => {
            setOpenDialog(true);
            setFormErrors({});
            setError(null);
            setFormData(emptyGroupForm());
          }}
          data-onboarding="add-group-button"
        >
          Добавить группу
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isMobile ? (
        <Stack spacing={1.5}>
          {groups.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              Группы не найдены
            </Typography>
          ) : (
            groups.map((group) => {
              const trainerName = group.trainer?.user
                ? `${group.trainer.user.lastName} ${group.trainer.user.firstName} ${group.trainer.user.middleName || ''}`.trim()
                : null;
              const ageLabel = group.ageMin && group.ageMax
                ? `${group.ageMin}-${group.ageMax}`
                : group.ageMin
                ? `от ${group.ageMin}`
                : group.ageMax
                ? `до ${group.ageMax}`
                : null;
              const memberCount = group.memberships?.filter(m => m.isActive).length || 0;
              return (
                <Card key={group.id} variant="outlined">
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: 'primary.main',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                          onClick={() => handleEditGroup(group)}
                        >
                          {group.name}
                        </Typography>
                        {group.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                          >
                            {group.description}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={group.isActive ? 'Активна' : 'Неактивна'}
                        color={group.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {[group.branch?.name, trainerName].filter(Boolean).join(' · ') || 'Филиал/тренер не указаны'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                      <Chip label={`Участников: ${memberCount}`} size="small" variant="outlined" />
                      {group.maxMembers != null && (
                        <Chip label={`Макс: ${group.maxMembers}`} size="small" variant="outlined" />
                      )}
                      {ageLabel && (
                        <Chip label={`Возраст: ${ageLabel}`} size="small" variant="outlined" />
                      )}
                    </Box>
                    <Divider sx={{ mb: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        color="primary"
                        title="Создать тренировку для группы"
                        onClick={() => handleOpenTrainingDialog(group)}
                      >
                        <CalendarToday />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="primary"
                        title="Управление участниками"
                        onClick={() => handleOpenMembersDialog(group)}
                      >
                        <People />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="primary"
                        title="Редактировать"
                        onClick={() => handleEditGroup(group)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        title="Удалить"
                        onClick={() => handleDeleteGroup(group.id)}
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              );
            })
          )}
        </Stack>
      ) : (
      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Название</TableCell>
                  <TableCell>Описание</TableCell>
                  <TableCell>Филиал</TableCell>
                  <TableCell>Тренер</TableCell>
                  <TableCell>Макс. участников</TableCell>
                  <TableCell>Возраст</TableCell>
                  <TableCell>Участников</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary">
                        Группы не найдены
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>
                        <Typography
                          sx={{
                            cursor: 'pointer',
                            color: 'primary.main',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                          onClick={() => {
                            setEditingGroup(group);
                            // Парсим schedule из JSON строки, если она есть
                            let schedule: GroupScheduleItem[] = [];
                            if (group.schedule) {
                              if (typeof group.schedule === 'string') {
                                try {
                                  schedule = JSON.parse(group.schedule);
                                } catch (e) {
                                  console.error('Error parsing schedule:', e);
                                }
                              } else if (Array.isArray(group.schedule)) {
                                schedule = group.schedule;
                              }
                            }
                            setFormData({
                              name: group.name,
                              description: group.description || '',
                              maxMembers: group.maxMembers?.toString() || '',
                              ageMin: group.ageMin?.toString() || '',
                              ageMax: group.ageMax?.toString() || '',
                              color: group.color || DEFAULT_GROUP_COLOR,
                              branchId: group.branchId,
                              trainerId: group.trainerId,
                              schedule: schedule,
                              isMonthlyPayment: group.isMonthlyPayment || false,
                              monthlyPaymentAmount: group.monthlyPaymentAmount?.toString() || '',
                              paymentDueDay: group.paymentDueDay?.toString() || '',
                              createPaymentsImmediately: false,
                              salaryScheme: group.salaryScheme
                                ? normalizeSalaryScheme(group.salaryScheme)
                                : 'per_training_person',
                              salaryRate: group.salaryRate != null ? String(group.salaryRate) : '',
                            });
                            setEditDialog(true);
                          }}
                        >
                          {group.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {group.description || '-'}
                      </TableCell>
                  <TableCell>
                        {group.branch?.name || '-'}
                  </TableCell>
                  <TableCell>
                        {group.trainer?.user 
                          ? `${group.trainer.user.lastName} ${group.trainer.user.firstName} ${group.trainer.user.middleName || ''}`.trim()
                          : '-'}
                  </TableCell>
                      <TableCell>{group.maxMembers || '-'}</TableCell>
                  <TableCell>
                        {group.ageMin && group.ageMax 
                          ? `${group.ageMin}-${group.ageMax}`
                          : group.ageMin 
                          ? `от ${group.ageMin}`
                          : group.ageMax
                          ? `до ${group.ageMax}`
                          : '-'}
                  </TableCell>
                  <TableCell>
                        {group.memberships?.filter(m => m.isActive).length || 0}
                  </TableCell>
                  <TableCell>
                        <Chip
                          label={group.isActive ? 'Активна' : 'Неактивна'}
                          color={group.isActive ? 'success' : 'default'}
                          size="small"
                        />
                  </TableCell>
                  <TableCell>
                        <IconButton 
                          size="small" 
                          color="primary" 
                          title="Создать тренировку для группы"
                          onClick={() => handleOpenTrainingDialog(group)}
                        >
                          <CalendarToday />
                    </IconButton>
                        <IconButton 
                          size="small" 
                          color="primary" 
                          title="Управление участниками"
                          onClick={() => handleOpenMembersDialog(group)}
                        >
                          <People />
                    </IconButton>
                        <IconButton 
                          size="small" 
                          color="primary" 
                          title="Редактировать"
                          onClick={() => handleEditGroup(group)}
                        >
                      <Edit />
                    </IconButton>
                        <IconButton 
                          size="small" 
                          color="error" 
                          title="Удалить"
                          onClick={() => handleDeleteGroup(group.id)}
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
      )}

      {/* Диалог добавления группы */}
      <Dialog 
        open={openDialog} 
        onClose={(event, reason) => {
          // Всегда проверяем ошибки перед закрытием
          const hasErrors = Object.keys(formErrors).length > 0;
          
          // Если есть ошибки, не закрываем диалог
          if (hasErrors || error) {
            setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
            setSnackbarOpen(true);
            return;
          }
          
          // Разрешаем закрытие только если нет ошибок
          setOpenDialog(false);
          setFormErrors({});
          setError(null);
        }} 
        maxWidth="md" 
        fullWidth 
        fullScreen={isNarrow}
        data-onboarding="group-form-dialog"
        disableEscapeKeyDown={Object.keys(formErrors).length > 0 || !!error}
      >
        <DialogTitle>Добавить новую группу</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {Object.keys(formErrors).length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Пожалуйста, исправьте {Object.keys(formErrors).length} {Object.keys(formErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название группы"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                error={!!formErrors.name}
                helperText={formErrors.name}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
                error={!!formErrors.description}
                helperText={formErrors.description}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required error={!!formErrors.branchId}>
                <InputLabel>Филиал</InputLabel>
                <Select
                  value={formData.branchId}
                  onChange={(e) => handleInputChange('branchId', e.target.value)}
                  label="Филиал"
                >
                  {branches.map((branch) => (
                    <MenuItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.branchId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {formErrors.branchId}
                  </Typography>
                )}
              </FormControl>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setCreateBranchDialog(true)}
                sx={{ mt: 1 }}
              >
                + Создать филиал
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required error={!!formErrors.trainerId}>
                <InputLabel>Тренер</InputLabel>
                <Select
                  value={formData.trainerId}
                  onChange={(e) => handleInputChange('trainerId', e.target.value)}
                  label="Тренер"
                >
                  {trainers.map((trainer) => (
                    <MenuItem key={trainer.id} value={trainer.id}>
                      {trainer.user 
                        ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim()
                        : `Тренер #${trainer.id}`}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.trainerId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {formErrors.trainerId}
                  </Typography>
                )}
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Зарплата берётся из настроек сотрудника
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setCreateTrainerDialog(true)}
                sx={{ mt: 1 }}
              >
                + Создать тренера
              </Button>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Максимум участников"
                type="number"
                value={formData.maxMembers}
                onChange={(e) => handleInputChange('maxMembers', e.target.value)}
                inputProps={{ min: 1 }}
                error={!!formErrors.maxMembers}
                helperText={formErrors.maxMembers}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Минимальный возраст"
                type="number"
                value={formData.ageMin}
                onChange={(e) => handleInputChange('ageMin', e.target.value)}
                inputProps={{ min: 0 }}
                error={!!formErrors.ageMin}
                helperText={formErrors.ageMin}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Максимальный возраст"
                type="number"
                value={formData.ageMax}
                onChange={(e) => handleInputChange('ageMax', e.target.value)}
                inputProps={{ min: 0 }}
                error={!!formErrors.ageMax}
                helperText={formErrors.ageMax}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Цвет группы"
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    backgroundColor: formData.color,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                />
              </Box>
            </Grid>
            
            {/* Ежемесячная оплата */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>Ежемесячная оплата</Typography>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isMonthlyPayment}
                    onChange={(e) => handleInputChange('isMonthlyPayment', e.target.checked)}
                  />
                }
                label="Включить ежемесячную оплату"
              />
            </Grid>
            {formData.isMonthlyPayment && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Сумма ежемесячного платежа (руб.)"
                    type="number"
                    value={formData.monthlyPaymentAmount}
                    onChange={(e) => handleInputChange('monthlyPaymentAmount', e.target.value)}
                    inputProps={{ min: 0, step: 0.01 }}
                    required={formData.isMonthlyPayment}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="День месяца для оплаты"
                    type="number"
                    value={formData.paymentDueDay}
                    onChange={(e) => handleInputChange('paymentDueDay', e.target.value)}
                    inputProps={{ min: 1, max: 31 }}
                    required={formData.isMonthlyPayment}
                    helperText="День месяца, когда клиенты должны оплачивать (1-31)"
                  />
                </Grid>
                {!editDialog && (
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.createPaymentsImmediately}
                          onChange={(e) => handleInputChange('createPaymentsImmediately', e.target.checked)}
                        />
                      }
                      label="Создать платежи сразу после создания графика тренировок"
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      При проставлении этого чекбокса первый платеж будет создан сразу после создания графика тренировок для всех активных клиентов группы
                    </Typography>
                  </Grid>
                )}
              </>
            )}
            
            {/* Зарплата тренера по группе */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>Зарплата тренера</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Тип зарплаты</InputLabel>
                <Select
                  value={formData.salaryScheme}
                  label="Тип зарплаты"
                  onChange={(e) => handleInputChange('salaryScheme', e.target.value)}
                >
                  {GROUP_SALARY_SCHEME_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={salaryRateFieldLabel(formData.salaryScheme)}
                value={formData.salaryRate}
                onChange={(e) => handleInputChange('salaryRate', e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                helperText={salarySchemeHint(formData.salaryScheme)}
              />
            </Grid>

            {/* Выбор участников группы */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>Участники группы</Typography>
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={clients}
                getOptionLabel={(option) => {
                  const name = [option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ') || `${option.firstName} ${option.lastName}`;
                  return name;
                }}
                value={clients.filter(client => selectedClientIds.includes(client.id))}
                onChange={(event, newValue) => {
                  setSelectedClientIds(newValue.map(client => client.id));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Выберите участников группы"
                    placeholder="Начните вводить имя клиента"
                    helperText="Вы можете добавить участников сразу при создании группы"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      label={[option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ') || `${option.firstName} ${option.lastName}`}
                    />
                  ))
                }
                filterOptions={(options, params) => {
                  const filtered = options.filter(option => {
                    const fullName = [option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ').toLowerCase();
                    const query = params.inputValue.toLowerCase();
                    return fullName.includes(query);
                  });
                  return filtered;
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Отмена всегда закрывает форму без применения изменений
              setOpenDialog(false);
              setFormErrors({});
              setError(null);
              setFormData(emptyGroupForm());
              setSelectedClientIds([]); // Очищаем выбранных клиентов при отмене
            }}
            type="button"
          >
            Отмена
          </Button>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              
              // Выполняем валидацию синхронно
              const validationErrors = validateGroupForm(formData);
              setFormErrors(validationErrors);
              
              // Если есть ошибки, показываем их и оставляем диалог открытым
              if (Object.keys(validationErrors).length > 0) {
                setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
                setSnackbarOpen(true);
                return; // Не создаем группу, если есть ошибки
              }
              
              // Если нет ошибок, вызываем handleCreateGroup для сохранения
              handleCreateGroup(false);
            }} 
            variant="outlined"
            type="button"
          >
            Создать группу
          </Button>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              
              // Выполняем валидацию синхронно
              const validationErrors = validateGroupForm(formData);
              setFormErrors(validationErrors);
              
              // Если есть ошибки, показываем их и оставляем диалог открытым
              if (Object.keys(validationErrors).length > 0) {
                setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
                setSnackbarOpen(true);
                return; // Не создаем группу, если есть ошибки
              }
              
              // Если нет ошибок, вызываем handleCreateGroup с флагом открытия диалога тренировки
              handleCreateGroup(true);
            }} 
            variant="contained"
            type="button"
            startIcon={<CalendarToday />}
          >
            Создать группу и тренировку
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования группы */}
      <Dialog 
        open={editDialog} 
        onClose={(event, reason) => {
          // Всегда проверяем ошибки перед закрытием
          const hasErrors = Object.keys(formErrors).length > 0;
          
          // Если есть ошибки, не закрываем диалог
          if (hasErrors || error) {
            setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
            setSnackbarOpen(true);
            return;
          }
          
          // Разрешаем закрытие только если нет ошибок
          setEditDialog(false);
          setFormErrors({});
          setError(null);
        }} 
        maxWidth="md" 
        fullWidth
        fullScreen={isNarrow}
        disableEscapeKeyDown={Object.keys(formErrors).length > 0 || !!error}
      >
        <DialogTitle>Редактировать группу</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {Object.keys(formErrors).length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Пожалуйста, исправьте {Object.keys(formErrors).length} {Object.keys(formErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название группы"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                error={!!formErrors.name}
                helperText={formErrors.name}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
                error={!!formErrors.description}
                helperText={formErrors.description}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required error={!!formErrors.branchId}>
                <InputLabel>Филиал</InputLabel>
                <Select
                  value={formData.branchId}
                  onChange={(e) => handleInputChange('branchId', e.target.value)}
                  label="Филиал"
                >
                  {branches.map((branch) => (
                    <MenuItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.branchId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {formErrors.branchId}
                  </Typography>
                )}
              </FormControl>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setCreateBranchDialog(true)}
                sx={{ mt: 1 }}
              >
                + Создать филиал
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required error={!!formErrors.trainerId}>
                <InputLabel>Тренер</InputLabel>
                <Select
                  value={formData.trainerId}
                  onChange={(e) => handleInputChange('trainerId', e.target.value)}
                  label="Тренер"
                >
                  {trainers.map((trainer) => (
                    <MenuItem key={trainer.id} value={trainer.id}>
                      {trainer.user 
                        ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim()
                        : `Тренер #${trainer.id}`}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.trainerId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {formErrors.trainerId}
                  </Typography>
                )}
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Зарплата берётся из настроек сотрудника
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setCreateTrainerDialog(true)}
                sx={{ mt: 1 }}
              >
                + Создать тренера
              </Button>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Максимум участников"
                type="number"
                value={formData.maxMembers}
                onChange={(e) => handleInputChange('maxMembers', e.target.value)}
                inputProps={{ min: 1 }}
                error={!!formErrors.maxMembers}
                helperText={formErrors.maxMembers}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Минимальный возраст"
                type="number"
                value={formData.ageMin}
                onChange={(e) => handleInputChange('ageMin', e.target.value)}
                inputProps={{ min: 0 }}
                error={!!formErrors.ageMin}
                helperText={formErrors.ageMin}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Максимальный возраст"
                type="number"
                value={formData.ageMax}
                onChange={(e) => handleInputChange('ageMax', e.target.value)}
                inputProps={{ min: 0 }}
                error={!!formErrors.ageMax}
                helperText={formErrors.ageMax}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Цвет группы"
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    backgroundColor: formData.color,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                />
              </Box>
            </Grid>
            
            {/* Ежемесячная оплата */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>Ежемесячная оплата</Typography>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isMonthlyPayment}
                    onChange={(e) => handleInputChange('isMonthlyPayment', e.target.checked)}
                  />
                }
                label="Включить ежемесячную оплату"
              />
            </Grid>
            {formData.isMonthlyPayment && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Сумма ежемесячного платежа (руб.)"
                    type="number"
                    value={formData.monthlyPaymentAmount}
                    onChange={(e) => handleInputChange('monthlyPaymentAmount', e.target.value)}
                    inputProps={{ min: 0, step: 0.01 }}
                    required={formData.isMonthlyPayment}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="День месяца для оплаты"
                    type="number"
                    value={formData.paymentDueDay}
                    onChange={(e) => handleInputChange('paymentDueDay', e.target.value)}
                    inputProps={{ min: 1, max: 31 }}
                    required={formData.isMonthlyPayment}
                    helperText="День месяца, когда клиенты должны оплачивать (1-31)"
                  />
                </Grid>
                {!editDialog && (
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.createPaymentsImmediately}
                          onChange={(e) => handleInputChange('createPaymentsImmediately', e.target.checked)}
                        />
                      }
                      label="Создать платежи сразу после создания графика тренировок"
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      При проставлении этого чекбокса первый платеж будет создан сразу после создания графика тренировок для всех активных клиентов группы
                    </Typography>
                  </Grid>
                )}
              </>
            )}

            {/* Зарплата тренера по группе */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>Зарплата тренера</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Тип зарплаты</InputLabel>
                <Select
                  value={formData.salaryScheme}
                  label="Тип зарплаты"
                  onChange={(e) => handleInputChange('salaryScheme', e.target.value)}
                >
                  {GROUP_SALARY_SCHEME_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={salaryRateFieldLabel(formData.salaryScheme)}
                value={formData.salaryRate}
                onChange={(e) => handleInputChange('salaryRate', e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                helperText={salarySchemeHint(formData.salaryScheme)}
              />
            </Grid>
          </Grid>
          {editingGroup && (
            <Box sx={{ mt: 3 }}>
              <AttendanceExcelExport
                scope="group"
                entityId={editingGroup.id}
                entityName={editingGroup.name}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Отмена всегда закрывает форму без применения изменений
              setEditDialog(false);
              setEditingGroup(null);
              setFormErrors({});
              setError(null);
            }}
            type="button"
          >
            Отмена
          </Button>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              
              // Выполняем валидацию синхронно
              const validationErrors = validateGroupForm(formData);
              setFormErrors(validationErrors);
              
              // Если есть ошибки, показываем их и оставляем диалог открытым
              if (Object.keys(validationErrors).length > 0) {
                setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
                setSnackbarOpen(true);
                return; // Не обновляем группу, если есть ошибки
              }
              
              // Если нет ошибок, вызываем handleUpdateGroup для сохранения
              handleUpdateGroup();
            }} 
            variant="contained"
            type="button"
          >
            Сохранить изменения
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог управления участниками */}
      <Dialog open={membersDialog} onClose={() => {
        setMembersDialog(false);
        setSelectedClientId('');
        setSelectedClientIds([]);
      }} maxWidth="md" fullWidth fullScreen={isNarrow}>
        <DialogTitle>
          Участники группы: {selectedGroup?.name}
          {selectedGroup?.maxMembers && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {selectedGroup.memberships?.filter(m => m.isActive).length || 0} / {selectedGroup.maxMembers}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Добавить клиентов</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  options={getAvailableClients()}
                  getOptionLabel={(option) => {
                    const fullName = [option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ').trim();
                    return fullName || `${option.firstName} ${option.lastName}`;
                  }}
                  value={clients.filter(c => selectedClientIds.includes(c.id))}
                  onChange={(event, newValue) => {
                    setSelectedClientIds(newValue.map(client => client.id));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Выберите клиентов (можно несколько)"
                      placeholder="Начните вводить ФИО, телефон или email..."
                    />
                  )}
                  renderOption={(props, option) => {
                    const isSelected = selectedClientIds.includes(option.id);
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
              </Grid>
              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleAddMultipleClientsToGroup}
                  disabled={
                    selectedClientIds.length === 0 || 
                    (selectedGroup?.maxMembers 
                      ? ((selectedGroup.memberships?.filter(m => m.isActive).length || 0) + selectedClientIds.length) > selectedGroup.maxMembers 
                      : false)
                  }
                  sx={{ height: '56px' }}
                >
                  Добавить выбранных ({selectedClientIds.length})
                </Button>
              </Grid>
            </Grid>
            {selectedGroup?.maxMembers && (() => {
              const currentCount = selectedGroup.memberships?.filter(m => m.isActive).length || 0;
              const willBeAdded = selectedClientIds.length;
              const totalAfter = currentCount + willBeAdded;
              const isFull = currentCount >= selectedGroup.maxMembers;
              const willExceed = totalAfter > selectedGroup.maxMembers;
              
              return (
                <Alert 
                  severity={isFull ? 'warning' : willExceed ? 'error' : 'info'} 
                  sx={{ mt: 2 }}
                >
                  {isFull 
                    ? `Группа заполнена (достигнут лимит ${selectedGroup.maxMembers} участников)`
                    : willExceed
                    ? `Нельзя добавить ${willBeAdded} клиентов. Доступно мест: ${selectedGroup.maxMembers - currentCount}. Попробуйте выбрать меньше клиентов.`
                    : `Участников: ${currentCount} / ${selectedGroup.maxMembers}. Будет добавлено: ${willBeAdded}`}
                </Alert>
              );
            })()}
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Текущие участники ({selectedGroup?.memberships?.filter(m => m.isActive).length || 0})</Typography>
            {selectedGroup?.memberships?.filter(m => m.isActive).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                В группе пока нет участников
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Имя</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Телефон</TableCell>
                      <TableCell>Дата присоединения</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedGroup?.memberships
                      ?.filter(m => m.isActive)
                      .map((membership) => (
                        <TableRow key={membership.id}>
                          <TableCell>
                            {membership.client ? (
                              <ClientNameLink clientId={membership.client.id} client={membership.client} />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>{membership.client?.email || '-'}</TableCell>
                          <TableCell>{membership.client?.phone || '-'}</TableCell>
                          <TableCell>
                            {membership.joinedAt ? new Date(membership.joinedAt).toLocaleDateString('ru-RU') : '-'}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              title="Удалить из группы"
                              onClick={() => handleRemoveClientFromGroup(membership.clientId)}
                            >
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setMembersDialog(false);
            setSelectedGroup(null);
            setSelectedClientId('');
            setSelectedClientIds([]);
          }}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания тренировки для группы */}
      <Dialog 
        open={trainingDialog} 
        onClose={() => {
          setTrainingDialog(false);
          setSelectedGroup(null);
          setTrainingFormData({
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
          });
        }} 
        maxWidth="md" 
        fullWidth
        fullScreen={isNarrow}
      >
        <DialogTitle>Создать тренировку для группы</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название тренировки"
                value={trainingFormData.title}
                onChange={(e) => setTrainingFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={trainingFormData.description}
                onChange={(e) => setTrainingFormData(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Группа</InputLabel>
                <Select
                  value={trainingFormData.groupId}
                  onChange={(e) => setTrainingFormData(prev => ({ ...prev, groupId: e.target.value }))}
                  label="Группа"
                  disabled
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
                  value={trainingFormData.trainerId}
                  onChange={(e) => setTrainingFormData(prev => ({ ...prev, trainerId: e.target.value }))}
                  label="Тренер"
                >
                  {trainers.map((trainer) => (
                    <MenuItem key={trainer.id} value={trainer.id}>
                      {trainer.user 
                        ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim()
                        : `Тренер #${trainer.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Филиал</InputLabel>
                <Select
                  value={trainingFormData.branchId}
                  onChange={(e) => {
                    setTrainingFormData(prev => ({ ...prev, branchId: e.target.value, hallId: '' }));
                    // Загружаем залы для выбранного филиала
                    if (e.target.value) {
                      apiService.getHalls({ branchId: e.target.value })
                        .then(res => setHalls(res.data))
                        .catch(err => {
                          console.error('Error fetching halls:', err);
                          setHalls([]);
                        });
                    } else {
                      setHalls([]);
                    }
                  }}
                  label="Филиал"
                >
                  {branches.map((branch) => (
                    <MenuItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Зал</InputLabel>
                <Select
                  value={trainingFormData.hallId}
                  onChange={(e) => setTrainingFormData(prev => ({ ...prev, hallId: e.target.value }))}
                  label="Зал"
                  disabled={!trainingFormData.branchId}
                >
                  <MenuItem value="">
                    <em>Не выбран</em>
                  </MenuItem>
                  {halls.map((hall) => (
                    <MenuItem key={hall.id} value={hall.id}>
                      {hall.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'background.default' }}>
                <FormControl>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Checkbox
                      checked={trainingFormData.isRecurring}
                      onChange={(e) => {
                        setTrainingFormData(prev => ({
                          ...prev,
                          isRecurring: e.target.checked,
                          daySchedules: e.target.checked ? prev.daySchedules : [],
                        }));
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
            {!trainingFormData.isRecurring && (
              <>
                <Grid item xs={12} sm={4}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                    <DatePicker
                      label="Дата тренировки"
                      value={trainingFormData.date}
                      onChange={(date) => {
                        setTrainingFormData(prev => {
                          const newData = { ...prev, date: date };
                          if (date && prev.startTime) {
                            const newStartTime = new Date(date);
                            newStartTime.setHours(prev.startTime.getHours(), prev.startTime.getMinutes(), 0, 0);
                            newData.startTime = newStartTime;
                          }
                          if (date && prev.endTime) {
                            const newEndTime = new Date(date);
                            newEndTime.setHours(prev.endTime.getHours(), prev.endTime.getMinutes(), 0, 0);
                            newData.endTime = newEndTime;
                          }
                          return newData;
                        });
                      }}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                    <TimePicker
                      label="Время начала"
                      value={trainingFormData.startTime}
                      onChange={(time) => {
                        setTrainingFormData(prev => {
                          if (time && prev.date) {
                            const newTime = new Date(prev.date);
                            newTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
                            return { ...prev, startTime: newTime };
                          } else {
                            return { ...prev, startTime: time };
                          }
                        });
                      }}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                    <TimePicker
                      label="Время окончания"
                      value={trainingFormData.endTime}
                      onChange={(time) => {
                        setTrainingFormData(prev => {
                          if (time && prev.date) {
                            const newTime = new Date(prev.date);
                            newTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
                            return { ...prev, endTime: newTime };
                          } else {
                            return { ...prev, endTime: time };
                          }
                        });
                      }}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
              </>
            )}

            {/* Настройки регулярных тренировок */}
            {trainingFormData.isRecurring && (
              <Grid item xs={12}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'rgba(25, 118, 210, 0.05)' }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                    Настройки регулярных тренировок
                  </Typography>
                  
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                        <DatePicker
                          label="Дата начала регулярных тренировок"
                          value={trainingFormData.recurrenceStartDate}
                          onChange={(date) => setTrainingFormData(prev => ({ ...prev, recurrenceStartDate: date }))}
                          slotProps={{ textField: { fullWidth: true } }}
                        />
                      </LocalizationProvider>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                        <DatePicker
                          label="Дата окончания регулярных тренировок"
                          value={trainingFormData.recurrenceEndDate}
                          onChange={(date) => setTrainingFormData(prev => ({ ...prev, recurrenceEndDate: date }))}
                          slotProps={{ textField: { fullWidth: true } }}
                        />
                      </LocalizationProvider>
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
                          const daySchedule = trainingFormData.daySchedules.find(ds => ds.dayOfWeek === day.value);
                          const isSelected = !!daySchedule;
                          
                          return (
                            <Paper key={day.value} sx={{ p: 2, border: isSelected ? '2px solid' : '1px solid', borderColor: isSelected ? 'primary.main' : 'divider' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                <Checkbox
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      // Добавляем день с расписанием
                                      const defaultStartTime = trainingFormData.startTime || new Date();
                                      defaultStartTime.setHours(18, 0, 0, 0);
                                      const defaultEndTime = trainingFormData.endTime || new Date();
                                      defaultEndTime.setHours(19, 30, 0, 0);
                                      
                                      setTrainingFormData(prev => ({
                                        ...prev,
                                        daySchedules: [
                                          ...prev.daySchedules,
                                          {
                                            dayOfWeek: day.value,
                                            startTime: new Date(defaultStartTime),
                                            endTime: new Date(defaultEndTime)
                                          }
                                        ],
                                        daysOfWeek: [...prev.daysOfWeek, day.value]
                                      }));
                                    } else {
                                      // Удаляем день
                                      setTrainingFormData(prev => ({
                                        ...prev,
                                        daySchedules: prev.daySchedules.filter(ds => ds.dayOfWeek !== day.value),
                                        daysOfWeek: prev.daysOfWeek.filter(d => d !== day.value)
                                      }));
                                    }
                                  }}
                                />
                                <Typography sx={{ minWidth: 120 }}>{day.label}</Typography>
                                {isSelected && daySchedule && (
                                  <>
                                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                                      <TimePicker
                                        label="Начало"
                                        value={daySchedule.startTime}
                                        onChange={(time) => {
                                          setTrainingFormData(prev => ({
                                            ...prev,
                                            daySchedules: prev.daySchedules.map(ds =>
                                              ds.dayOfWeek === day.value
                                                ? { ...ds, startTime: time }
                                                : ds
                                            )
                                          }));
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
                                        onChange={(time) => {
                                          setTrainingFormData(prev => ({
                                            ...prev,
                                            daySchedules: prev.daySchedules.map(ds =>
                                              ds.dayOfWeek === day.value
                                                ? { ...ds, endTime: time }
                                                : ds
                                            )
                                          }));
                                        }}
                                        slotProps={{
                                          textField: {
                                            size: 'small',
                                            sx: { width: 140 }
                                          }
                                        }}
                                      />
                                    </LocalizationProvider>
                                  </>
                                )}
                              </Box>
                            </Paper>
                          );
                        })}
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setTrainingDialog(false);
              setSelectedGroup(null);
              setTrainingFormData({
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
              });
            }}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleCreateTraining}
            variant="contained"
          >
            Создать тренировку
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания тренера */}
      <Dialog 
        open={createTrainerDialog} 
        onClose={() => {
          setCreateTrainerDialog(false);
          setTrainerFormErrors({});
          setTrainerFormData({
            email: '',
            password: '',
            firstName: '',
            lastName: '',
            middleName: '',
            phone: '',
            qualification: '',
            experience: '',
            specialization: '',
            salaryType: 'fixed',
            salaryAmount: '',
            salaryPercentage: '',
            canViewAllGroups: false,
          });
        }}
        maxWidth="md" 
        fullWidth
        fullScreen={isNarrow}
      >
        <DialogTitle>Создать нового тренера</DialogTitle>
        <DialogContent>
          {Object.keys(trainerFormErrors).length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Пожалуйста, исправьте {Object.keys(trainerFormErrors).length} {Object.keys(trainerFormErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Фамилия"
                value={trainerFormData.lastName}
                onChange={(e) => setTrainerFormData(prev => ({ ...prev, lastName: e.target.value }))}
                required
                error={!!trainerFormErrors.lastName}
                helperText={trainerFormErrors.lastName}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Имя"
                value={trainerFormData.firstName}
                onChange={(e) => setTrainerFormData(prev => ({ ...prev, firstName: e.target.value }))}
                required
                error={!!trainerFormErrors.firstName}
                helperText={trainerFormErrors.firstName}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Отчество"
                value={trainerFormData.middleName}
                onChange={(e) => setTrainerFormData(prev => ({ ...prev, middleName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={trainerFormData.email}
                onChange={(e) => setTrainerFormData(prev => ({ ...prev, email: e.target.value.toLowerCase() }))}
                required
                error={!!trainerFormErrors.email}
                helperText={trainerFormErrors.email}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Пароль"
                type="password"
                value={trainerFormData.password}
                onChange={(e) => setTrainerFormData(prev => ({ ...prev, password: e.target.value }))}
                required
                error={!!trainerFormErrors.password}
                helperText={trainerFormErrors.password}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон"
                value={trainerFormData.phone}
                onChange={(e) => setTrainerFormData(prev => ({ ...prev, phone: e.target.value }))}
                error={!!trainerFormErrors.phone}
                helperText={trainerFormErrors.phone}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Квалификация"
                value={trainerFormData.qualification}
                onChange={(e) => setTrainerFormData(prev => ({ ...prev, qualification: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Опыт (лет)"
                type="number"
                value={trainerFormData.experience}
                onChange={(e) => setTrainerFormData(prev => ({ ...prev, experience: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Специализация"
                value={trainerFormData.specialization}
                onChange={(e) => setTrainerFormData(prev => ({ ...prev, specialization: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                Тип и ставка зарплаты задаются в карточке группы после назначения тренера.
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateTrainerDialog(false);
            setTrainerFormErrors({});
            setTrainerFormData({
              email: '',
              password: '',
              firstName: '',
              lastName: '',
              middleName: '',
              phone: '',
              qualification: '',
              experience: '',
              specialization: '',
              salaryType: 'fixed',
              salaryAmount: '',
              salaryPercentage: '',
              canViewAllGroups: false,
            });
          }}>
            Отмена
          </Button>
          <Button onClick={handleCreateTrainerFromGroup} variant="contained">
            Создать тренера
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания филиала */}
      <Dialog 
        open={createBranchDialog} 
        onClose={() => {
          setCreateBranchDialog(false);
          setBranchFormErrors({});
          setBranchFormData({
            name: '',
            address: '',
            phone: '',
            email: '',
            description: '',
          });
        }}
        maxWidth="md" 
        fullWidth
        fullScreen={isNarrow}
      >
        <DialogTitle>Создать новый филиал</DialogTitle>
        <DialogContent>
          {Object.keys(branchFormErrors).length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Пожалуйста, исправьте {Object.keys(branchFormErrors).length} {Object.keys(branchFormErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название филиала"
                value={branchFormData.name}
                onChange={(e) => setBranchFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                error={!!branchFormErrors.name}
                helperText={branchFormErrors.name}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Адрес"
                value={branchFormData.address}
                onChange={(e) => setBranchFormData(prev => ({ ...prev, address: e.target.value }))}
                required
                multiline
                rows={2}
                error={!!branchFormErrors.address}
                helperText={branchFormErrors.address}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон"
                value={branchFormData.phone}
                onChange={(e) => setBranchFormData(prev => ({ ...prev, phone: e.target.value }))}
                error={!!branchFormErrors.phone}
                helperText={branchFormErrors.phone}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={branchFormData.email}
                onChange={(e) => setBranchFormData(prev => ({ ...prev, email: e.target.value.toLowerCase() }))}
                error={!!branchFormErrors.email}
                helperText={branchFormErrors.email}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={branchFormData.description}
                onChange={(e) => setBranchFormData(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateBranchDialog(false);
            setBranchFormErrors({});
            setBranchFormData({
              name: '',
              address: '',
              phone: '',
              email: '',
              description: '',
            });
          }}>
            Отмена
          </Button>
          <Button onClick={handleCreateBranchFromGroup} variant="contained">
            Создать филиал
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar для отображения ошибок валидации */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default Groups;
