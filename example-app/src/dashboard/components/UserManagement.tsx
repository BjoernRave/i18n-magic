import React, { useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  lastLogin: string;
}

export const UserManagement: React.FC = () => {
  const [users] = useState<User[]>([
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
      status: 'active',
      lastLogin: '2024-01-15'
    },
    {
      id: '2', 
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'user',
      status: 'active',
      lastLogin: '2024-01-14'
    }
  ]);

  const handleUserAction = (userId: string, action: string) => {
    console.log(`${action} user ${userId}`);
  };

  return (
    <div className="user-management">
      <div className="header">
        <h2>{t('dashboard.userManagement.title')}</h2>
        <button className="btn-primary">
          {t('dashboard.userManagement.addUser')}
        </button>
      </div>
      
      <div className="filters">
        <select>
          <option value="">{t('dashboard.userManagement.filterByRole')}</option>
          <option value="admin">{t('dashboard.userManagement.roles.admin')}</option>
          <option value="user">{t('dashboard.userManagement.roles.user')}</option>
        </select>
        
        <select>
          <option value="">{t('dashboard.userManagement.filterByStatus')}</option>
          <option value="active">{t('dashboard.userManagement.status.active')}</option>
          <option value="inactive">{t('dashboard.userManagement.status.inactive')}</option>
        </select>
      </div>

      <table className="users-table">
        <thead>
          <tr>
            <th>{t('dashboard.userManagement.table.name')}</th>
            <th>{t('dashboard.userManagement.table.email')}</th>
            <th>{t('dashboard.userManagement.table.role')}</th>
            <th>{t('dashboard.userManagement.table.status')}</th>
            <th>{t('dashboard.userManagement.table.lastLogin')}</th>
            <th>{t('dashboard.userManagement.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{t(`dashboard.userManagement.roles.${user.role}`)}</td>
              <td>{t(`dashboard.userManagement.status.${user.status}`)}</td>
              <td>{user.lastLogin}</td>
              <td>
                <button onClick={() => handleUserAction(user.id, 'edit')}>
                  {t('dashboard.userManagement.actions.edit')}
                </button>
                <button onClick={() => handleUserAction(user.id, 'delete')}>
                  {t('dashboard.userManagement.actions.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

