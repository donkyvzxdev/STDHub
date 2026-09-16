import { useState } from 'react'

const TABS = ['Study', 'Chat', 'Calc'] as const

type Tab = (typeof TABS)[number]

/**
 * Placeholder home. The real student-focused screens land with the mobile
 * spec (spec-mobile.md): this file only proves the shell boots on device.
 */
function App() {
  const [tab, setTab] = useState<Tab>('Study')
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        background: '#09090b',
        color: '#fafafa',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <main style={{ flex: 1, padding: 20 }}>
        <h1 style={{ fontSize: 22, margin: '8px 0' }}>STDHub Mobile</h1>
        <p style={{ color: '#a1a1aa', fontSize: 14 }}>
          Student workspace prototype — {tab} arrives with the mobile spec.
        </p>
      </main>
      <nav
        style={{
          display: 'flex',
          borderTop: '1px solid #27272a',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
            style={{
              flex: 1,
              padding: '12px 0',
              background: tab === name ? '#27272a' : 'transparent',
              color: tab === name ? '#fafafa' : '#a1a1aa',
              border: 0,
              fontSize: 13,
            }}
          >
            {name}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
