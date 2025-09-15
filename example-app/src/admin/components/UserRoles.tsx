import React, { useState } from 'react';

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
}

export const UserRoles: React.FC = () => {
  const [roles] = useState<Role[]>([
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access',
      permissions: ['read', 'write', 'delete', 'manage_users', 'system_config'],
      userCount: 2
    },
    {
      id: 'manager',
      name: 'Manager',
      description: 'Limited administrative access',
      permissions: ['read', 'write', 'manage_users'],
      userCount: 5
    },
    {
      id: 'user',
      name: 'User',
      description: 'Basic user access',
      permissions: ['read'],
      userCount: 150
    }
  ]);

  const [permissions] = useState<Permission[]>([
    { id: 'read', name: 'Read', description: 'View content and data' },
    { id: 'write', name: 'Write', description: 'Create and edit content' },
    { id: 'delete', name: 'Delete', description: 'Remove content and data' },
    { id: 'manage_users', name: 'Manage Users', description: 'Add, edit, and remove users' },
    { id: 'system_config', name: 'System Configuration', description: 'Modify system settings' }
  ]);

  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId === selectedRole ? null : roleId);
  };

  return (
    <div className="admin-panel user-roles">
      <div className="panel-header">
        <h1>{t('admin.roles.title')}</h1>
        <p>{t('admin.roles.description')}</p>
        <button className="btn-primary">
          {t('admin.roles.createRole')}
        </button>
      </div>

      <div className="roles-grid">
        {roles.map(role => (
          <div 
            key={role.id} 
            className={`role-card ${selectedRole === role.id ? 'selected' : ''}`}
            onClick={() => handleRoleSelect(role.id)}
          >
            <div className="role-header">
              <h3>{role.name}</h3>
              <span className="user-count">
                {t('admin.roles.userCount', { count: role.userCount })}
              </span>
            </div>
            
            <p className="role-description">{role.description}</p>
            
            <div className="permissions-list">
              <h4>{t('admin.roles.permissions')}</h4>
              <ul>
                {role.permissions.map(permId => {
                  const perm = permissions.find(p => p.id === permId);
                  return (
                    <li key={permId} className="permission-item">
                      <span className="permission-name">
                        {t(`admin.roles.permissionNames.${permId}`, perm?.name)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            <div className="role-actions">
              <button className="btn-small">
                {t('admin.roles.actions.edit')}
              </button>
              <button className="btn-small btn-danger">
                {t('admin.roles.actions.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedRole && (
        <div className="role-details">
          <h2>{t('admin.roles.roleDetails')}</h2>
          <div className="permissions-matrix">
            <h3>{t('admin.roles.permissionsMatrix')}</h3>
            <table>
              <thead>
                <tr>
                  <th>{t('admin.roles.permission')}</th>
                  <th>{t('admin.roles.description')}</th>
                  <th>{t('admin.roles.granted')}</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map(permission => {
                  const selectedRoleData = roles.find(r => r.id === selectedRole);
                  const hasPermission = selectedRoleData?.permissions.includes(permission.id);
                  
                  return (
                    <tr key={permission.id}>
                      <td>{t(`admin.roles.permissionNames.${permission.id}`, permission.name)}</td>
                      <td>{t(`admin.roles.permissionDescs.${permission.id}`, permission.description)}</td>
                      <td>
                        <span className={`permission-status ${hasPermission ? 'granted' : 'denied'}`}>
                          {hasPermission ? t('admin.roles.granted') : t('admin.roles.denied')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

