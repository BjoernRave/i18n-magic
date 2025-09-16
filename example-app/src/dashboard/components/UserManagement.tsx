import type React from "react"
import { useState } from "react"

interface User {
  id: string
  name: string
  email: string
  role: string
  status: "active" | "inactive"
  lastLogin: string
}

export const UserManagement: React.FC = () => {
  const [users] = useState<User[]>([
    {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
      role: "admin",
      status: "active",
      lastLogin: "2024-01-15",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane@example.com",
      role: "user",
      status: "active",
      lastLogin: "2024-01-14",
    },
  ])

  const handleUserAction = (userId: string, action: string) => {
    console.log(`${action} user ${userId}`)
  }

  return (
    <div className="user-management">
      <div className="header">
        <h2>{t("userManagementTitle")}</h2>
        <button className="btn-primary">{t("addUser")}</button>
      </div>

      <div className="filters">
        <select>
          <option value="">{t("filterByRole")}</option>
          <option value="admin">{t("adminRole")}</option>
          <option value="user">{t("userRole")}</option>
        </select>

        <select>
          <option value="">{t("filterByStatus")}</option>
          <option value="active">{t("activeStatus")}</option>
          <option value="inactive">{t("inactiveStatus")}</option>
        </select>
      </div>

      <table className="users-table">
        <thead>
          <tr>
            <th>{t("tableName")}</th>
            <th>{t("tableEmail")}</th>
            <th>{t("tableRole")}</th>
            <th>{t("tableStatus")}</th>
            <th>{t("tableLastLogin")}</th>
            <th>{t("tableActions")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{t(`${user.role}Role`)}</td>
              <td>{t(`${user.status}Status`)}</td>
              <td>{user.lastLogin}</td>
              <td>
                <button onClick={() => handleUserAction(user.id, "edit")}>
                  {t("editAction")}
                </button>
                <button onClick={() => handleUserAction(user.id, "delete")}>
                  {t("deleteAction")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
