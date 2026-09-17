import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

/** Bottom sheet with Escape-to-close and background-tap dismiss. */
export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="m-sheet-backdrop"
      role="dialog"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="m-sheet">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <strong>{title}</strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              minWidth: 44,
              minHeight: 44,
              background: 'none',
              border: 0,
            }}
          >
            <X aria-hidden style={{ width: 22, height: 22 }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
