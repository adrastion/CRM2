import fs from 'fs';
import path from 'path';

const clientsPath = path.join('client', 'src', 'pages', 'Clients.tsx');
const outPath = path.join('client', 'src', 'components', 'client', 'CreateClientDialog.tsx');
const lines = fs.readFileSync(clientsPath, 'utf8').split(/\r?\n/);

// Dialog JSX: lines 1601-2583 (0-indexed 1600-2582)
let dialogInner = lines.slice(1600, 2583).join('\n');
// Remove leading 6 spaces from dialog block (was nested in return)
dialogInner = dialogInner.replace(/^      /gm, '');

// Simplify create-only sections
dialogInner = dialogInner.replace(/keepBirthCertificate && editingClient \?[\s\S]*?\) : \(/g, '(');
dialogInner = dialogInner.replace(/keepMedicalCertificate && editingClient \?[\s\S]*?\) : \(/g, '(');
dialogInner = dialogInner.replace(
  /if \(editingClient\) \{[\s\S]*?\} else \{\s*setPassportData\(\{/,
  'setPassportData({'
);
dialogInner = dialogInner.replace(/\}\);\s*\}\s*setPassportErrors/g, '}); setPassportErrors');
// Parent section: remove editingClient approval block - simplify map callback
dialogInner = dialogInner.replace(
  /\{formData\.parents\.map\(\(parent, index\) => \{[\s\S]*?return \(\s*<Paper key=\{index\}/,
  `{formData.parents.map((parent, index) => (
                  <Paper key={index}`
);
dialogInner = dialogInner.replace(
  /<Box sx=\{\{ display: 'flex', justifyContent: 'space-between'[\s\S]*?<IconButton[\s\S]*?<\/IconButton>\s*<\/Box>\s*<\/Box>/,
  `<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight="medium">
                        Родитель {index + 1}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            parents: formData.parents.filter((_, i) => i !== index),
                          });
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </Box>`
);

const header = `import React, { useCallback, useEffect, useRef, useState } from 'react';
import UnsavedChangesDialog from '../common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../../hooks/useUnsavedClose';
import {
  validateClientForm,
  validateField,
  hasFormErrors,
  ClientFormData,
  ValidationErrors,
} from '../../utils/clientValidation';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Assignment, Delete, PhotoCamera } from '@mui/icons-material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { Client } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { isPromoter as roleIsPromoter } from '../../utils/roles';

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
  athleteStatus: 'active',
  groupIds: [],
  parents: [],
};

type PassportData = {
  passportSeries: string;
  passportNumber: string;
  passportIssueDate: string;
  passportIssuedBy: string;
  passportDivisionCode: string;
  passportBirthPlace: string;
};

const validatePassport = (data: PassportData): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (data.passportSeries && data.passportSeries.trim() !== '') {
    if (!/^\\d{4}$/.test(data.passportSeries)) {
      errors.passportSeries = 'Серия паспорта должна содержать 4 цифры';
    }
  }
  if (data.passportNumber && data.passportNumber.trim() !== '') {
    if (!/^\\d{6}$/.test(data.passportNumber)) {
      errors.passportNumber = 'Номер паспорта должен содержать 6 цифр';
    }
  }
  if (data.passportDivisionCode && data.passportDivisionCode.trim() !== '') {
    const cleanedCode = data.passportDivisionCode.replace(/-/g, '');
    if (!/^\\d{6}$/.test(cleanedCode)) {
      errors.passportDivisionCode = 'Код подразделения должен содержать 6 цифр (формат: 123-456)';
    }
  }
  if (data.passportIssueDate && data.passportIssueDate.trim() !== '') {
    const issueDate = new Date(data.passportIssueDate);
    const today = new Date();
    if (issueDate > today) {
      errors.passportIssueDate = 'Дата выдачи не может быть в будущем';
    }
  }
  if (data.passportIssuedBy && data.passportIssuedBy.trim() !== '') {
    if (data.passportIssuedBy.trim().length < 3) {
      errors.passportIssuedBy = 'Поле должно содержать минимум 3 символа';
    }
  }
  if (data.passportBirthPlace && data.passportBirthPlace.trim() !== '') {
    if (data.passportBirthPlace.trim().length < 3) {
      errors.passportBirthPlace = 'Поле должно содержать минимум 3 символа';
    }
  }
  return errors;
};

const hasPassportErrors = (errors: Record<string, string>): boolean => Object.keys(errors).length > 0;

export type CreateClientDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (client?: Client) => void;
};

const CreateClientDialog: React.FC<CreateClientDialogProps> = ({ open, onClose, onSuccess }) => {
  const { user } = useAuth();
  const isPromoter = roleIsPromoter(user?.role);

  const [formData, setFormData] = useState<ClientFormData>({ ...EMPTY_CLIENT_FORM });
  const [formBaseline, setFormBaseline] = useState<ClientFormData>({ ...EMPTY_CLIENT_FORM });
  const [formErrors, setFormErrors] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [validFields, setValidFields] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [groups, setGroups] = useState<any[]>([]);
  const [createBillingEffectiveFrom, setCreateBillingEffectiveFrom] = useState(() => {
    const d = new Date();
    return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-01\`;
  });
  const [trialEnabled, setTrialEnabled] = useState(false);
  const [trialTrainingId, setTrialTrainingId] = useState('');
  const [upcomingTrialTrainings, setUpcomingTrialTrainings] = useState<any[]>([]);
  const [loadingTrialTrainings, setLoadingTrialTrainings] = useState(false);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [birthCertificatePreview, setBirthCertificatePreview] = useState<string | null>(null);
  const birthCertificateInputRef = useRef<HTMLInputElement>(null);
  const [medicalCertificatePreview, setMedicalCertificatePreview] = useState<string | null>(null);
  const medicalCertificateInputRef = useRef<HTMLInputElement>(null);

  const [passportDialog, setPassportDialog] = useState(false);
  const [passportData, setPassportData] = useState<PassportData>({
    passportSeries: '',
    passportNumber: '',
    passportIssueDate: '',
    passportIssuedBy: '',
    passportDivisionCode: '',
    passportBirthPlace: '',
  });
  const [passportErrors, setPassportErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setFormData({ ...EMPTY_CLIENT_FORM });
    setFormBaseline({ ...EMPTY_CLIENT_FORM });
    setFormErrors({});
    setTouchedFields(new Set());
    setValidFields(new Set());
    setError('');
    setTrialEnabled(false);
    setTrialTrainingId('');
    setUpcomingTrialTrainings([]);
    setPhotoPreview(null);
    setBirthCertificatePreview(null);
    setMedicalCertificatePreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (birthCertificateInputRef.current) birthCertificateInputRef.current.value = '';
    if (medicalCertificateInputRef.current) medicalCertificateInputRef.current.value = '';
    const d = new Date();
    setCreateBillingEffectiveFrom(\`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-01\`);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForm();
    if (isPromoter) return;
    let cancelled = false;
    (async () => {
      try {
        const groupsRes = await apiService.getGroups({ limit: 1000, page: 1 }).catch(() => ({ data: [] }));
        if (!cancelled) setGroups(groupsRes.data || []);
      } catch (err) {
        console.error('Failed to load groups for create client:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isPromoter, resetForm]);

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
      if (groupId) list = list.filter((t: any) => t.groupId === groupId);
      setUpcomingTrialTrainings(list);
    } catch (err) {
      console.error('Failed to load trainings for trial:', err);
      setUpcomingTrialTrainings([]);
    } finally {
      setLoadingTrialTrainings(false);
    }
  };

  const validateFieldValue = (fieldName: string, value: any, parentIndex?: number) => {
    const fieldError = validateField(fieldName, value, formData, parentIndex);
    setFormErrors((prev) => {
      const newErrors = { ...prev };
      const errorKey =
        parentIndex !== undefined ? \`parent_\${parentIndex}_\${fieldName.replace('parent_', '')}\` : fieldName;
      if (fieldError) newErrors[errorKey] = fieldError;
      else delete newErrors[errorKey];
      return newErrors;
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touchedFields.has(field)) validateFieldValue(field, value);
    if (error) setError('');
  };

  const handleParentFieldChange = (index: number, field: string, value: string) => {
    const newParents = [...formData.parents];
    newParents[index] = { ...newParents[index], [field]: value };
    setFormData((prev) => ({ ...prev, parents: newParents }));
    const errorKey = \`parent_\${index}_\${field}\`;
    if (touchedFields.has(errorKey)) {
      const fieldName =
        field === 'fullName' ? 'parent_fullName' : field === 'email' ? 'parent_email' : field === 'phone' ? 'parent_phone' : field;
      validateFieldValue(fieldName, value, index);
    }
  };

  const handleParentFieldBlur = (index: number, field: string, value: string) => {
    const errorKey = \`parent_\${index}_\${field}\`;
    setTouchedFields((prev) => new Set(prev).add(errorKey));
    const fieldName =
      field === 'fullName' ? 'parent_fullName' : field === 'email' ? 'parent_email' : field === 'phone' ? 'parent_phone' : field;
    validateFieldValue(fieldName, value, index);
  };

  const handleCreateClient = async (): Promise<boolean> => {
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
      const dataToSend: any = isPromoter
        ? {
            firstName: clientData.firstName,
            lastName: clientData.lastName,
            gender: clientData.gender || null,
            dateOfBirth: clientData.dateOfBirth || null,
            phone: clientData.phone || null,
          }
        : {
            ...clientData,
            weight: clientData.weight ? parseFloat(clientData.weight) : null,
            passportSeries: clientData.passportSeries?.trim() ? clientData.passportSeries : null,
            passportNumber: clientData.passportNumber?.trim() ? clientData.passportNumber : null,
            passportIssueDate: clientData.passportIssueDate?.trim() ? clientData.passportIssueDate : null,
            passportIssuedBy: clientData.passportIssuedBy?.trim() ? clientData.passportIssuedBy : null,
            passportDivisionCode: clientData.passportDivisionCode?.trim() ? clientData.passportDivisionCode : null,
            passportBirthPlace: clientData.passportBirthPlace?.trim() ? clientData.passportBirthPlace : null,
          };
      if (!isPromoter) {
        if (!dataToSend.birthCertificate) delete dataToSend.birthCertificate;
        if (!dataToSend.medicalCertificate) delete dataToSend.medicalCertificate;
      }
      const createdClient = await apiService.createClient(dataToSend);
      let trialGroupId: string | null = null;
      if (!isPromoter && trialEnabled && trialTrainingId && createdClient?.id) {
        try {
          const membership = await apiService.assignClientTrial(createdClient.id, trialTrainingId);
          trialGroupId = membership?.groupId || membership?.group?.id || null;
        } catch (err: any) {
          console.error('Error assigning trial:', err);
          setSnackbarMessage(err?.response?.data?.error || 'Клиент создан, но не удалось записать на пробное занятие');
          setSnackbarOpen(true);
        }
      }
      if (!isPromoter && groupIds?.length && createdClient?.id) {
        for (const groupId of groupIds) {
          if (trialGroupId && groupId === trialGroupId) continue;
          try {
            const group = groups.find((g) => g.id === groupId);
            const needsBillingDate =
              Boolean(group?.isMonthlyPayment) ||
              Boolean(
                (group as any)?.membershipPlans?.some(
                  (p: any) => p.membership?.category === 'GROUP' && p.membership?.isActive !== false
                )
              );
            await apiService.addClientToGroup(groupId, createdClient.id, needsBillingDate ? createBillingEffectiveFrom : undefined);
          } catch (err: any) {
            console.error(\`Error adding client to group \${groupId}:\`, err);
          }
        }
      }
      resetForm();
      onClose();
      await onSuccess?.(createdClient);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания клиента');
      console.error('Error creating client:', err);
      return false;
    }
  };

  const discardForm = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const isDirty = open && isDirtyValue(formData, formBaseline);
  const unsaved = useUnsavedClose({
    isDirty: Boolean(isDirty),
    onDiscard: discardForm,
    onSave: () => handleCreateClient(),
  });

  const submitCreate = () => {
    const validationErrors = validateClientForm(formData);
    setFormErrors(validationErrors);
    const newTouchedFields = new Set<string>();
    ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'weight'].forEach((field) => newTouchedFields.add(field));
    formData.parents.forEach((_, index) => {
      ['fullName', 'email', 'phone'].forEach((field) => newTouchedFields.add(\`parent_\${index}_\${field}\`));
    });
    setTouchedFields(newTouchedFields);
    if (hasFormErrors(validationErrors)) {
      setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
      setSnackbarOpen(true);
      setValidFields(new Set());
      return;
    }
    handleCreateClient();
  };

  return (
    <>
`;

const passportDialog = lines.slice(3397, 3593).join('\n').replace(/^      /gm, '');
const passportSimplified = passportDialog
  .replace(/if \(editingClient\) \{[\s\S]*?\} else \{\s*\/\/ Создание нового клиента[\s\S]*?setSnackbarMessage\('Данные паспорта добавлены в форму'\);[\s\S]*?setSnackbarOpen\(true\);\s*\}/,
    `setFormData((prev) => ({
                  ...prev,
                  passportSeries: passportData.passportSeries || '',
                  passportNumber: passportData.passportNumber || '',
                  passportIssueDate: passportData.passportIssueDate || '',
                  passportIssuedBy: passportData.passportIssuedBy || '',
                  passportDivisionCode: passportData.passportDivisionCode || '',
                  passportBirthPlace: passportData.passportBirthPlace || '',
                }));
                setPassportDialog(false);
                setPassportErrors({});
                setSnackbarMessage('Данные паспорта добавлены в форму');
                setSnackbarOpen(true);`);

const footer = `
      <UnsavedChangesDialog
        open={unsaved.confirmOpen}
        saving={unsaved.saving}
        onSave={unsaved.save}
        onDiscard={unsaved.discard}
        onStay={unsaved.stay}
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};

export default CreateClientDialog;
`;

// Fix dialog refs in extracted block
dialogInner = dialogInner
  .replace(/open=\{openDialog\}/g, 'open={open}')
  .replace(/createUnsaved\.requestClose/g, 'unsaved.requestClose')
  .replace(/discardCreateForm\(\)/g, 'discardForm()')
  .replace(/handleCreateClient\(\)/g, 'submitCreate()');

const full = header + dialogInner + '\n' + passportSimplified + footer;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, full, 'utf8');
console.log('Wrote', outPath, 'bytes', full.length);
