import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean
}

export function Btn({ primary, style, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`m-btn${primary ? ' m-btn-primary' : ''}`}
      style={style}
    />
  )
}

export function Card({
  children,
  onClick,
  label,
}: {
  children: ReactNode
  onClick?: () => void
  label?: string
}) {
  if (!onClick) return <div className="m-card">{children}</div>
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="m-card"
      style={{ width: '100%', textAlign: 'left' }}
    >
      {children}
    </button>
  )
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <p style={{ fontWeight: 700, fontSize: 17, margin: '0 0 6px' }}>{title}</p>
      {text ? (
        <p className="m-muted" style={{ fontSize: 14, margin: '0 0 14px' }}>
          {text}
        </p>
      ) : null}
      {action}
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="m-field">
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      {children}
    </div>
  )
}
