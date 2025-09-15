import React from 'react';

interface HomeScreenProps {
  user: {
    name: string;
    notifications: number;
  };
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ user }) => {
  const handleQuickAction = (action: string) => {
    console.log(`Mobile quick action: ${action}`);
  };

  return (
    <div className="mobile-screen home-screen">
      <header className="mobile-header">
        <h1>{t('mobile.home.greeting', { name: user.name })}</h1>
        <div className="notification-badge">
          <span>{user.notifications}</span>
          <span className="sr-only">{t('mobile.home.notificationsCount', { count: user.notifications })}</span>
        </div>
      </header>

      <section className="quick-actions">
        <h2>{t('mobile.home.quickActions')}</h2>
        <div className="action-grid">
          <button 
            className="action-button"
            onClick={() => handleQuickAction('scan')}
          >
            <span className="icon">📷</span>
            <span>{t('mobile.home.actions.scanQR')}</span>
          </button>
          
          <button 
            className="action-button"
            onClick={() => handleQuickAction('pay')}
          >
            <span className="icon">💳</span>
            <span>{t('mobile.home.actions.quickPay')}</span>
          </button>
          
          <button 
            className="action-button"
            onClick={() => handleQuickAction('transfer')}
          >
            <span className="icon">💸</span>
            <span>{t('mobile.home.actions.transfer')}</span>
          </button>
          
          <button 
            className="action-button"
            onClick={() => handleQuickAction('history')}
          >
            <span className="icon">📊</span>
            <span>{t('mobile.home.actions.viewHistory')}</span>
          </button>
        </div>
      </section>

      <section className="recent-activity">
        <h2>{t('mobile.home.recentActivity')}</h2>
        <p className="empty-state">{t('mobile.home.noRecentActivity')}</p>
      </section>

      <section className="mobile-tips">
        <h2>{t('mobile.home.tips.title')}</h2>
        <div className="tip-card">
          <p>{t('mobile.home.tips.enableBiometrics')}</p>
          <button className="tip-action">{t('mobile.home.tips.learnMore')}</button>
        </div>
      </section>
    </div>
  );
};

