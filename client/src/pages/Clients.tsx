import React, { useState, useEffect, useRef, useMemo } from 'react';
import AthleteCard from '../components/athlete/AthleteCard';
import UnsavedChangesDialog from '../components/common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../hooks/useUnsavedClose';
import ClientGroupsDialog from '../components/client/ClientGroupsDialog';
import { useSearchParams } from 'react-router-dom';
import { validateClientForm, validateField, hasFormErrors, ClientFormData, ValidationErrors } from '../utils/clientValidation';
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
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  InputAdornment,
  Select,
  MenuItem,
  TableSortLabel,
  Checkbox,
  FormControlLabel,
  ListItemText,
  List,
  ListItem,
} from '@mui/material';
import { Add, Edit, Delete, Visibility, FileDownload, FileUpload, LocalOffer, Download, Info, Phone, Check, Close, Assignment, PhotoCamera, CalendarToday, Payment } from '@mui/icons-material';
import { apiService } from '../services/api';
import { Client, Membership } from '../types';
import ClientsList from '../components/dashboard/ClientsList';
import AttendanceExcelExport from '../components/AttendanceExcelExport';
import { colors, radii } from '../theme/tokens';
import { useAuth } from '../contexts/AuthContext';
import { getClientAccountStatus } from '../utils/clientAccountStatus';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { EmojiEvents } from '@mui/icons-material';

const EMPTY_CLIENT_FORM: ClientFormData = {
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  birthCertificateNumber: '',
  birthCertificate: '',
  medicalCertificateNumber: '',
  medicalCertificate: '',
  schoolOrKindergarten: '',
  photo: '',
  weight: '',
  groupIds: [],
  parents: [],
};


const Clients: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formErrors, setFormErrors] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [validFields, setValidFields] = useState<Set<string>>(new Set());
  const isValidatingRef = useRef(false);
  const currentErrorsRef = useRef<ValidationErrors>({});
  const shouldPreventCloseRef = useRef(false);
  const editDialogStateRef = useRef(false);
  const isCancellingRef = useRef(false);
  const [importDialog, setImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<string>('');
  const [filterGroupId, setFilterGroupId] = useState<string>('');
  const [filterAccountStatus, setFilterAccountStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>(''); // Поиск по клиентам
  const [passportDialog, setPassportDialog] = useState(false);
  const [passportData, setPassportData] = useState({
    passportSeries: '',
    passportNumber: '',
    passportIssueDate: '',
    passportIssuedBy: '',
    passportDivisionCode: '',
    passportBirthPlace: '',
  });
  const [passportErrors, setPassportErrors] = useState<Record<string, string>>({});

  // Функция валидации паспорта
  const validatePassport = (data: typeof passportData): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Валидация серии паспорта (4 цифры)
    if (data.passportSeries && data.passportSeries.trim() !== '') {
      if (!/^\d{4}$/.test(data.passportSeries)) {
        errors.passportSeries = 'Серия паспорта должна содержать 4 цифры';
      }
    }

    // Валидация номера паспорта (6 цифр)
    if (data.passportNumber && data.passportNumber.trim() !== '') {
      if (!/^\d{6}$/.test(data.passportNumber)) {
        errors.passportNumber = 'Номер паспорта должен содержать 6 цифр';
      }
    }

    // Валидация кода подразделения (6 цифр, формат: 123-456 или 123456)
    if (data.passportDivisionCode && data.passportDivisionCode.trim() !== '') {
      const cleanedCode = data.passportDivisionCode.replace(/-/g, '');
      if (!/^\d{6}$/.test(cleanedCode)) {
        errors.passportDivisionCode = 'Код подразделения должен содержать 6 цифр (формат: 123-456)';
      }
    }

    // Валидация даты выдачи
    if (data.passportIssueDate && data.passportIssueDate.trim() !== '') {
      const issueDate = new Date(data.passportIssueDate);
      const today = new Date();
      if (issueDate > today) {
        errors.passportIssueDate = 'Дата выдачи не может быть в будущем';
      }
    }

    // Валидация "Кем выдан" (минимум 3 символа, если заполнено)
    if (data.passportIssuedBy && data.passportIssuedBy.trim() !== '') {
      if (data.passportIssuedBy.trim().length < 3) {
        errors.passportIssuedBy = 'Поле должно содержать минимум 3 символа';
      }
    }

    // Валидация места рождения (минимум 3 символа, если заполнено)
    if (data.passportBirthPlace && data.passportBirthPlace.trim() !== '') {
      if (data.passportBirthPlace.trim().length < 3) {
        errors.passportBirthPlace = 'Поле должно содержать минимум 3 символа';
      }
    }

    return errors;
  };

  // Проверка наличия ошибок валидации
  const hasPassportErrors = (errors: Record<string, string>): boolean => {
    return Object.keys(errors).length > 0;
  };
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Мемоизация фильтрации и сортировки для оптимизации производительности
  const filteredAndSortedClients: Client[] = useMemo(() => {
    return clients
      .filter((client) => {
        // Поиск по имени, фамилии, отчеству, телефону, email
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const fullName = [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ').toLowerCase();
          const phone = (client.phone || '').toLowerCase();
          const email = (client.email || '').toLowerCase();
          if (!fullName.includes(query) && !phone.includes(query) && !email.includes(query)) {
            return false;
          }
        }
        // Фильтр по филиалу (через группы)
        if (filterBranchId) {
          const hasBranchGroup = client.groupMemberships?.some(
            (gm) => gm.group?.branchId === filterBranchId
          );
          if (!hasBranchGroup) return false;
        }
        // Фильтр по группе
        if (filterGroupId) {
          const hasGroup = client.groupMemberships?.some(
            (gm) => gm.group?.id === filterGroupId && gm.isActive
          );
          if (!hasGroup) return false;
        }
        // Фильтр по статусу: лид / не зарегистрирован / зарегистрирован
        if (filterAccountStatus) {
          const status = getClientAccountStatus(client);
          if (filterAccountStatus === 'lead' && status !== 'lead') return false;
          if (filterAccountStatus === 'unregistered' && status !== 'unregistered') return false;
          if (
            filterAccountStatus === 'registered' &&
            status !== 'registered' &&
            status !== 'pending'
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortBy) {
          case 'firstName':
            aValue = [a.lastName, a.firstName, a.middleName].filter(Boolean).join(' ') || `${a.firstName} ${a.lastName}`;
            bValue = [b.lastName, b.firstName, b.middleName].filter(Boolean).join(' ') || `${b.firstName} ${b.lastName}`;
            break;
          case 'email':
            aValue = a.email || '';
            bValue = b.email || '';
            break;
          case 'phone':
            aValue = a.phone || '';
            bValue = b.phone || '';
            break;
          case 'createdAt':
            aValue = new Date((a as any).createdAt || 0).getTime();
            bValue = new Date((b as any).createdAt || 0).getTime();
            break;
          case 'isActive':
            aValue = a.isActive ? 1 : 0;
            bValue = b.isActive ? 1 : 0;
            break;
          case 'accountStatus': {
            const rank = (c: Client) => {
              const s = getClientAccountStatus(c);
              if (s === 'lead') return 0;
              if (s === 'unregistered') return 1;
              if (s === 'pending') return 2;
              return 3;
            };
            aValue = rank(a);
            bValue = rank(b);
            break;
          }
          case 'group': {
            const groupName = (c: Client) => {
              const active = (c.groupMemberships || []).filter((gm: any) => gm.isActive);
              return active[0]?.group?.name || '';
            };
            aValue = groupName(a);
            bValue = groupName(b);
            break;
          }
          default:
            aValue = new Date((a as any).createdAt || 0).getTime();
            bValue = new Date((b as any).createdAt || 0).getTime();
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortOrder === 'asc' 
            ? (aValue > bValue ? 1 : -1)
            : (aValue < bValue ? 1 : -1);
        }
      });
  }, [clients, searchQuery, filterBranchId, filterGroupId, filterAccountStatus, sortBy, sortOrder]);
  const [editingPhoneClientId, setEditingPhoneClientId] = useState<string | null>(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState<string>('');
  const [groupsDialog, setGroupsDialog] = useState(false);
  const [selectedClientForGroups, setSelectedClientForGroups] = useState<Client | null>(null);
  const [membershipDialog, setMembershipDialog] = useState(false);
  const [selectedClientForMembership, setSelectedClientForMembership] = useState<Client | null>(null);
  const [catalogMemberships, setCatalogMemberships] = useState<Membership[]>([]);
  const [selectedMembershipId, setSelectedMembershipId] = useState('');
  const [issuingMembership, setIssuingMembership] = useState(false);
  const [remainingVisitsInput, setRemainingVisitsInput] = useState('');
  const [savingRemaining, setSavingRemaining] = useState(false);
  const [statsDialog, setStatsDialog] = useState(false);
  const [selectedClientForStats, setSelectedClientForStats] = useState<Client | null>(null);
  const [clientStats, setClientStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [clientCalendarDialog, setClientCalendarDialog] = useState(false);
  const [selectedClientForCalendar, setSelectedClientForCalendar] = useState<Client | null>(null);
  const [clientTrainings, setClientTrainings] = useState<any[]>([]);
  const [clientCompetitions, setClientCompetitions] = useState<any[]>([]);
  const [loadingClientCalendar, setLoadingClientCalendar] = useState(false);
  const [clientCalendarDate, setClientCalendarDate] = useState<Date>(new Date());
  const [clientCompetitionResults, setClientCompetitionResults] = useState<any[]>([]);
  const [loadingClientCompetitionResults, setLoadingClientCompetitionResults] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>({
    // Данные ребенка
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    birthCertificateNumber: '',
    birthCertificate: '',
    medicalCertificateNumber: '',
    medicalCertificate: '',
    schoolOrKindergarten: '',
    photo: '',
    weight: '',
    groupIds: [] as string[],
    // Родители
    parents: [] as Array<{
      fullName: string;
      phone: string;
      email: string;
      workplace: string;
      workplaceContact: string;
    }>,
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [createFormBaseline, setCreateFormBaseline] = useState<ClientFormData>(EMPTY_CLIENT_FORM);
  const [editFormBaseline, setEditFormBaseline] = useState<ClientFormData>(EMPTY_CLIENT_FORM);

  const photoInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setter used for file input
  const [birthCertificateFile, setBirthCertificateFile] = useState<File | null>(null);
  const [birthCertificatePreview, setBirthCertificatePreview] = useState<string | null>(null);
  const [keepBirthCertificate, setKeepBirthCertificate] = useState(false);
  const birthCertificateInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setter used for file input
  const [medicalCertificateFile, setMedicalCertificateFile] = useState<File | null>(null);
  const [medicalCertificatePreview, setMedicalCertificatePreview] = useState<string | null>(null);
  const [keepMedicalCertificate, setKeepMedicalCertificate] = useState(false);
  const medicalCertificateInputRef = useRef<HTMLInputElement>(null);
  const [trialEnabled, setTrialEnabled] = useState(false);
  const [trialTrainingId, setTrialTrainingId] = useState('');
  const [upcomingTrialTrainings, setUpcomingTrialTrainings] = useState<any[]>([]);
  const [loadingTrialTrainings, setLoadingTrialTrainings] = useState(false);
  /** Пробное при добавлении в группу из диалога (для лидов) */
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await apiService.getClients({ limit: 100 });
      setClients(response.data);
    } catch (err: any) {
      setError('Не удалось загрузить клиентов');
      console.error('Clients error:', err);
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
        
        // Автоматический сброс отметок членского взноса (если наступила дата сброса)
        try {
          await apiService.resetMembershipFees();
        } catch (resetErr: any) {
          // Игнорируем ошибки сброса (может быть не настроена дата)
          console.log('Membership fee reset check:', resetErr?.response?.data?.message || 'Not needed');
        }
        
        const [clientsRes, branchesRes, groupsRes] = await Promise.all([
          apiService.getClients({ limit: 100 }, abortController.signal),
          apiService.getBranches(undefined, abortController.signal),
          apiService.getGroups({ limit: 1000, page: 1 }, abortController.signal).catch(() => ({ data: [] }))
        ]);
        if (!isMounted || abortController.signal.aborted) return;
        setClients(clientsRes.data);
        setBranches(branchesRes.data);
        setGroups(groupsRes.data || []);
      } catch (err: any) {
        // Ignore cancelled requests
        if (err?.code === 'ERR_CANCELED' || err?.message === 'canceled' || abortController.signal.aborted) {
          return;
        }
        if (!isMounted) return;
        if (err.response?.status === 429) {
          setError('Слишком много запросов. Пожалуйста, подождите немного и обновите страницу.');
        } else {
          setError('Не удалось загрузить данные');
        }
        console.error('Data loading error:', err);
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
  }, [filterBranchId, filterGroupId, sortBy, sortOrder]);

  // Синхронизируем editDialogOpen с editDialog
  useEffect(() => {
    setEditDialogOpen(editDialog);
  }, [editDialog]);

  // Принудительно открываем диалог, если он был закрыт при наличии ошибок
  useEffect(() => {
    const hasErrors = hasFormErrors(formErrors) || hasFormErrors(currentErrorsRef.current);
    if (hasErrors && shouldPreventCloseRef.current && !editDialogOpen && editingClient) {
      // Если есть ошибки и диалог был закрыт, принудительно открываем его
      // Используем requestAnimationFrame для немедленного открытия
      requestAnimationFrame(() => {
        if (!editDialogOpen && (hasFormErrors(formErrors) || hasFormErrors(currentErrorsRef.current))) {
          setEditDialogOpen(true);
          setEditDialog(true);
        }
      });
      // Также используем несколько таймеров для надежности
      const timers: NodeJS.Timeout[] = [];
      for (let i = 0; i < 50; i++) {
        const timer = setTimeout(() => {
          const stillHasErrors = hasFormErrors(formErrors) || hasFormErrors(currentErrorsRef.current);
          if (!editDialogOpen && stillHasErrors && editingClient) {
            setEditDialogOpen(true);
            setEditDialog(true);
          }
        }, i * 5);
        timers.push(timer);
      }
      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    }
  }, [editDialogOpen, formErrors, editingClient]);
  
  // Дополнительный useEffect для отслеживания изменений editDialogOpen
  // Этот эффект будет срабатывать каждый раз, когда editDialogOpen меняется
  useEffect(() => {
    const hasErrors = hasFormErrors(formErrors) || hasFormErrors(currentErrorsRef.current);
    if (hasErrors && (shouldPreventCloseRef.current || isValidatingRef.current) && editingClient) {
      // Если диалог закрыт, но есть ошибки, открываем его немедленно
      if (!editDialogOpen) {
        // Используем несколько методов для гарантии открытия
        requestAnimationFrame(() => {
          setEditDialogOpen(true);
          setEditDialog(true);
        });
        // Используем множественные таймеры для гарантии открытия
        const timers: NodeJS.Timeout[] = [];
        for (let i = 0; i < 200; i++) {
          const timer = setTimeout(() => {
            const stillHasErrors = hasFormErrors(formErrors) || hasFormErrors(currentErrorsRef.current);
            if (!editDialogOpen && (stillHasErrors || shouldPreventCloseRef.current || isValidatingRef.current) && editingClient) {
              setEditDialogOpen(true);
              setEditDialog(true);
            }
          }, i * 5);
          timers.push(timer);
        }
        return () => {
          timers.forEach(timer => clearTimeout(timer));
        };
      }
    }
  }, [editDialogOpen, formErrors, editingClient]);
  
  // Агрессивный useEffect для отслеживания изменений editDialogOpen
  // Если модальное окно закрылось при наличии ошибок, немедленно переоткрываем его
  useEffect(() => {
    const hasErrors = hasFormErrors(formErrors) || hasFormErrors(currentErrorsRef.current);
    
    // Если диалог закрыт, но есть ошибки или идет валидация, открываем его немедленно
    if (!editDialogOpen && (hasErrors || shouldPreventCloseRef.current || isValidatingRef.current) && editingClient) {
      console.log('Dialog closed with errors, reopening...', { hasErrors, shouldPreventClose: shouldPreventCloseRef.current, isValidating: isValidatingRef.current });
      
      // Используем множественные методы для гарантии открытия
      requestAnimationFrame(() => {
        const stillHasErrors = hasFormErrors(formErrors) || hasFormErrors(currentErrorsRef.current);
        if ((stillHasErrors || shouldPreventCloseRef.current || isValidatingRef.current) && editingClient) {
          console.log('Reopening dialog via requestAnimationFrame');
          setEditDialogOpen(true);
          setEditDialog(true);
        }
      });
      
      // Используем множественные таймеры для гарантии открытия
      const timers: NodeJS.Timeout[] = [];
      for (let i = 0; i < 1000; i++) {
        const timer = setTimeout(() => {
          const stillHasErrors = hasFormErrors(formErrors) || hasFormErrors(currentErrorsRef.current);
          if (!editDialogOpen && (stillHasErrors || shouldPreventCloseRef.current || isValidatingRef.current) && editingClient) {
            setEditDialogOpen(true);
            setEditDialog(true);
          }
        }, i * 1);
        timers.push(timer);
      }
      
      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    }
  }, [editDialogOpen, formErrors, editingClient]);
  
  // Постоянный мониторинг состояния диалога с помощью setInterval
  useEffect(() => {
    if (!editingClient) return;
    
    const interval = setInterval(() => {
      const hasErrors = hasFormErrors(formErrors) || hasFormErrors(currentErrorsRef.current);
      // Если диалог закрыт, но есть ошибки или идет валидация, открываем его немедленно
      if (!editDialogOpen && (hasErrors || shouldPreventCloseRef.current || isValidatingRef.current) && editingClient) {
        console.log('Reopening dialog via setInterval', { hasErrors, shouldPreventClose: shouldPreventCloseRef.current, isValidating: isValidatingRef.current });
        setEditDialogOpen(true);
        setEditDialog(true);
      }
    }, 1); // Проверяем каждые 1ms
    
    return () => clearInterval(interval);
  }, [editDialogOpen, formErrors, editingClient]);

  // Handle clientId from URL params — открыть карточку спортсмена из любого раздела
  useEffect(() => {
    const clientIdFromUrl = searchParams.get('clientId');
    if (!clientIdFromUrl || editDialog) return;

    let cancelled = false;

    (async () => {
      try {
        let client = clients.find((c) => c.id === clientIdFromUrl);
        if (!client) {
          client = await apiService.getClient(clientIdFromUrl);
        }
        if (cancelled || !client) return;

        await handleEditClient(client);

        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('clientId');
        setSearchParams(newSearchParams, { replace: true });
      } catch (err) {
        console.error('Failed to open client card from URL:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clients, searchParams, editDialog, setSearchParams]);

  const handleCreateClient = async (): Promise<boolean> => {
    // Валидация уже выполнена в onClick кнопки, поэтому здесь просто проверяем еще раз для надежности
    const errors = validateClientForm(formData);

    if (trialEnabled && !trialTrainingId) {
      setError('Выберите занятие для пробной записи');
      setSnackbarMessage('Для пробного занятия нужно выбрать тренировку');
      setSnackbarOpen(true);
      return false;
    }
    
    if (hasFormErrors(errors)) {
      setError('Пожалуйста, исправьте ошибки в форме');
      setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
      setSnackbarOpen(true);
      return false;
    }

    try {
      const { groupIds, ...clientData } = formData;
      const dataToSend: any = {
        ...clientData,
        weight: clientData.weight ? parseFloat(clientData.weight) : null,
        // Преобразуем пустые строки паспорта в null
        passportSeries: clientData.passportSeries && clientData.passportSeries.trim() !== '' ? clientData.passportSeries : null,
        passportNumber: clientData.passportNumber && clientData.passportNumber.trim() !== '' ? clientData.passportNumber : null,
        passportIssueDate: clientData.passportIssueDate && clientData.passportIssueDate.trim() !== '' ? clientData.passportIssueDate : null,
        passportIssuedBy: clientData.passportIssuedBy && clientData.passportIssuedBy.trim() !== '' ? clientData.passportIssuedBy : null,
        passportDivisionCode: clientData.passportDivisionCode && clientData.passportDivisionCode.trim() !== '' ? clientData.passportDivisionCode : null,
        passportBirthPlace: clientData.passportBirthPlace && clientData.passportBirthPlace.trim() !== '' ? clientData.passportBirthPlace : null,
      };
      if (!dataToSend.birthCertificate) delete dataToSend.birthCertificate;
      if (!dataToSend.medicalCertificate) delete dataToSend.medicalCertificate;
      const createdClient = await apiService.createClient(dataToSend);

      let trialGroupId: string | null = null;
      if (trialEnabled && trialTrainingId && createdClient?.id) {
        try {
          const membership = await apiService.assignClientTrial(createdClient.id, trialTrainingId);
          trialGroupId = membership?.groupId || membership?.group?.id || null;
        } catch (err: any) {
          console.error('Error assigning trial:', err);
          setSnackbarMessage(
            err?.response?.data?.error || 'Клиент создан, но не удалось записать на пробное занятие'
          );
          setSnackbarOpen(true);
        }
      }

      // Постоянные группы (пробную группу не дублируем через addClientToGroup)
      if (groupIds && groupIds.length > 0 && createdClient?.id) {
        for (const groupId of groupIds) {
          if (trialGroupId && groupId === trialGroupId) continue;
          try {
            await apiService.addClientToGroup(groupId, createdClient.id);
          } catch (err: any) {
            console.error(`Error adding client to group ${groupId}:`, err);
          }
        }
      }

      setTrialEnabled(false);
      setTrialTrainingId('');
      setUpcomingTrialTrainings([]);
      
      await fetchClients();
      // Сбрасываем все и закрываем диалог только после успешного создания
      setFormErrors({});
      setTouchedFields(new Set());
      setError('');
      setOpenDialog(false);
      setFormData({
        firstName: '',
        lastName: '',
        middleName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        address: '',
        birthCertificateNumber: '',
        birthCertificate: '',
        medicalCertificateNumber: '',
        medicalCertificate: '',
        schoolOrKindergarten: '',
        photo: '',
        weight: '',
        groupIds: [],
        parents: [],
      });
      setPhotoPreview(null);
      setPhotoFile(null);
      setBirthCertificatePreview(null);
      setBirthCertificateFile(null);
      setKeepBirthCertificate(false);
      setMedicalCertificatePreview(null);
      setMedicalCertificateFile(null);
      setKeepMedicalCertificate(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
      if (birthCertificateInputRef.current) {
        birthCertificateInputRef.current.value = '';
      }
      if (medicalCertificateInputRef.current) {
        medicalCertificateInputRef.current.value = '';
      }
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания клиента');
      console.error('Error creating client:', err);
      return false;
    }
  };

  // Validate field in real-time
  const validateFieldValue = (fieldName: string, value: any, parentIndex?: number) => {
    const fieldError = validateField(fieldName, value, formData, parentIndex);
    
    setFormErrors(prev => {
      const newErrors = { ...prev };
      const errorKey = parentIndex !== undefined ? `parent_${parentIndex}_${fieldName.replace('parent_', '')}` : fieldName;
      
      if (fieldError) {
        newErrors[errorKey] = fieldError;
      } else {
        delete newErrors[errorKey];
      }
      
      return newErrors;
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Validate field if it was touched
    if (touchedFields.has(field)) {
      validateFieldValue(field, value);
    }
    
    // Clear general error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleFieldBlur = (field: string, value: string) => {
    setTouchedFields(prev => new Set(prev).add(field));
    validateFieldValue(field, value);
  };

  const handleParentFieldChange = (index: number, field: string, value: string) => {
    const newParents = [...formData.parents];
    newParents[index] = { ...newParents[index], [field]: value };
    setFormData(prev => ({ ...prev, parents: newParents }));
    
    // Validate field if it was touched
    const errorKey = `parent_${index}_${field}`;
    if (touchedFields.has(errorKey)) {
      const fieldName = field === 'fullName' ? 'parent_fullName' : 
                       field === 'email' ? 'parent_email' : 
                       field === 'phone' ? 'parent_phone' : field;
      validateFieldValue(fieldName, value, index);
    }
  };

  const handleParentFieldBlur = (index: number, field: string, value: string) => {
    const errorKey = `parent_${index}_${field}`;
    setTouchedFields(prev => new Set(prev).add(errorKey));
    const fieldName = field === 'fullName' ? 'parent_fullName' : 
                     field === 'email' ? 'parent_email' : 
                     field === 'phone' ? 'parent_phone' : field;
    validateFieldValue(fieldName, value, index);
  };

  const handleEditClient = async (client: Client) => {
    setEditingClient(client);
    setFormData({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      middleName: client.middleName || '',
      email: client.email || '',
      phone: client.phone || '',
      dateOfBirth: client.dateOfBirth ? client.dateOfBirth.split('T')[0] : '',
      gender: client.gender || '',
      address: client.address || '',
      birthCertificateNumber: client.birthCertificateNumber || '',
      birthCertificate: '',
      medicalCertificateNumber: client.medicalCertificateNumber || '',
      medicalCertificate: '',
      schoolOrKindergarten: client.schoolOrKindergarten || '',
      photo: client.photo || '',
      weight: client.weight ? String(client.weight) : '',
      groupIds: client.groupMemberships
        ?.filter((gm: any) => gm.isActive)
        .map((gm: any) => gm.group?.id)
        .filter(Boolean) || [],
      parents: client.parents?.map(p => ({
        fullName: p.fullName || '',
        phone: p.phone || '',
        email: p.email || '',
        workplace: p.workplace || '',
        workplaceContact: p.workplaceContact || '',
      })) || [],
    });
    setPhotoPreview(client.photo || null);
    setPhotoFile(null);
    setBirthCertificatePreview(null);
    setBirthCertificateFile(null);
    setKeepBirthCertificate(Boolean(client.hasBirthCertificate));
    setMedicalCertificatePreview(null);
    setMedicalCertificateFile(null);
    setKeepMedicalCertificate(Boolean(client.hasMedicalCertificate));
    setFormErrors({});
    currentErrorsRef.current = {};
    shouldPreventCloseRef.current = false;
    setTouchedFields(new Set());
    setValidFields(new Set());
    setError('');
    setEditDialog(true);
    
    // Загружаем результаты соревнований клиента
    setLoadingClientCompetitionResults(true);
    try {
      const allCompetitionsRes = await apiService.getCompetitions();
      const clientCompetitionsList = allCompetitionsRes.data.filter((c: any) =>
        c.participants?.some((p: any) => p.clientId === client.id)
      );
      
      // Для каждого соревнования получаем результаты клиента
      const results: any[] = [];
      for (const competition of clientCompetitionsList) {
        if (competition.results && competition.results.length > 0) {
          const participant = competition.participants?.find((p: any) => p.clientId === client.id);
          if (participant) {
            const clientResults = competition.results.filter((r: any) => r.participantId === participant.id);
            clientResults.forEach((result: any) => {
              results.push({
                ...result,
                competition: {
                  id: competition.id,
                  name: competition.name,
                  date: competition.date,
                  location: competition.location,
                }
              });
            });
          }
        }
      }
      
      // Сортируем по дате соревнования (от новых к старым)
      results.sort((a, b) => {
        const dateA = new Date(a.competition.date).getTime();
        const dateB = new Date(b.competition.date).getTime();
        return dateB - dateA;
      });
      
      setClientCompetitionResults(results);
    } catch (err: any) {
      console.error('Error loading client competition results:', err);
      setClientCompetitionResults([]);
    } finally {
      setLoadingClientCompetitionResults(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for validation button
  const handleValidateForm = (e?: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent form submission and event bubbling
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Set flag to prevent dialog from closing during validation
    isValidatingRef.current = true;
    shouldPreventCloseRef.current = true;
    
    // Mark all fields as touched to show all validation errors
    const allFields = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'weight'];
    const newTouchedFields = new Set<string>();
    allFields.forEach(field => newTouchedFields.add(field));
    formData.parents.forEach((_, index) => {
      ['fullName', 'email', 'phone'].forEach(field => {
        newTouchedFields.add(`parent_${index}_${field}`);
      });
    });
    setTouchedFields(newTouchedFields);

    // Validate entire form
    const errors = validateClientForm(formData);
    
    // Update ref immediately so onClose can check it synchronously
    currentErrorsRef.current = errors;
    
    // Set errors immediately using functional update to ensure state is updated
    setFormErrors(() => errors);
    
    // If there are errors, show them in Snackbar and keep dialog open
    if (hasFormErrors(errors)) {
      setError('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
      setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
      setSnackbarOpen(true);
      setValidFields(new Set()); // Clear valid fields if there are errors
      // Set flag to prevent closing - keep it true
      shouldPreventCloseRef.current = true;
      editDialogStateRef.current = true;
      // Принудительно оставляем диалог открытым
      setEditDialogOpen(true);
      setEditDialog(true);
      // Используем множественные таймеры для гарантии открытия
      requestAnimationFrame(() => {
        setEditDialogOpen(true);
        setEditDialog(true);
      });
      for (let i = 0; i < 100; i++) {
        setTimeout(() => {
          setEditDialogOpen(true);
          setEditDialog(true);
        }, i * 5);
      }
      // Reset validation flag after a delay
      setTimeout(() => {
        isValidatingRef.current = false;
        // Keep prevent close flag true as long as there are errors
        if (hasFormErrors(errors)) {
          shouldPreventCloseRef.current = true;
        }
      }, 100);
      return;
    }
    
    // Clear prevent close flag if no errors
    shouldPreventCloseRef.current = false;
    editDialogStateRef.current = false;
    
    // If no errors, mark all validated fields as valid (only fields that have values and no errors)
    const newValidFields = new Set<string>();
    allFields.forEach(field => {
      const value = formData[field as keyof ClientFormData];
      if (value && String(value).trim() !== '') {
        // Check if field is valid (no error for this field)
        if (!errors[field]) {
          newValidFields.add(field);
        }
      }
    });
    formData.parents.forEach((parent, index) => {
      if (parent.fullName && parent.fullName.trim() !== '' && !errors[`parent_${index}_fullName`]) {
        newValidFields.add(`parent_${index}_fullName`);
      }
      if (parent.email && parent.email.trim() !== '' && !errors[`parent_${index}_email`]) {
        newValidFields.add(`parent_${index}_email`);
      }
      if (parent.phone && parent.phone.trim() !== '' && !errors[`parent_${index}_phone`]) {
        newValidFields.add(`parent_${index}_phone`);
      }
    });
    setValidFields(newValidFields);
    setError('');
    
    // Reset flag after validation is complete
    setTimeout(() => {
      isValidatingRef.current = false;
      shouldPreventCloseRef.current = false;
    }, 100);
  };

  const handleUpdateClient = async (): Promise<boolean> => {
    if (!editingClient) return false;
    
    // Mark all fields as touched to show all validation errors
    const allFields = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'weight'];
    const newTouchedFields = new Set<string>();
    allFields.forEach(field => newTouchedFields.add(field));
    formData.parents.forEach((_, index) => {
      ['fullName', 'email', 'phone'].forEach(field => {
        newTouchedFields.add(`parent_${index}_${field}`);
      });
    });
    setTouchedFields(newTouchedFields);

    // Validate entire form
    const errors = validateClientForm(formData);
    setFormErrors(errors);
    
    // If there are errors, show them and keep the form open
    if (hasFormErrors(errors)) {
      setError('Пожалуйста, исправьте ошибки в форме перед сохранением');
      setValidFields(new Set()); // Clear valid fields if there are errors
      return false; // Don't close the form, don't save
    }
    
    // Clear error if validation passed
    setError('');
    setValidFields(new Set()); // Clear valid fields before saving
    
    try {
      const { groupIds, ...clientData } = formData;
      const dataToSend: any = {
        ...clientData,
        weight: clientData.weight ? parseFloat(clientData.weight) : null,
        // Преобразуем пустые строки паспорта в null
        passportSeries: clientData.passportSeries && clientData.passportSeries.trim() !== '' ? clientData.passportSeries : null,
        passportNumber: clientData.passportNumber && clientData.passportNumber.trim() !== '' ? clientData.passportNumber : null,
        passportIssueDate: clientData.passportIssueDate && clientData.passportIssueDate.trim() !== '' ? clientData.passportIssueDate : null,
        passportIssuedBy: clientData.passportIssuedBy && clientData.passportIssuedBy.trim() !== '' ? clientData.passportIssuedBy : null,
        passportDivisionCode: clientData.passportDivisionCode && clientData.passportDivisionCode.trim() !== '' ? clientData.passportDivisionCode : null,
        passportBirthPlace: clientData.passportBirthPlace && clientData.passportBirthPlace.trim() !== '' ? clientData.passportBirthPlace : null,
      };
      if (formData.birthCertificate) {
        dataToSend.birthCertificate = formData.birthCertificate;
      } else if (keepBirthCertificate) {
        delete dataToSend.birthCertificate;
      } else {
        dataToSend.birthCertificate = null;
      }
      if (formData.medicalCertificate) {
        dataToSend.medicalCertificate = formData.medicalCertificate;
      } else if (keepMedicalCertificate) {
        delete dataToSend.medicalCertificate;
      } else {
        dataToSend.medicalCertificate = null;
      }
      await apiService.updateClient(editingClient.id, dataToSend);
      
      // Обновляем группы клиента
      const currentGroupIds = editingClient.groupMemberships
        ?.filter((gm: any) => gm.isActive)
        .map((gm: any) => gm.group?.id)
        .filter(Boolean) || [];
      const newGroupIds = groupIds || [];
      
      // Удаляем из групп, которых больше нет в списке
      for (const currentGroupId of currentGroupIds) {
        if (!newGroupIds.includes(currentGroupId)) {
          try {
            await apiService.removeClientFromGroup(currentGroupId, editingClient.id);
          } catch (err: any) {
            console.error(`Error removing client from group ${currentGroupId}:`, err);
          }
        }
      }
      
      // Добавляем в новые группы
      for (const newGroupId of newGroupIds) {
        if (!currentGroupIds.includes(newGroupId)) {
          try {
            await apiService.addClientToGroup(newGroupId, editingClient.id);
          } catch (err: any) {
            console.error(`Error adding client to group ${newGroupId}:`, err);
          }
        }
      }
      
      await fetchClients();
      shouldPreventCloseRef.current = false;
      setEditDialogOpen(false);
      setEditDialog(false);
      setEditingClient(null);
      setFormErrors({});
      currentErrorsRef.current = {};
      setTouchedFields(new Set());
      setValidFields(new Set());
      setError('');
      setFormData({
        firstName: '',
        lastName: '',
        middleName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        address: '',
        birthCertificateNumber: '',
        birthCertificate: '',
        medicalCertificateNumber: '',
        medicalCertificate: '',
        schoolOrKindergarten: '',
        photo: '',
        weight: '',
        groupIds: [],
        parents: [],
      });
      setPhotoPreview(null);
      setPhotoFile(null);
      setBirthCertificatePreview(null);
      setBirthCertificateFile(null);
      setKeepBirthCertificate(false);
      setMedicalCertificatePreview(null);
      setMedicalCertificateFile(null);
      setKeepMedicalCertificate(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
      if (birthCertificateInputRef.current) {
        birthCertificateInputRef.current.value = '';
      }
      if (medicalCertificateInputRef.current) {
        medicalCertificateInputRef.current.value = '';
      }
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления клиента');
      console.error('Error updating client:', err);
      return false;
    }
  };

  const handleExportClients = async () => {
    try {
      const blob = await apiService.exportClients();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clients_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error exporting clients:', error);
      setError('Не удалось экспортировать клиентов');
    }
  };

  const handleImportClients = async () => {
    if (!importFile) {
      alert('Пожалуйста, выберите файл');
      return;
    }

    setImporting(true);
    setError('');
    try {
      const result = await apiService.importClients(importFile);
      setImportResult(result.data);
      await fetchClients();
      if (result.data.errors && result.data.errors.length > 0) {
        // Показываем ошибки, но не закрываем диалог
      } else {
        setTimeout(() => {
          setImportDialog(false);
          setImportFile(null);
          setImportResult(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error importing clients:', error);
      setError(error?.response?.data?.error || 'Не удалось импортировать клиентов');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await apiService.downloadClientTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template_import_clients.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading template:', error);
      setError('Не удалось скачать шаблон');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setImportFile(file);
        setImportResult(null);
      } else {
        setError('Поддерживаются только файлы Excel (.xlsx, .xls)');
      }
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого клиента?')) {
      return;
    }
    try {
      await apiService.deleteClient(clientId);
      await fetchClients();
      if (editingClient?.id === clientId) {
        setEditDialogOpen(false);
        setEditDialog(false);
        setEditingClient(null);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('clientId');
          return next;
        });
      }
    } catch (err: any) {
      console.error('Error deleting client:', err);
      setError(err.response?.data?.error || 'Ошибка удаления клиента');
    }
  };

  const handleApproveAccount = async (client: Client) => {
    try {
      await apiService.approveClientAccount(client.id);
      setClients((prev) =>
        prev.map((c) =>
          c.id === client.id
            ? { ...c, isAccountApproved: true, hasPassword: true }
            : c
        )
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка подтверждения аккаунта');
    }
  };

  const handleRejectAccount = async (client: Client) => {
    if (
      !window.confirm(
        'Отклонить регистрацию? Пароль будет сброшен, клиент сможет зарегистрироваться заново.'
      )
    ) {
      return;
    }
    try {
      await apiService.rejectClientAccount(client.id);
      setClients((prev) =>
        prev.map((c) =>
          c.id === client.id
            ? {
                ...c,
                hasPassword: false,
                isAccountApproved: false,
                accountApprovedAt: undefined,
                accountApprovedBy: undefined,
              }
            : c
        )
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка отклонения регистрации');
    }
  };

  const editBaselineReady = React.useRef(false);
  React.useEffect(() => {
    if (editDialogOpen && editingClient && !editBaselineReady.current) {
      setEditFormBaseline(formData);
      editBaselineReady.current = true;
    }
    if (!editDialogOpen) {
      editBaselineReady.current = false;
    }
  }, [editDialogOpen, editingClient, formData]);

  const discardCreateForm = React.useCallback(() => {
    setOpenDialog(false);
    setFormData({ ...EMPTY_CLIENT_FORM });
    setCreateFormBaseline({ ...EMPTY_CLIENT_FORM });
    setPhotoPreview(null);
    setPhotoFile(null);
    setBirthCertificatePreview(null);
    setBirthCertificateFile(null);
    setMedicalCertificatePreview(null);
    setMedicalCertificateFile(null);
    setEditingClient(null);
    setFormErrors({});
    setTouchedFields(new Set());
    setValidFields(new Set());
    setError('');
    setTrialEnabled(false);
    setTrialTrainingId('');
  }, []);

  const discardEditForm = React.useCallback(() => {
    isCancellingRef.current = true;
    shouldPreventCloseRef.current = false;
    isValidatingRef.current = false;
    editDialogStateRef.current = false;
    setEditDialogOpen(false);
    setEditDialog(false);
    setEditingClient(null);
    setFormData({ ...EMPTY_CLIENT_FORM });
    setEditFormBaseline({ ...EMPTY_CLIENT_FORM });
    setPhotoPreview(null);
    setPhotoFile(null);
    setBirthCertificatePreview(null);
    setBirthCertificateFile(null);
    setKeepBirthCertificate(false);
    setMedicalCertificatePreview(null);
    setMedicalCertificateFile(null);
    setKeepMedicalCertificate(false);
    setFormErrors({});
    currentErrorsRef.current = {};
    setTouchedFields(new Set());
    setValidFields(new Set());
    setError('');
    setTimeout(() => {
      isCancellingRef.current = false;
    }, 100);
  }, []);

  const createDirty = openDialog && isDirtyValue(formData, createFormBaseline);
  const editDirty = editDialogOpen && isDirtyValue(formData, editFormBaseline);

  const createUnsaved = useUnsavedClose({
    isDirty: Boolean(createDirty),
    onDiscard: discardCreateForm,
    onSave: async () => handleCreateClient(),
  });

  const editUnsaved = useUnsavedClose({
    isDirty: Boolean(editDirty),
    onDiscard: discardEditForm,
    onSave: async () => handleUpdateClient(),
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !openDialog && !editDialogOpen) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  const handleClientsSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder(key === 'isActive' ? 'desc' : 'asc');
    }
  };

  const openAddClientDialog = () => {
            // Сбрасываем форму при открытии диалога создания
            setFormData({
              firstName: '',
              lastName: '',
              middleName: '',
              email: '',
              phone: '',
              dateOfBirth: '',
              gender: '',
              address: '',
              birthCertificateNumber: '',
              birthCertificate: '',
              medicalCertificateNumber: '',
              medicalCertificate: '',
              schoolOrKindergarten: '',
              photo: '',
              weight: '',
              passportSeries: '',
              passportNumber: '',
              passportIssueDate: '',
              passportIssuedBy: '',
              passportDivisionCode: '',
              passportBirthPlace: '',
              groupIds: [],
              parents: [],
            });
            setTrialEnabled(false);
            setTrialTrainingId('');
            setUpcomingTrialTrainings([]);
            setPhotoPreview(null);
            setPhotoFile(null);
            setBirthCertificatePreview(null);
            setBirthCertificateFile(null);
            setMedicalCertificatePreview(null);
            setMedicalCertificateFile(null);
            setEditingClient(null);
            setFormErrors({});
            setTouchedFields(new Set());
            setValidFields(new Set());
            setError('');
            setCreateFormBaseline({ ...EMPTY_CLIENT_FORM });
            setOpenDialog(true);
  };

  const loadUpcomingTrialTrainings = async (groupId?: string) => {
    setLoadingTrialTrainings(true);
    try {
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + 30);
      const res = await apiService.getTrainings({
        startDate: now.toISOString(),
        endDate: end.toISOString(),
        limit: 50,
        page: 1,
      });
      let list = (res.data || []).filter((t: any) => t.groupId && !t.isCancelled);
      if (groupId) {
        list = list.filter((t: any) => t.groupId === groupId);
      }
      setUpcomingTrialTrainings(list);
    } catch (err) {
      console.error('Failed to load trainings for trial:', err);
      setUpcomingTrialTrainings([]);
    } finally {
      setLoadingTrialTrainings(false);
    }
  };

  return (
    <Box>
      <ClientsList
        clients={filteredAndSortedClients}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSort={handleClientsSort}
        onEdit={handleEditClient}
        onDelete={handleDeleteClient}
        onApproveAccount={handleApproveAccount}
        onRejectAccount={handleRejectAccount}
        onGroupClick={(client) => {
          setSelectedClientForGroups(client);
          setGroupsDialog(true);
        }}
        onMembershipClick={async (client) => {
          setSelectedClientForMembership(client);
          setSelectedMembershipId('');
          setRemainingVisitsInput(
            client.activeMembership?.remaining != null
              ? String(client.activeMembership.remaining)
              : ''
          );
          setMembershipDialog(true);
          try {
            const res = await apiService.getMemberships({ limit: 200 });
            setCatalogMemberships((res.data || []).filter((m: Membership) => m.isActive !== false));
          } catch (err) {
            console.error(err);
            setSnackbarMessage('Не удалось загрузить каталог абонементов');
            setSnackbarOpen(true);
          }
        }}
        toolbarActions={
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap',
              gap: 1,
              width: '100%',
            }}
          >
            <Button
              variant="outlined"
              startIcon={<FileDownload />}
              sx={{ textTransform: 'none', borderRadius: '19px', width: { xs: '100%', sm: 'auto' } }}
              onClick={handleExportClients}
            >
              Экспорт в Excel
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileUpload />}
              sx={{ textTransform: 'none', borderRadius: '19px', width: { xs: '100%', sm: 'auto' } }}
              onClick={() => {
                setImportDialog(true);
                setImportResult(null);
              }}
            >
              Импорт из Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              sx={{ textTransform: 'none', borderRadius: '19px', bgcolor: colors.primary, width: { xs: '100%', sm: 'auto' } }}
              onClick={openAddClientDialog}
              data-onboarding="add-client-button"
            >
              Добавить клиента
            </Button>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 }, width: { xs: '100%', sm: 'auto' } }}>
              <InputLabel>Филиал</InputLabel>
              <Select
                value={filterBranchId}
                onChange={(e) => setFilterBranchId(e.target.value)}
                label="Филиал"
              >
                <MenuItem value="">Все филиалы</MenuItem>
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 }, width: { xs: '100%', sm: 'auto' } }}>
              <InputLabel>Группа</InputLabel>
              <Select
                value={filterGroupId}
                onChange={(e) => setFilterGroupId(e.target.value)}
                label="Группа"
              >
                <MenuItem value="">Все группы</MenuItem>
                {groups.filter(g => g.isActive).map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 180 }, width: { xs: '100%', sm: 'auto' } }}>
              <InputLabel>Статус</InputLabel>
              <Select
                value={filterAccountStatus}
                onChange={(e) => setFilterAccountStatus(e.target.value)}
                label="Статус"
              >
                <MenuItem value="">Все статусы</MenuItem>
                <MenuItem value="lead">Лид</MenuItem>
                <MenuItem value="unregistered">Не зарегистрирован</MenuItem>
                <MenuItem value="registered">Зарегистрирован</MenuItem>
              </Select>
            </FormControl>
          </Box>
        }
      />

      {/* Диалог добавления клиента */}
      <Dialog 
        open={openDialog}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            createUnsaved.requestClose(reason);
          }
        }}
        maxWidth="md" 
        fullWidth
        disableEscapeKeyDown={hasFormErrors(formErrors)}
      >
        <DialogTitle>Добавить нового клиента</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Фото клиента слева от первых строк */}
            <Grid item xs={12} sm={3}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <input
                  type="file"
                  accept="image/*"
                  ref={photoInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPhotoFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setPhotoPreview(reader.result as string);
                        setFormData(prev => ({ ...prev, photo: reader.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <Box
                  sx={{
                    width: 120,
                    height: 120,
                    borderRadius: 1,
                    border: '2px dashed',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    bgcolor: 'background.default',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover'
                    }
                  }}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Фото клиента"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <PhotoCamera sx={{ fontSize: 32, color: 'text.secondary', mb: 0.5 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Загрузить фото
                      </Typography>
                    </Box>
                  )}
                </Box>
                {photoPreview ? (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      setPhotoPreview(null);
                      setPhotoFile(null);
                      setFormData(prev => ({ ...prev, photo: '' }));
                      if (photoInputRef.current) {
                        photoInputRef.current.value = '';
                      }
                    }}
                    sx={{ mt: 1 }}
                  >
                    Удалить
                  </Button>
                ) : null}
              </Box>
            </Grid>
            <Grid item xs={12} sm={9}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Фамилия"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    required
                    error={!!formErrors.lastName}
                    helperText={formErrors.lastName}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Имя"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    required
                    error={!!formErrors.firstName}
                    helperText={formErrors.firstName}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Отчество"
                    value={formData.middleName}
                    onChange={(e) => handleInputChange('middleName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    error={!!formErrors.email}
                    helperText={formErrors.email}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Телефон"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+1234567890"
                    error={!!formErrors.phone}
                    helperText={formErrors.phone}
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Дата рождения"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                InputLabelProps={{ shrink: true }}
                error={!!formErrors.dateOfBirth}
                helperText={formErrors.dateOfBirth}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Пол</InputLabel>
                <Select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                >
                  <MenuItem value="male">Мужской</MenuItem>
                  <MenuItem value="female">Женский</MenuItem>
                  <MenuItem value="other">Другой</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Вес (кг)"
                type="number"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                inputProps={{ min: 0, max: 500, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Группы</InputLabel>
                <Select
                  multiple
                  value={formData.groupIds}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({
                      ...formData,
                      groupIds: typeof value === 'string' ? value.split(',') : value as string[]
                    });
                  }}
                  label="Группы"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((groupId) => {
                        const group = groups.find(g => g.id === groupId);
                        return group ? (
                          <Chip key={groupId} label={group.name} size="small" />
                        ) : null;
                      })}
                    </Box>
                  )}
                >
                  {groups.filter(g => g.isActive).map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name} {group.branch ? `(${group.branch.name})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={trialEnabled}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setTrialEnabled(on);
                      if (on) {
                        loadUpcomingTrialTrainings();
                      } else {
                        setTrialTrainingId('');
                      }
                    }}
                  />
                }
                label="Пробное занятие"
              />
            </Grid>
            {trialEnabled && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Занятие для пробы</InputLabel>
                  <Select
                    value={trialTrainingId}
                    onChange={(e) => setTrialTrainingId(e.target.value)}
                    label="Занятие для пробы"
                    disabled={loadingTrialTrainings}
                  >
                    {loadingTrialTrainings && (
                      <MenuItem value="" disabled>
                        Загрузка…
                      </MenuItem>
                    )}
                    {!loadingTrialTrainings && upcomingTrialTrainings.length === 0 && (
                      <MenuItem value="" disabled>
                        Нет ближайших занятий с группой
                      </MenuItem>
                    )}
                    {upcomingTrialTrainings.map((t: any) => (
                      <MenuItem key={t.id} value={t.id}>
                        {format(new Date(t.startTime), 'dd.MM.yyyy HH:mm', { locale: ru })}
                        {' — '}
                        {t.group?.name || t.title}
                        {t.branch?.name ? ` (${t.branch.name})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Адрес проживания"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Номер свидетельства о рождении"
                value={formData.birthCertificateNumber}
                onChange={(e) => handleInputChange('birthCertificateNumber', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Номер справки"
                value={formData.medicalCertificateNumber}
                onChange={(e) => handleInputChange('medicalCertificateNumber', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Место учебы/дет.сада"
                value={formData.schoolOrKindergarten}
                onChange={(e) => handleInputChange('schoolOrKindergarten', e.target.value)}
              />
            </Grid>
            {/* Загрузка свидетельства о рождении */}
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                  Свидетельство о рождении (фото/документ)
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  ref={birthCertificateInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setBirthCertificateFile(file);
                      setKeepBirthCertificate(false);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setBirthCertificatePreview(reader.result as string);
                        setFormData(prev => ({ ...prev, birthCertificate: reader.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <Box
                  sx={{
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    minHeight: 100,
                    bgcolor: 'background.default',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover'
                    }
                  }}
                  onClick={() => birthCertificateInputRef.current?.click()}
                >
                  {birthCertificatePreview ? (
                    <Box sx={{ textAlign: 'center', width: '100%' }}>
                      <img
                        src={birthCertificatePreview}
                        alt="Свидетельство о рождении"
                        style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                      />
                      <Button
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBirthCertificatePreview(null);
                          setBirthCertificateFile(null);
                          setKeepBirthCertificate(false);
                          setFormData(prev => ({ ...prev, birthCertificate: '' }));
                          if (birthCertificateInputRef.current) {
                            birthCertificateInputRef.current.value = '';
                          }
                        }}
                        sx={{ mt: 1 }}
                      >
                        Удалить
                      </Button>
                    </Box>
                  ) : keepBirthCertificate && editingClient ? (
                    <Box sx={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Файл загружен на сервер
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          try {
                            const { blob, filename } = await apiService.downloadClientCertificate(
                              editingClient.id,
                              'birth'
                            );
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch {
                            setSnackbarMessage('Не удалось скачать файл');
                            setSnackbarOpen(true);
                          }
                        }}
                        sx={{ mr: 1 }}
                      >
                        Скачать
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setKeepBirthCertificate(false);
                          setFormData((prev) => ({ ...prev, birthCertificate: '' }));
                        }}
                      >
                        Удалить
                      </Button>
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center' }}>
                      <PhotoCamera sx={{ fontSize: 32, color: 'text.secondary', mb: 0.5 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Загрузить файл
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        (изображение или PDF)
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Grid>
            {/* Загрузка справки */}
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                  Справка (фото/документ)
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  ref={medicalCertificateInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setMedicalCertificateFile(file);
                      setKeepMedicalCertificate(false);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setMedicalCertificatePreview(reader.result as string);
                        setFormData(prev => ({ ...prev, medicalCertificate: reader.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <Box
                  sx={{
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    minHeight: 100,
                    bgcolor: 'background.default',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover'
                    }
                  }}
                  onClick={() => medicalCertificateInputRef.current?.click()}
                >
                  {medicalCertificatePreview ? (
                    <Box sx={{ textAlign: 'center', width: '100%' }}>
                      <img
                        src={medicalCertificatePreview}
                        alt="Справка"
                        style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                      />
                      <Button
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMedicalCertificatePreview(null);
                          setMedicalCertificateFile(null);
                          setKeepMedicalCertificate(false);
                          setFormData(prev => ({ ...prev, medicalCertificate: '' }));
                          if (medicalCertificateInputRef.current) {
                            medicalCertificateInputRef.current.value = '';
                          }
                        }}
                        sx={{ mt: 1 }}
                      >
                        Удалить
                      </Button>
                    </Box>
                  ) : keepMedicalCertificate && editingClient ? (
                    <Box sx={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Файл загружен на сервер
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          try {
                            const { blob, filename } = await apiService.downloadClientCertificate(
                              editingClient.id,
                              'medical'
                            );
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch {
                            setSnackbarMessage('Не удалось скачать файл');
                            setSnackbarOpen(true);
                          }
                        }}
                        sx={{ mr: 1 }}
                      >
                        Скачать
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setKeepMedicalCertificate(false);
                          setFormData((prev) => ({ ...prev, medicalCertificate: '' }));
                        }}
                      >
                        Удалить
                      </Button>
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center' }}>
                      <PhotoCamera sx={{ fontSize: 32, color: 'text.secondary', mb: 0.5 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Загрузить файл
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        (изображение или PDF)
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<Assignment />}
                onClick={() => {
                  if (editingClient) {
                    // Обновляем данные паспорта из editingClient
                    const client = editingClient;
                    setPassportData({
                      passportSeries: client.passportSeries || '',
                      passportNumber: client.passportNumber || '',
                      passportIssueDate: client.passportIssueDate ? new Date(client.passportIssueDate).toISOString().split('T')[0] : '',
                      passportIssuedBy: client.passportIssuedBy || '',
                      passportDivisionCode: client.passportDivisionCode || '',
                      passportBirthPlace: client.passportBirthPlace || '',
                    });
                  } else {
                    setPassportData({
                      passportSeries: formData.passportSeries || '',
                      passportNumber: formData.passportNumber || '',
                      passportIssueDate: formData.passportIssueDate || '',
                      passportIssuedBy: formData.passportIssuedBy || '',
                      passportDivisionCode: formData.passportDivisionCode || '',
                      passportBirthPlace: formData.passportBirthPlace || '',
                    });
                  }
                  setPassportErrors({});
                  setPassportDialog(true);
                }}
                sx={{ height: '56px' }}
              >
                Паспорт спортсмена
              </Button>
            </Grid>
            
            {/* Родители */}
            <Grid item xs={12}>
              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'background.default' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Родители (необязательно)
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => {
                      setFormData({
                        ...formData,
                        parents: [
                          ...formData.parents,
                          {
                            fullName: '',
                            phone: '',
                            email: '',
                            workplace: '',
                            workplaceContact: '',
                          }
                        ]
                      });
                    }}
                  >
                    Добавить родителя
                  </Button>
                </Box>
                
                {formData.parents.map((parent, index) => {
                  // Получаем полную информацию о родителе из editingClient
                  const fullParentInfo = editingClient?.parents?.find((p: any) => 
                    p.fullName === parent.fullName || 
                    (p.phone && p.phone === parent.phone) ||
                    (p.email && p.email === parent.email)
                  );
                  
                  const hasPassword = fullParentInfo?.password;
                  const isAccountApproved = fullParentInfo?.isAccountApproved;
                  const needsApproval = hasPassword && !isAccountApproved;
                  
                  return (
                  <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2" fontWeight="medium">
                          Родитель {index + 1}
                        </Typography>
                        {hasPassword && (
                          <Chip
                            label={isAccountApproved ? 'Подтвержден' : 'Ожидает подтверждения'}
                            color={isAccountApproved ? 'success' : 'warning'}
                            size="small"
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {needsApproval && (user?.role === 'OWNER' || user?.role === 'ADMIN') && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<Check />}
                            onClick={async () => {
                              if (fullParentInfo?.id) {
                                try {
                                  await apiService.approveParentAccount(fullParentInfo.id);
                                  setSnackbarMessage('Регистрация родителя подтверждена');
                                  setSnackbarOpen(true);
                                  // Обновляем данные клиента
                                  if (editingClient) {
                                    const updatedClient = await apiService.getClient(editingClient.id);
                                    setEditingClient(updatedClient);
                                    setFormData({
                                      ...formData,
                                      parents: updatedClient.parents?.map((p: any) => ({
                                        fullName: p.fullName || '',
                                        phone: p.phone || '',
                                        email: p.email || '',
                                        workplace: p.workplace || '',
                                        workplaceContact: p.workplaceContact || '',
                                      })) || []
                                    });
                                  }
                                } catch (err: any) {
                                  setError(err.response?.data?.error || 'Ошибка подтверждения регистрации');
                                  setSnackbarMessage(err.response?.data?.error || 'Ошибка подтверждения регистрации');
                                  setSnackbarOpen(true);
                                }
                              }
                            }}
                          >
                            Подтвердить регистрацию
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              parents: formData.parents.filter((_, i) => i !== index)
                            });
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Полное ФИО родителя"
                          value={parent.fullName}
                          onChange={(e) => handleParentFieldChange(index, 'fullName', e.target.value)}
                          onBlur={(e) => handleParentFieldBlur(index, 'fullName', e.target.value)}
                          error={!!formErrors[`parent_${index}_fullName`]}
                          helperText={formErrors[`parent_${index}_fullName`]}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              '&.Mui-focused fieldset': {
                                borderColor: validFields.has(`parent_${index}_fullName`) && !formErrors[`parent_${index}_fullName`] ? 'success.main' : undefined,
                              },
                              '& fieldset': {
                                borderColor: validFields.has(`parent_${index}_fullName`) && !formErrors[`parent_${index}_fullName`] ? 'success.main' : undefined,
                              },
                            },
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Телефон"
                          value={parent.phone}
                          onChange={(e) => handleParentFieldChange(index, 'phone', e.target.value)}
                          onBlur={(e) => handleParentFieldBlur(index, 'phone', e.target.value)}
                          placeholder="+1234567890"
                          error={!!formErrors[`parent_${index}_phone`]}
                          helperText={formErrors[`parent_${index}_phone`]}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              '&.Mui-focused fieldset': {
                                borderColor: validFields.has(`parent_${index}_phone`) && !formErrors[`parent_${index}_phone`] ? 'success.main' : undefined,
                              },
                              '& fieldset': {
                                borderColor: validFields.has(`parent_${index}_phone`) && !formErrors[`parent_${index}_phone`] ? 'success.main' : undefined,
                              },
                            },
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Email"
                          type="email"
                          value={parent.email}
                          onChange={(e) => handleParentFieldChange(index, 'email', e.target.value)}
                          onBlur={(e) => handleParentFieldBlur(index, 'email', e.target.value)}
                          error={!!formErrors[`parent_${index}_email`]}
                          helperText={formErrors[`parent_${index}_email`]}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              '&.Mui-focused fieldset': {
                                borderColor: validFields.has(`parent_${index}_email`) && !formErrors[`parent_${index}_email`] ? 'success.main' : undefined,
                              },
                              '& fieldset': {
                                borderColor: validFields.has(`parent_${index}_email`) && !formErrors[`parent_${index}_email`] ? 'success.main' : undefined,
                              },
                            },
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Место работы"
                          value={parent.workplace}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].workplace = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Способ связи с местом работы"
                          value={parent.workplaceContact}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].workplaceContact = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
                          placeholder="Телефон, email и т.д."
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                  );
                })}
                
                {formData.parents.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Родители не добавлены. Нажмите "Добавить родителя" для добавления.
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              discardCreateForm();
              if (photoInputRef.current) {
                photoInputRef.current.value = '';
              }
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
              const validationErrors = validateClientForm(formData);
              setFormErrors(validationErrors);
              
              // Отмечаем все поля как touched для отображения ошибок
              const allFields = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'weight'];
              const newTouchedFields = new Set<string>();
              allFields.forEach(field => newTouchedFields.add(field));
              formData.parents.forEach((_, index) => {
                ['fullName', 'email', 'phone'].forEach(field => {
                  newTouchedFields.add(`parent_${index}_${field}`);
                });
              });
              setTouchedFields(newTouchedFields);
              
              // Если есть ошибки, показываем их и оставляем диалог открытым
              if (hasFormErrors(validationErrors)) {
                setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
                setSnackbarOpen(true);
                setValidFields(new Set());
                return; // Не создаем клиента, если есть ошибки
              }
              
              // Если нет ошибок, вызываем handleCreateClient для сохранения
              handleCreateClient();
            }} 
            variant="contained"
            type="button"
          >
            Создать клиента
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования клиента */}
      <Dialog
open={editDialogOpen}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            editUnsaved.requestClose(reason);
          }
        }}
        maxWidth="lg"
        fullWidth
        scroll="paper"
        disableEscapeKeyDown={hasFormErrors(formErrors) || hasFormErrors(currentErrorsRef.current) || shouldPreventCloseRef.current || isValidatingRef.current}
        PaperProps={{
          sx: {
            borderRadius: `${radii.panel}px`,
            maxHeight: '90vh',
          },
        }}
      >
        <DialogContent
          sx={{
            p: 2,
            overflow: 'auto',
          }}
        >
          {(user?.role === 'OWNER' || user?.role === 'ADMIN') && editingClient && (
            <Box
              sx={{
                mb: 2,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
                alignItems: 'stretch',
              }}
            >
              <Paper
                sx={{
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                  Личная скидка (ежемес.)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 110 }}>
                    <InputLabel>Тип</InputLabel>
                    <Select
                      label="Тип"
                      value={editingClient.personalDiscountType || ''}
                      onChange={(e) => {
                        const type = (e.target.value || null) as 'percent' | 'fixed' | null;
                        setEditingClient({
                          ...editingClient,
                          personalDiscountType: type,
                          personalDiscountValue: type
                            ? editingClient.personalDiscountValue ?? 0
                            : null,
                        });
                      }}
                    >
                      <MenuItem value="">Нет</MenuItem>
                      <MenuItem value="percent">%</MenuItem>
                      <MenuItem value="fixed">₽</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Значение"
                    type="number"
                    disabled={!editingClient.personalDiscountType}
                    value={
                      editingClient.personalDiscountValue != null
                        ? editingClient.personalDiscountValue
                        : ''
                    }
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      setEditingClient({
                        ...editingClient,
                        personalDiscountValue: v != null && Number.isFinite(v) ? v : null,
                      });
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          {editingClient.personalDiscountType === 'percent' ? '%' : '₽'}
                        </InputAdornment>
                      ),
                    }}
                    sx={{ width: 140 }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    onClick={async () => {
                      try {
                        const type = editingClient.personalDiscountType || null;
                        const updated = await apiService.updateClient(editingClient.id, {
                          personalDiscountType: type,
                          personalDiscountValue: type ? editingClient.personalDiscountValue ?? 0 : null,
                        });
                        setEditingClient({ ...editingClient, ...updated });
                        await fetchClients();
                      } catch (err: any) {
                        setError(err.response?.data?.error || 'Не удалось сохранить скидку');
                      }
                    }}
                  >
                    Сохранить
                  </Button>
                </Box>
              </Paper>
              <Paper
                sx={{
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Payment color={editingClient.membershipFeePaid ? 'success' : 'disabled'} />
                    <Typography variant="body2" fontWeight="medium">Членский взнос</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={editingClient.membershipFeePaid ? 'Оплачен' : 'Не оплачен'}
                      color={editingClient.membershipFeePaid ? 'success' : 'default'}
                      size="small"
                    />
                    <Button
                      variant={editingClient.membershipFeePaid ? 'outlined' : 'contained'}
                      color={editingClient.membershipFeePaid ? 'error' : 'success'}
                      size="small"
                      onClick={async () => {
                        if (!editingClient) return;
                        try {
                          const updated = await apiService.updateClientMembershipFeeStatus(
                            editingClient.id,
                            !editingClient.membershipFeePaid
                          );
                          setEditingClient({ ...editingClient, ...updated });
                          await fetchClients();
                        } catch (err: any) {
                          setError(err.response?.data?.error || 'Не удалось обновить статус взноса');
                        }
                      }}
                    >
                      {editingClient.membershipFeePaid ? 'Снять отметку' : 'Отметить оплату'}
                    </Button>
                  </Box>
                </Box>
              </Paper>
            </Box>
          )}
          {editingClient && (
            <Box sx={{ mt: 2, mb: 1 }}>
              <AttendanceExcelExport
                scope="client"
                entityId={editingClient.id}
                entityName={[editingClient.lastName, editingClient.firstName, editingClient.middleName]
                  .filter(Boolean)
                  .join(' ')}
              />
            </Box>
          )}
          {editingClient && (
            <AthleteCard
              mode="staff"
              clientId={editingClient.id}
              onSaved={async () => {
                await fetchClients();
                try {
                  const refreshed = await apiService.getClient(editingClient.id);
                  setEditingClient(refreshed);
                } catch (_) {}
              }}
              onClose={() => {
                discardEditForm();
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('clientId');
                  return next;
                });
              }}
            />
          )}
          {(user?.role === 'OWNER' || user?.role === 'ADMIN') && editingClient && (
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                color="error"
                variant="outlined"
                fullWidth
                onClick={() => handleDeleteClient(editingClient.id)}
              >
                Удалить клиента
              </Button>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialog} onClose={() => {
        if (!importing) {
          setImportDialog(false);
          setImportFile(null);
          setImportResult(null);
          setIsDragOver(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      }} maxWidth="md" fullWidth>
        <DialogTitle>Импорт клиентов из Excel</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {importResult && (
            <Alert 
              severity={importResult.errors && importResult.errors.length > 0 ? 'warning' : 'success'} 
              sx={{ mb: 2 }}
            >
              <Typography variant="body1" fontWeight="bold">
                Импортировано: {importResult.success} из {importResult.total}
              </Typography>
              {importResult.errors && importResult.errors.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    Ошибки ({importResult.errors.length}):
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {importResult.errors.map((err: any, index: number) => (
                      <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                        Строка {err.row}: {err.error}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Alert>
          )}

          {/* Инструкция по импорту */}
          <Alert 
            icon={<Info />} 
            severity="info" 
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Инструкция по заполнению файла:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Обязательные поля:</strong> Имя, Фамилия
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Дата рождения:</strong> формат ДД.ММ.ГГГГ (например: 01.01.2010)
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Пол:</strong> "Мужской", "Женский" или "Другой"
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Родители:</strong> можно указать до 2 родителей, все поля опциональны
              </Typography>
              <Typography component="li" variant="body2">
                <strong>Что не указывать:</strong> Дата создания (заполняется автоматически)
              </Typography>
            </Box>
          </Alert>

          {/* Кнопка скачивания шаблона */}
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              fullWidth
              onClick={handleDownloadTemplate}
              sx={{ textTransform: 'none' }}
            >
              Скачать шаблон Excel
            </Button>
          </Box>

          {/* Drag and Drop область */}
          <Box sx={{ mt: 2 }}>
              <input
              ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImportFile(file);
                    setImportResult(null);
                  setError('');
                  }
                }}
                style={{ display: 'none' }}
              />
            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                border: `2px dashed ${isDragOver ? 'primary.main' : 'grey.300'}`,
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                backgroundColor: isDragOver ? 'action.hover' : 'background.paper',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                mb: 2,
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover'
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {importFile ? (
                <Box>
                  <FileUpload sx={{ fontSize: 36, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    {importFile.name}
                  </Typography>
            <Typography variant="body2" color="text.secondary">
                    Нажмите для выбора другого файла
            </Typography>
                </Box>
              ) : (
                <Box>
                  <FileUpload sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    Перетащите файл сюда
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    или нажмите для выбора файла
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Поддерживаются только файлы Excel (.xlsx, .xls)
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              if (!importing) {
                setImportDialog(false);
                setImportFile(null);
                setImportResult(null);
                setIsDragOver(false);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }
            }}
            disabled={importing}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleImportClients} 
            variant="contained"
            disabled={!importFile || importing}
          >
            {importing ? 'Импорт...' : 'Импортировать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог статистики посещаемости */}
      <Dialog open={statsDialog} onClose={() => setStatsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Статистика посещаемости: {selectedClientForStats ? [selectedClientForStats.lastName, selectedClientForStats.firstName, selectedClientForStats.middleName].filter(Boolean).join(' ') : ''}
        </DialogTitle>
        <DialogContent>
          {loadingStats ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : clientStats ? (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h5" color="primary" fontWeight="bold">
                    {clientStats.totalTrainings || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Всего тренировок
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h5" color="success.main" fontWeight="bold">
                    {clientStats.presentCount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Присутствовал
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h5" color="info.main" fontWeight="bold">
                    {clientStats.attendanceRate?.toFixed(1) || 0}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Процент посещаемости
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h5" color="warning.main" fontWeight="bold">
                    {clientStats.achievementsCount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Достижений
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Нет данных для отображения
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setStatsDialog(false);
            setSelectedClientForStats(null);
            setClientStats(null);
          }}>Закрыть</Button>
        </DialogActions>
      </Dialog>


      <UnsavedChangesDialog
        open={createUnsaved.confirmOpen}
        saving={createUnsaved.saving}
        onSave={createUnsaved.save}
        onDiscard={createUnsaved.discard}
        onStay={createUnsaved.stay}
      />
      <UnsavedChangesDialog
        open={editUnsaved.confirmOpen}
        saving={editUnsaved.saving}
        onSave={editUnsaved.save}
        onDiscard={editUnsaved.discard}
        onStay={editUnsaved.stay}
      />

      <ClientGroupsDialog
        open={groupsDialog}
        client={selectedClientForGroups}
        groups={groups}
        onClose={() => {
          setGroupsDialog(false);
          setSelectedClientForGroups(null);
        }}
        onChanged={async (updated) => {
          setSelectedClientForGroups(updated);
          await fetchClients();
        }}
        onError={(message) => setError(message)}
        onSuccessMessage={(message) => {
          setSnackbarMessage(message);
          setSnackbarOpen(true);
        }}
      />

      {/* Выдача / смена абонемента */}
      <Dialog
        open={membershipDialog}
        onClose={() => {
          setMembershipDialog(false);
          setSelectedClientForMembership(null);
          setSelectedMembershipId('');
          setRemainingVisitsInput('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Абонемент:{' '}
          {selectedClientForMembership
            ? [selectedClientForMembership.lastName, selectedClientForMembership.firstName]
                .filter(Boolean)
                .join(' ')
            : ''}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {selectedClientForMembership?.activeMembership ? (
              <Alert
                severity={
                  (selectedClientForMembership.activeMembership.remaining ?? 0) < 0
                    ? 'warning'
                    : 'info'
                }
              >
                Сейчас:{' '}
                <strong>{selectedClientForMembership.activeMembership.name}</strong>
                {selectedClientForMembership.activeMembership.remaining != null && (
                  <>
                    {' '}
                    — осталось{' '}
                    <strong>{selectedClientForMembership.activeMembership.remaining}</strong>{' '}
                    пос.
                  </>
                )}
                {(selectedClientForMembership.activeMembership.remaining ?? 0) < 0 && (
                  <> Долг будет вычтен из нового абонемента.</>
                )}
              </Alert>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Активного абонемента нет. Выберите тариф из каталога.
              </Typography>
            )}

            <Alert severity="warning">
              Выдача абонемента отменяет незакрытые ежемесячные платежи группы. Пока действует
              абонемент (или долг по нему), ежемесячная оплата группы начисляться не будет.
            </Alert>

            {selectedClientForMembership?.activeMembership?.visitsTotal != null && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  label="Осталось посещений"
                  type="number"
                  value={remainingVisitsInput}
                  onChange={(e) => setRemainingVisitsInput(e.target.value)}
                  helperText="Можно уменьшить вручную; отрицательное значение — долг"
                  fullWidth
                  inputProps={{ step: 1 }}
                />
                <Button
                  variant="outlined"
                  disabled={savingRemaining || remainingVisitsInput === ''}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', mt: 0.5 }}
                  onClick={async () => {
                    const cm = selectedClientForMembership?.activeMembership;
                    if (!cm) return;
                    const remaining = Number(remainingVisitsInput);
                    if (!Number.isFinite(remaining)) {
                      setSnackbarMessage('Введите число');
                      setSnackbarOpen(true);
                      return;
                    }
                    try {
                      setSavingRemaining(true);
                      await apiService.updateClientMembership(cm.id, { remaining });
                      setSnackbarMessage('Остаток обновлён');
                      setSnackbarOpen(true);
                      await fetchClients();
                      const refreshed = (await apiService.getClient(selectedClientForMembership.id)) as Client;
                      setSelectedClientForMembership(refreshed);
                      setRemainingVisitsInput(
                        refreshed.activeMembership?.remaining != null
                          ? String(refreshed.activeMembership.remaining)
                          : String(remaining)
                      );
                    } catch (err: any) {
                      setSnackbarMessage(err?.response?.data?.error || 'Не удалось обновить остаток');
                      setSnackbarOpen(true);
                    } finally {
                      setSavingRemaining(false);
                    }
                  }}
                >
                  {savingRemaining ? '…' : 'Сохранить'}
                </Button>
              </Box>
            )}

            <FormControl fullWidth>
              <InputLabel>Выдать другой тариф</InputLabel>
              <Select
                label="Выдать другой тариф"
                value={selectedMembershipId}
                onChange={(e) => setSelectedMembershipId(String(e.target.value))}
              >
                {catalogMemberships.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}
                    {m.visits != null ? ` (${m.visits} пос.)` : ''}
                    {m.price != null ? ` — ${Number(m.price).toLocaleString('ru-RU')} ₽` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setMembershipDialog(false);
              setSelectedClientForMembership(null);
              setRemainingVisitsInput('');
            }}
          >
            Закрыть
          </Button>
          <Button
            variant="contained"
            disabled={!selectedMembershipId || !selectedClientForMembership || issuingMembership}
            onClick={async () => {
              if (!selectedClientForMembership || !selectedMembershipId) return;
              try {
                setIssuingMembership(true);
                await apiService.createClientMembership({
                  clientId: selectedClientForMembership.id,
                  membershipId: selectedMembershipId,
                });
                setSnackbarMessage('Абонемент выдан');
                setSnackbarOpen(true);
                setMembershipDialog(false);
                setSelectedClientForMembership(null);
                setRemainingVisitsInput('');
                await fetchClients();
              } catch (err: any) {
                setSnackbarMessage(err?.response?.data?.error || 'Не удалось выдать абонемент');
                setSnackbarOpen(true);
              } finally {
                setIssuingMembership(false);
              }
            }}
          >
            {issuingMembership ? 'Выдача…' : 'Выдать новый'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог личного календаря клиента */}
      <Dialog 
        open={clientCalendarDialog} 
        onClose={() => {
          setClientCalendarDialog(false);
          setSelectedClientForCalendar(null);
          setClientTrainings([]);
          setClientCompetitions([]);
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          Личный календарь: {selectedClientForCalendar ? [selectedClientForCalendar.lastName, selectedClientForCalendar.firstName, selectedClientForCalendar.middleName].filter(Boolean).join(' ') : ''}
        </DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
            {loadingClientCalendar ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ mt: 2 }}>
                {/* Навигация по неделям */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Button
                    onClick={() => setClientCalendarDate(new Date(clientCalendarDate.getTime() - 7 * 24 * 60 * 60 * 1000))}
                  >
                    Предыдущая неделя
                  </Button>
                  <Typography variant="h6">
                    {format(startOfWeek(clientCalendarDate, { weekStartsOn: 1 }), 'MMM d', { locale: ru })} - {format(endOfWeek(clientCalendarDate, { weekStartsOn: 1 }), 'MMM d, yyyy', { locale: ru })}
                  </Typography>
                  <Button
                    onClick={() => setClientCalendarDate(new Date(clientCalendarDate.getTime() + 7 * 24 * 60 * 60 * 1000))}
                  >
                    Следующая неделя
                  </Button>
                </Box>

                {/* Календарная сетка */}
                <Grid container spacing={1}>
                  {eachDayOfInterval({ 
                    start: startOfWeek(clientCalendarDate, { weekStartsOn: 1 }), 
                    end: endOfWeek(clientCalendarDate, { weekStartsOn: 1 }) 
                  }).map((day, index) => {
                    const dayTrainings = clientTrainings.filter((t: any) => {
                      const trainingDate = new Date(t.startTime);
                      return isSameDay(trainingDate, day);
                    });
                    const dayCompetitions = clientCompetitions.filter((c: any) => {
                      const competitionDate = new Date(c.date);
                      return isSameDay(competitionDate, day);
                    });
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <Grid item xs={12} sm={6} md={12/7} key={index}>
                        <Card 
                          sx={{ 
                            height: '100%', 
                            minHeight: 200,
                            border: isToday ? '2px solid' : '1px solid',
                            borderColor: isToday ? 'primary.main' : 'divider'
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
                              {/* Соревнования */}
                              {dayCompetitions.map((competition: any) => (
                                <ListItem key={competition.id} sx={{ p: 0, mb: 0.5 }}>
                                  <Paper 
                                    sx={{ 
                                      p: 0.5, 
                                      width: '100%',
                                      bgcolor: 'warning.light',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.5
                                    }}
                                  >
                                    <EmojiEvents sx={{ fontSize: 14 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
                                        {competition.name || 'Соревнование'}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {format(new Date(competition.date), 'HH:mm', { locale: ru })}
                                      </Typography>
                                    </Box>
                                  </Paper>
                                </ListItem>
                              ))}
                              
                              {/* Тренировки */}
                              {dayTrainings.map((training: any) => (
                                <ListItem key={training.id} sx={{ p: 0, mb: 0.5 }}>
                                  <Paper 
                                    sx={{ 
                                      p: 0.5, 
                                      width: '100%',
                                      bgcolor: 'primary.light',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.5
                                    }}
                                  >
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
                                        {training.title || training.group?.name || 'Тренировка'}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {format(new Date(training.startTime), 'HH:mm', { locale: ru })} - {format(new Date(training.endTime), 'HH:mm', { locale: ru })}
                                      </Typography>
                                      {training.group?.name && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                          {training.group.name}
                                        </Typography>
                                      )}
                                    </Box>
                                  </Paper>
                                </ListItem>
                              ))}
                              
                              {dayTrainings.length === 0 && dayCompetitions.length === 0 && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 1 }}>
                                  Нет событий
                                </Typography>
                              )}
                            </List>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setClientCalendarDialog(false);
            setSelectedClientForCalendar(null);
            setClientTrainings([]);
            setClientCompetitions([]);
          }}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог паспорта спортсмена */}
      <Dialog
        open={passportDialog}
        onClose={() => setPassportDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Паспорт спортсмена</DialogTitle>
        <DialogContent>
          {hasPassportErrors(passportErrors) && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Пожалуйста, исправьте {Object.keys(passportErrors).length} {Object.keys(passportErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Серия паспорта"
                value={passportData.passportSeries}
                onChange={(e) => {
                  setPassportData({ ...passportData, passportSeries: e.target.value });
                  if (passportErrors.passportSeries) {
                    setPassportErrors({ ...passportErrors, passportSeries: '' });
                  }
                }}
                inputProps={{ maxLength: 4 }}
                placeholder="1234"
                error={!!passportErrors.passportSeries}
                helperText={passportErrors.passportSeries || '4 цифры'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Номер паспорта"
                value={passportData.passportNumber}
                onChange={(e) => {
                  setPassportData({ ...passportData, passportNumber: e.target.value });
                  if (passportErrors.passportNumber) {
                    setPassportErrors({ ...passportErrors, passportNumber: '' });
                  }
                }}
                inputProps={{ maxLength: 6 }}
                placeholder="123456"
                error={!!passportErrors.passportNumber}
                helperText={passportErrors.passportNumber || '6 цифр'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Дата выдачи"
                type="date"
                value={passportData.passportIssueDate}
                onChange={(e) => {
                  setPassportData({ ...passportData, passportIssueDate: e.target.value });
                  if (passportErrors.passportIssueDate) {
                    setPassportErrors({ ...passportErrors, passportIssueDate: '' });
                  }
                }}
                InputLabelProps={{ shrink: true }}
                error={!!passportErrors.passportIssueDate}
                helperText={passportErrors.passportIssueDate}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Код подразделения"
                value={passportData.passportDivisionCode}
                onChange={(e) => {
                  // Удаляем все нецифровые символы
                  let value = e.target.value.replace(/\D/g, '');
                  
                  // Ограничиваем до 6 цифр
                  if (value.length > 6) {
                    value = value.substring(0, 6);
                  }
                  
                  // Добавляем тире после третьей цифры
                  if (value.length > 3) {
                    value = value.substring(0, 3) + '-' + value.substring(3);
                  }
                  
                  setPassportData({ ...passportData, passportDivisionCode: value });
                  if (passportErrors.passportDivisionCode) {
                    setPassportErrors({ ...passportErrors, passportDivisionCode: '' });
                  }
                }}
                inputProps={{ maxLength: 7 }}
                placeholder="123-456"
                error={!!passportErrors.passportDivisionCode}
                helperText={passportErrors.passportDivisionCode || '6 цифр (формат: 123-456)'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Кем выдан"
                value={passportData.passportIssuedBy}
                onChange={(e) => {
                  setPassportData({ ...passportData, passportIssuedBy: e.target.value });
                  if (passportErrors.passportIssuedBy) {
                    setPassportErrors({ ...passportErrors, passportIssuedBy: '' });
                  }
                }}
                multiline
                rows={2}
                error={!!passportErrors.passportIssuedBy}
                helperText={passportErrors.passportIssuedBy}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Место рождения"
                value={passportData.passportBirthPlace}
                onChange={(e) => {
                  setPassportData({ ...passportData, passportBirthPlace: e.target.value });
                  if (passportErrors.passportBirthPlace) {
                    setPassportErrors({ ...passportErrors, passportBirthPlace: '' });
                  }
                }}
                multiline
                rows={2}
                error={!!passportErrors.passportBirthPlace}
                helperText={passportErrors.passportBirthPlace}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPassportDialog(false);
            setPassportErrors({});
          }}>Отмена</Button>
          <Button
            variant="contained"
            onClick={async () => {
              // Выполняем валидацию
              const validationErrors = validatePassport(passportData);
              setPassportErrors(validationErrors);

              // Если есть ошибки, не сохраняем
              if (hasPassportErrors(validationErrors)) {
                setSnackbarMessage('Пожалуйста, исправьте ошибки в форме паспорта');
                setSnackbarOpen(true);
                return;
              }

              if (editingClient) {
                // Редактирование существующего клиента
                try {
                  await apiService.updateClient(editingClient.id, {
                    passportSeries: passportData.passportSeries && passportData.passportSeries.trim() !== '' ? passportData.passportSeries : null,
                    passportNumber: passportData.passportNumber && passportData.passportNumber.trim() !== '' ? passportData.passportNumber : null,
                    passportIssueDate: passportData.passportIssueDate && passportData.passportIssueDate.trim() !== '' ? passportData.passportIssueDate : null,
                    passportIssuedBy: passportData.passportIssuedBy && passportData.passportIssuedBy.trim() !== '' ? passportData.passportIssuedBy : null,
                    passportDivisionCode: passportData.passportDivisionCode && passportData.passportDivisionCode.trim() !== '' ? passportData.passportDivisionCode : null,
                    passportBirthPlace: passportData.passportBirthPlace && passportData.passportBirthPlace.trim() !== '' ? passportData.passportBirthPlace : null,
                  });
                  await fetchClients();
                  // Загружаем обновленные данные клиента
                  const refreshedClient = await apiService.getClient(editingClient.id);
                  setEditingClient(refreshedClient);
                  setPassportDialog(false);
                  setPassportErrors({});
                  setSnackbarMessage('Данные паспорта сохранены');
                  setSnackbarOpen(true);
                } catch (err: any) {
                  setError(err?.response?.data?.error || 'Не удалось сохранить данные паспорта');
                  setSnackbarMessage(err?.response?.data?.error || 'Не удалось сохранить данные паспорта');
                  setSnackbarOpen(true);
                }
              } else {
                // Создание нового клиента - сохраняем в formData
                setFormData({
                  ...formData,
                  passportSeries: passportData.passportSeries || '',
                  passportNumber: passportData.passportNumber || '',
                  passportIssueDate: passportData.passportIssueDate || '',
                  passportIssuedBy: passportData.passportIssuedBy || '',
                  passportDivisionCode: passportData.passportDivisionCode || '',
                  passportBirthPlace: passportData.passportBirthPlace || '',
                });
                setPassportDialog(false);
                setPassportErrors({});
                setSnackbarMessage('Данные паспорта добавлены в форму');
                setSnackbarOpen(true);
              }
            }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar для показа сообщений о валидации */}
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

export default Clients;
