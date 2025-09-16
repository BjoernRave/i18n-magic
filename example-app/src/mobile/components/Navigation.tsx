import type React from "react"

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export const MobileNavigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    { id: "home", icon: "🏠", label: t("home") },
    { id: "wallet", icon: "💰", label: t("wallet") },
    { id: "scan", icon: "📷", label: t("scan") },
    { id: "profile", icon: "👤", label: t("profile") },
    { id: "settings", icon: "⚙️", label: t("settings") },
  ]

  return (
    <nav
      className="mobile-navigation"
      role="navigation"
      aria-label={t("navigationAriaLabel")}
    >
      <div className="nav-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
            aria-label={t("tabAriaLabel", { tab: tab.label })}
          >
            <span className="nav-icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="nav-indicator" />
    </nav>
  )
}

export const MobileHeader: React.FC<{
  title: string
  showBack?: boolean
  onBack?: () => void
}> = ({ title, showBack = false, onBack }) => {
  return (
    <header className="mobile-header">
      {showBack && (
        <button
          className="back-button"
          onClick={onBack}
          aria-label={t("goBack")}
        >
          ← {t("back")}
        </button>
      )}
      <h1 className="header-title">{title}</h1>
    </header>
  )
}
