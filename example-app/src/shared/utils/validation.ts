export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return { valid: false, message: t('validation.passwordTooShort') };
  }
  
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return { valid: false, message: t('validation.passwordComplexity') };
  }
  
  return { valid: true };
};

export const validateRequired = (value: string, fieldName: string): { valid: boolean; message?: string } => {
  if (!value || value.trim().length === 0) {
    return { valid: false, message: t('validation.fieldRequired', { field: fieldName }) };
  }
  
  return { valid: true };
};

export const formatValidationErrors = (errors: string[]): string => {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0];
  
  return t('validation.multipleErrors', { count: errors.length, errors: errors.join(', ') });
};

