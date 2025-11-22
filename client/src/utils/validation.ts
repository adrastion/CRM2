/**
 * Validation utilities for form fields
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate email format
 */
export const validateEmail = (email: string): string | null => {
  if (!email || email.trim() === '') {
    return 'Email обязателен для заполнения';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return 'Введите корректный адрес электронной почты';
  }
  return null;
};

/**
 * Validate phone number
 */
export const validatePhone = (phone: string, required: boolean = false): string | null => {
  if (!phone || phone.trim() === '') {
    if (required) {
      return 'Телефон обязателен для заполнения';
    }
    return null; // Phone is optional
  }
  const cleanedPhone = phone.replace(/\s/g, '');
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(cleanedPhone)) {
    return 'Введите корректный номер телефона (например: +79991234567)';
  }
  return null;
};

/**
 * Validate required text field
 */
export const validateRequired = (value: string, fieldName: string, minLength: number = 1): string | null => {
  if (!value || value.trim().length < minLength) {
    return `${fieldName} обязателен для заполнения${minLength > 1 ? ` (минимум ${minLength} символа)` : ''}`;
  }
  return null;
};

/**
 * Validate password
 */
export const validatePassword = (password: string, minLength: number = 6): string | null => {
  if (!password || password.length < minLength) {
    return `Пароль должен содержать минимум ${minLength} символов`;
  }
  return null;
};

/**
 * Validate password confirmation
 */
export const validatePasswordConfirmation = (password: string, confirmPassword: string): string | null => {
  if (password !== confirmPassword) {
    return 'Пароли не совпадают';
  }
  return null;
};

/**
 * Validate number field
 */
export const validateNumber = (value: string, fieldName: string, min?: number, max?: number, required: boolean = false): string | null => {
  if (!value || value.trim() === '') {
    if (required) {
      return `${fieldName} обязателен для заполнения`;
    }
    return null;
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return `${fieldName} должен быть числом`;
  }
  if (min !== undefined && num < min) {
    return `${fieldName} должен быть не менее ${min}`;
  }
  if (max !== undefined && num > max) {
    return `${fieldName} должен быть не более ${max}`;
  }
  return null;
};

/**
 * Validate date field
 */
export const validateDate = (value: string, fieldName: string, required: boolean = false): string | null => {
  if (!value || value.trim() === '') {
    if (required) {
      return `${fieldName} обязателен для заполнения`;
    }
    return null;
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return `Введите корректную дату для ${fieldName}`;
  }
  return null;
};

/**
 * Validate client form
 */
export const validateClientForm = (formData: any): Record<string, string> => {
  const errors: Record<string, string> = {};

  const firstNameError = validateRequired(formData.firstName, 'Имя', 2);
  if (firstNameError) errors.firstName = firstNameError;

  const lastNameError = validateRequired(formData.lastName, 'Фамилия', 2);
  if (lastNameError) errors.lastName = lastNameError;

  if (formData.email) {
    const emailError = validateEmail(formData.email);
    if (emailError) errors.email = emailError;
  }

  if (formData.phone) {
    const phoneError = validatePhone(formData.phone);
    if (phoneError) errors.phone = phoneError;
  }

  if (formData.dateOfBirth) {
    const dateError = validateDate(formData.dateOfBirth, 'Дата рождения');
    if (dateError) errors.dateOfBirth = dateError;
  }

  if (formData.emergencyPhone) {
    const emergencyPhoneError = validatePhone(formData.emergencyPhone);
    if (emergencyPhoneError) errors.emergencyPhone = emergencyPhoneError;
  }

  return errors;
};

/**
 * Validate trainer form
 */
export const validateTrainerForm = (formData: any): Record<string, string> => {
  const errors: Record<string, string> = {};

  const firstNameError = validateRequired(formData.firstName, 'Имя', 2);
  if (firstNameError) errors.firstName = firstNameError;

  const lastNameError = validateRequired(formData.lastName, 'Фамилия', 2);
  if (lastNameError) errors.lastName = lastNameError;

  const emailError = validateEmail(formData.email);
  if (emailError) errors.email = emailError;

  if (formData.phone) {
    const phoneError = validatePhone(formData.phone);
    if (phoneError) errors.phone = phoneError;
  }

  if (formData.password && formData.password.length > 0) {
    const passwordError = validatePassword(formData.password, 6);
    if (passwordError) errors.password = passwordError;
  }

  return errors;
};

/**
 * Validate branch form
 */
export const validateBranchForm = (formData: any): Record<string, string> => {
  const errors: Record<string, string> = {};

  const nameError = validateRequired(formData.name, 'Название филиала', 2);
  if (nameError) errors.name = nameError;

  const addressError = validateRequired(formData.address, 'Адрес', 5);
  if (addressError) errors.address = addressError;

  if (formData.email) {
    const emailError = validateEmail(formData.email);
    if (emailError) errors.email = emailError;
  }

  if (formData.phone) {
    const phoneError = validatePhone(formData.phone);
    if (phoneError) errors.phone = phoneError;
  }

  return errors;
};

/**
 * Validate group form
 */
export const validateGroupForm = (formData: any): Record<string, string> => {
  const errors: Record<string, string> = {};

  const nameError = validateRequired(formData.name, 'Название группы', 2);
  if (nameError) errors.name = nameError;

  if (!formData.branchId) {
    errors.branchId = 'Выберите филиал';
  }

  if (!formData.trainerId) {
    errors.trainerId = 'Выберите тренера';
  }

  if (formData.maxMembers) {
    const maxMembersError = validateNumber(formData.maxMembers, 'Максимальное количество участников', 1);
    if (maxMembersError) errors.maxMembers = maxMembersError;
  }

  if (formData.ageMin && formData.ageMax) {
    const ageMin = parseInt(formData.ageMin);
    const ageMax = parseInt(formData.ageMax);
    if (!isNaN(ageMin) && !isNaN(ageMax) && ageMin > ageMax) {
      errors.ageMax = 'Максимальный возраст должен быть больше минимального';
    }
  }

  return errors;
};

/**
 * Validate payment form
 */
export const validatePaymentForm = (formData: any): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!formData.clientId) {
    errors.clientId = 'Выберите клиента';
  }

  if (!formData.branchId) {
    errors.branchId = 'Выберите филиал';
  }

  const amountError = validateNumber(formData.amount, 'Сумма', 0.01, undefined, true);
  if (amountError) errors.amount = amountError;

  if (!formData.type) {
    errors.type = 'Выберите тип платежа';
  }

  if (!formData.status) {
    errors.status = 'Выберите статус платежа';
  }

  return errors;
};

/**
 * Validate training form
 */
export const validateTrainingForm = (formData: any): Record<string, string> => {
  const errors: Record<string, string> = {};

  const titleError = validateRequired(formData.title, 'Название тренировки', 2);
  if (titleError) errors.title = titleError;

  if (!formData.groupId) {
    errors.groupId = 'Выберите группу';
  }

  if (!formData.trainerId) {
    errors.trainerId = 'Выберите тренера';
  }

  if (!formData.branchId) {
    errors.branchId = 'Выберите филиал';
  }

  if (!formData.startTime) {
    errors.startTime = 'Укажите время начала';
  }

  if (!formData.endTime) {
    errors.endTime = 'Укажите время окончания';
  }

  if (formData.startTime && formData.endTime) {
    const start = new Date(formData.startTime);
    const end = new Date(formData.endTime);
    if (start >= end) {
      errors.endTime = 'Время окончания должно быть позже времени начала';
    }
  }

  return errors;
};

