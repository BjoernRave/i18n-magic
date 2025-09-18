import type React from "react"

interface HomeScreenProps {
  user: {
    name: string
    notifications: number
  }
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ user }) => {
  const handleQuickAction = (action: string) => {
    console.log(`Mobile quick action: ${action}`)
  }

  return (
    <div className="mobile-screen home-screen">
      <header className="mobile-header">
        <h1>{t("greeting", { name: user.name })}</h1>
        <div className="notification-badge">
          <span>{user.notifications}</span>
          <span className="sr-only">
            {t("notificationsCount", { count: user.notifications })}
          </span>
        </div>
      </header>

      <section className="quick-actions">
        <h2>{t("quickActions")}</h2>
        <div className="action-grid">
          <button
            className="action-button"
            onClick={() => handleQuickAction("scan")}
          >
            <span className="icon">📷</span>
            <span>{t("scanQR")}</span>
          </button>

          <button
            className="action-button"
            onClick={() => handleQuickAction("pay")}
          >
            <span className="icon">💳</span>
            <span>{t("quickPay")}</span>
          </button>

          <button
            className="action-button"
            onClick={() => handleQuickAction("transfer")}
          >
            <span className="icon">💸</span>
            <span>{t("transfer")}</span>
          </button>

          <button
            className="action-button"
            onClick={() => handleQuickAction("history")}
          >
            <span className="icon">📊</span>
            <span>{t("viewHistory")}</span>
          </button>
        </div>
      </section>

      <section className="recent-activity">
        <h2>{t("recentActivity")}</h2>
        <p className="empty-state">{t("noRecentActivity")}</p>
      </section>

      <section className="mobile-tips">
        <h2>{t("tipsTitle")}</h2>
        <div className="tip-card">
          <p>{{t.rich("acceptTerms", {
                terms: (chunks) => (
                  <a
                    className="text-blue-500 underline"
                    href={`https://scoutello.com/${user.language}/terms-of-service`}
                    target="_blank" rel="noreferrer"
                  >
                    {chunks}
                  </a>
                ),
              })}</p>
          <button className="tip-action">{t("learnMore")}</button>
        </div>
      </section>
    </div>
  )
}
