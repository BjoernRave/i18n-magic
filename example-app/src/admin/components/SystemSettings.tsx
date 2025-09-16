import type React from "react"
import { useState } from "react"

interface SystemConfig {
  maintenanceMode: boolean
  allowRegistration: boolean
  maxUploadSize: number
  sessionTimeout: number
  debugMode: boolean
}

export const SystemSettings: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>({
    maintenanceMode: false,
    allowRegistration: true,
    maxUploadSize: 10,
    sessionTimeout: 30,
    debugMode: false,
  })

  const [saving, setSaving] = useState(false)

  const handleConfigChange = (key: keyof SystemConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setSaving(false)
    alert(t("admin.settings.saveSuccess"))
  }

  return (
    <div className="admin-panel system-settings">
      <div className="panel-header">
        <h1>{t("settingsTitle")}</h1>
        <p>{t("settingsDescription")}</p>
      </div>

      <div className="settings-sections">
        <section className="settings-section">
          <h2>{t("admin.settings.general.title")}</h2>

          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={config.maintenanceMode}
                onChange={(e) =>
                  handleConfigChange("maintenanceMode", e.target.checked)
                }
              />
              <span>{t("admin.settings.general.maintenanceMode")}</span>
            </label>
            <p className="setting-description">
              {t("admin.settings.general.maintenanceModeDesc")}
            </p>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={config.allowRegistration}
                onChange={(e) =>
                  handleConfigChange("allowRegistration", e.target.checked)
                }
              />
              <span>{t("admin.settings.general.allowRegistration")}</span>
            </label>
            <p className="setting-description">
              {t("admin.settings.general.allowRegistrationDesc")}
            </p>
          </div>
        </section>

        <section className="settings-section">
          <h2>{t("admin.settings.security.title")}</h2>

          <div className="setting-item">
            <label className="setting-label">
              {t("admin.settings.security.sessionTimeout")}
              <input
                type="number"
                value={config.sessionTimeout}
                onChange={(e) =>
                  handleConfigChange(
                    "sessionTimeout",
                    Number.parseInt(e.target.value),
                  )
                }
                min="5"
                max="120"
              />
              <span className="unit">
                {t("admin.settings.security.minutes")}
              </span>
            </label>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              {t("admin.settings.security.maxUploadSize")}
              <input
                type="number"
                value={config.maxUploadSize}
                onChange={(e) =>
                  handleConfigChange(
                    "maxUploadSize",
                    Number.parseInt(e.target.value),
                  )
                }
                min="1"
                max="100"
              />
              <span className="unit">
                {t("admin.settings.security.megabytes")}
              </span>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2>{t("admin.settings.developer.title")}</h2>

          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={config.debugMode}
                onChange={(e) =>
                  handleConfigChange("debugMode", e.target.checked)
                }
              />
              <span>{t("admin.settings.developer.debugMode")}</span>
            </label>
            <p className="setting-description warning">
              {t("admin.settings.developer.debugModeWarning")}
            </p>
          </div>
        </section>
      </div>

      <div className="settings-actions">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving
            ? t("admin.settings.saving")
            : t("admin.settings.saveChanges")}
        </button>

        <button className="btn-secondary">
          {t("admin.settings.resetToDefaults")}
        </button>
      </div>
    </div>
  )
}
