/**
 * Real-time client form validation
 */

export interface ClientFormData {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  birthCertificateNumber: string;
  birthCertificate: string; // Фото/документ свидетельства о рождении (base64)
  medicalCertificateNumber: string;
  medicalCertificate: string; // Фото/документ справки (base64)
  schoolOrKindergarten: string;
  photo: string;
  weight: string;
  categoryId: string;
  groupIds: string[];
  parents: Array<{
    fullName: string;
    phone: string;
    email: string;
    workplace: string;
    workplaceContact: string;
  }>;
}

export interface ValidationErrors {
  [key: string]: string;
}

/**
 * Validate single field
 */
export const validateField = (
  fieldName: string,
  value: any,
  formData?: ClientFormData,
  parentIndex?: number
): string | null => {
  switch (fieldName) {
    case 'firstName':
      if (!value || value.trim().length < 2) {
        return 'Имя должно содержать минимум 2 символа';
      }
      return null;

    case 'lastName':
      if (!value || value.trim().length < 2) {
        return 'Фамилия должна содержать минимум 2 символа';
      }
      return null;

    case 'email':
      if (value && value.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) {
          return 'Введите корректный адрес электронной почты';
        }
      }
      return null;

    case 'phone':
      if (value && value.trim() !== '') {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        const cleanedPhone = value.replace(/\s/g, '');
        if (!phoneRegex.test(cleanedPhone)) {
          return 'Введите корректный номер телефона (например: +79991234567)';
        }
      }
      return null;

    case 'dateOfBirth':
      if (value) {
        const date = new Date(value);
        const today = new Date();
        if (date > today) {
          return 'Дата рождения не может быть в будущем';
        }
      }
      return null;

    case 'weight':
      if (value && value.trim() !== '') {
        const weight = parseFloat(value);
        if (isNaN(weight) || weight < 0 || weight > 500) {
          return 'Вес должен быть числом от 0 до 500 кг';
        }
      }
      return null;

    case 'parent_fullName':
      if (value && value.trim() !== '') {
        if (value.trim().length < 2) {
          return `ФИО родителя ${(parentIndex ?? 0) + 1} должно содержать минимум 2 символа`;
        }
      }
      return null;

    case 'parent_email':
      if (value && value.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) {
          return `Email родителя ${(parentIndex ?? 0) + 1} имеет неверный формат`;
        }
      }
      return null;

    case 'parent_phone':
      if (value && value.trim() !== '') {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        const cleanedPhone = value.replace(/\s/g, '');
        if (!phoneRegex.test(cleanedPhone)) {
          return `Телефон родителя ${(parentIndex ?? 0) + 1}: Введите корректный номер телефона`;
        }
      }
      return null;

    default:
      return null;
  }
};

/**
 * Validate entire form
 */
export const validateClientForm = (formData: ClientFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Validate required fields
  const firstNameError = validateField('firstName', formData.firstName);
  if (firstNameError) errors.firstName = firstNameError;

  const lastNameError = validateField('lastName', formData.lastName);
  if (lastNameError) errors.lastName = lastNameError;

  // Validate optional fields
  const emailError = validateField('email', formData.email);
  if (emailError) errors.email = emailError;

  const phoneError = validateField('phone', formData.phone);
  if (phoneError) errors.phone = phoneError;

  const dateOfBirthError = validateField('dateOfBirth', formData.dateOfBirth);
  if (dateOfBirthError) errors.dateOfBirth = dateOfBirthError;

  const weightError = validateField('weight', formData.weight);
  if (weightError) errors.weight = weightError;

  // Validate parents
  if (formData.parents && Array.isArray(formData.parents)) {
    formData.parents.forEach((parent, index) => {
      if (parent.fullName && parent.fullName.trim() !== '') {
        const fullNameError = validateField('parent_fullName', parent.fullName, formData, index);
        if (fullNameError) {
          errors[`parent_${index}_fullName`] = fullNameError;
        }
      }

      if (parent.email && parent.email.trim() !== '') {
        const emailError = validateField('parent_email', parent.email, formData, index);
        if (emailError) {
          errors[`parent_${index}_email`] = emailError;
        }
      }

      if (parent.phone && parent.phone.trim() !== '') {
        const phoneError = validateField('parent_phone', parent.phone, formData, index);
        if (phoneError) {
          errors[`parent_${index}_phone`] = phoneError;
        }
      }
    });
  }

  return errors;
};

/**
 * Check if form has any errors
 */
export const hasFormErrors = (errors: ValidationErrors): boolean => {
  return Object.keys(errors).length > 0;
};

