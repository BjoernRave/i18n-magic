import React, { useState } from 'react';

interface PasswordResetProps {
  onResetRequest: (email: string) => Promise<void>;
  onBack: () => void;
}

export const PasswordReset: React.FC<PasswordResetProps> = ({ 
  onResetRequest, 
  onBack 
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError(t('auth.passwordReset.errors.emailRequired'));
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError(t('auth.passwordReset.errors.emailInvalid'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onResetRequest(email);
      setSent(true);
    } catch (error) {
      setError(t('auth.passwordReset.errors.requestFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-form password-reset-sent">
        <div className="success-icon">✅</div>
        <h1>{t('auth.passwordReset.sent.title')}</h1>
        <p>{t('auth.passwordReset.sent.message', { email })}</p>
        
        <div className="form-actions">
          <button className="btn-secondary" onClick={onBack}>
            {t('auth.passwordReset.backToLogin')}
          </button>
          
          <button 
            className="btn-primary"
            onClick={() => {
              setSent(false);
              setEmail('');
            }}
          >
            {t('auth.passwordReset.sendAnother')}
          </button>
        </div>

        <div className="help-text">
          <p>{t('auth.passwordReset.sent.checkSpam')}</p>
          <p>{t('auth.passwordReset.sent.noEmail')}{' '}
            <button className="link-button" onClick={() => setSent(false)}>
              {t('auth.passwordReset.sent.tryAgain')}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-form password-reset">
      <div className="form-header">
        <button className="back-button" onClick={onBack} disabled={loading}>
          ← {t('auth.passwordReset.back')}
        </button>
        <h1>{t('auth.passwordReset.title')}</h1>
        <p>{t('auth.passwordReset.subtitle')}</p>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="reset-email">
            {t('auth.passwordReset.fields.email')}
          </label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            placeholder={t('auth.passwordReset.placeholders.email')}
            className={error ? 'error' : ''}
            disabled={loading}
            autoComplete="email"
            autoFocus
          />
        </div>

        <button 
          type="submit" 
          className="btn-primary btn-full"
          disabled={loading || !email}
        >
          {loading ? t('auth.passwordReset.sending') : t('auth.passwordReset.sendReset')}
        </button>
      </form>

      <div className="form-footer">
        <div className="help-section">
          <h3>{t('auth.passwordReset.help.title')}</h3>
          <ul>
            <li>{t('auth.passwordReset.help.checkEmail')}</li>
            <li>{t('auth.passwordReset.help.validAccount')}</li>
            <li>{t('auth.passwordReset.help.temporaryLink')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

