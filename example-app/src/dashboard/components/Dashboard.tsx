import React, { useState, useEffect } from 'react';

interface DashboardStats {
  totalUsers: number;
  revenue: number;
  orders: number;
  growth: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setStats({
        totalUsers: 12543,
        revenue: 45678.90,
        orders: 234,
        growth: 12.5
      });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return <div className="loading">{t('dashboard.loading')}</div>;
  }

  return (
    <div className="dashboard">
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.welcomeMessage')}</p>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>{t('dashboard.stats.totalUsers')}</h3>
          <p className="stat-value">{stats?.totalUsers.toLocaleString()}</p>
        </div>
        
        <div className="stat-card">
          <h3>{t('dashboard.stats.revenue')}</h3>
          <p className="stat-value">${stats?.revenue.toLocaleString()}</p>
        </div>
        
        <div className="stat-card">
          <h3>{t('dashboard.stats.orders')}</h3>
          <p className="stat-value">{stats?.orders}</p>
        </div>
        
        <div className="stat-card">
          <h3>{t('dashboard.stats.growth')}</h3>
          <p className="stat-value positive">+{stats?.growth}%</p>
        </div>
      </div>
      
      <div className="dashboard-actions">
        <button className="btn-primary">{t('dashboard.actions.viewReports')}</button>
        <button className="btn-secondary">{t('dashboard.actions.exportData')}</button>
        <button className="btn-secondary">{t('dashboard.actions.manageUsers')}</button>
      </div>
    </div>
  );
};

