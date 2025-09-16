import type React from "react"

interface ButtonProps {
  onClick: () => void
  variant?: "primary" | "secondary"
  children: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  onClick,
  variant = "primary",
  children,
}) => {
  return (
    <button
      onClick={onClick}
      className={`btn btn-${variant}`}
      aria-label={t("clickToAction")}
    >
      {children}
    </button>
  )
}

export const LoadingButton: React.FC<ButtonProps & { loading?: boolean }> = ({
  loading,
  children,
  ...props
}) => {
  return <Button {...props}>{loading ? t("loading") : children}</Button>
}
