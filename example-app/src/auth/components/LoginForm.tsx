import React, { useState } from 'react';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onForgotPassword: () => void;
  loading?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ 
  onLogin, 
  onForgotPassword, 
  loading = false 
}) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = t('auth.login.errors.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('auth.login.errors.emailInvalid');
    }

    if (!formData.password) {
      newErrors.password = t('auth.login.errors.passwordRequired');
    } else if (formData.password.length < 6) {
      newErrors.password = t('auth.login.errors.passwordTooShort');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onLogin(formData.email, formData.password);
    } catch (error) {
      setErrors({ 
        general: t('auth.login.errors.loginFailed') 
      });
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="auth-form login-form">
      <div className="form-header">
        <h1>{t('auth.login.title')}</h1>
        <p>{t('auth.login.subtitle')}</p>
      </div>

      {errors.general && (
        <div className="error-banner">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="email">
            {t('auth.login.fields.email')}
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder={t('auth.login.placeholders.email')}
            className={errors.email ? 'error' : ''}
            disabled={loading}
            autoComplete="email"
          />
          {errors.email && (
            <span className="error-message">{errors.email}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password">
            {t('auth.login.fields.password')}
          </label>
          <input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder={t('auth.login.placeholders.password')}
            className={errors.password ? 'error' : ''}
            disabled={loading}
            autoComplete="current-password"
          />
          {errors.password && (
            <span className="error-message">{errors.password}</span>
          )}
        </div>

        <div className="form-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.rememberMe}
              onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
              disabled={loading}
            />
            <span>{t('auth.login.rememberMe')}</span>
          </label>

          <button 
            type="button" 
            className="link-button"
            onClick={onForgotPassword}
            disabled={loading}
          >
            {t('auth.login.forgotPassword')}
          </button>
        </div>

        <button 
          type="submit" 
          className="btn-primary btn-full"
          disabled={loading}
        >
          {loading ? t('auth.login.signingIn') : t('auth.login.signIn')}
        </button>
      </form>

      <div className="form-footer">
        <p>
          {t('auth.login.noAccount')}{' '}
          <a href="/register" className="link">
            {t('auth.login.signUpLink')}
          </a>
        </p>
      </div>
    </div>
  );
};

