import { useState, useEffect } from 'react'
import { useAuth, SignIn, SignedIn, SignedOut } from '@clerk/clerk-react'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import LandingPage from './pages/LandingPage'
import DocsPage from './components/DocsPage'
import { setTokenGetter } from './utils/api'

const isCloud = import.meta.env.VITE_PARALLAX_MODE === 'cloud'

function TokenBridge() {
  const { getToken } = useAuth()
  useEffect(() => { setTokenGetter(() => getToken()) }, [getToken])
  return null
}

function AuthGateCloud({ children }) {
  const [showAuth, setShowAuth] = useState(false)

  return (
    <>
      <TokenBridge />
      <SignedOut>
        {showAuth ? (
          <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 32,
            background: 'var(--bg-primary, #0f0f1a)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-primary, #fff)', margin: 0, cursor: 'pointer' }}
                  onClick={() => setShowAuth(false)}>
                <span style={{ color: 'var(--accent, #6366f1)' }}>P</span>arallax
              </h1>
              <p style={{ color: 'var(--text-muted, #888)', marginTop: 8, fontSize: 15 }}>
                Sign in to create and manage presentations
              </p>
            </div>
            <SignIn routing="hash" appearance={{
              variables: { colorPrimary: '#6366f1', colorBackground: '#2a2a3e', colorText: '#f0f0f0', colorInputBackground: '#3a3a52', colorInputText: '#f0f0f0' },
              elements: { socialButtonsBlockButton: { backgroundColor: '#ffffff', color: '#1a1a2e', borderColor: '#e0e0e0' } },
            }} />
            <button onClick={() => setShowAuth(false)}
              style={{ color: 'var(--text-muted)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
              &larr; Back to home
            </button>
          </div>
        ) : (
          <LandingPage onSignIn={() => setShowAuth(true)} />
        )}
      </SignedOut>
      <SignedIn>{children}</SignedIn>
    </>
  )
}

function AuthGateSelfHosted({ children }) {
  return children
}

const AuthGate = isCloud ? AuthGateCloud : AuthGateSelfHosted

function DocsOverlay({ onClose, initialPage }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(30,30,50,0.95)', backdropFilter: 'blur(12px)' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}><span style={{ color: 'var(--accent)' }}>P</span>arallax Docs</div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Back to app</button>
      </nav>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DocsPage initialPage={initialPage} />
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('home')
  const [presentationId, setPresentationId] = useState(null)
  const [isTemplate, setIsTemplate] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('editor-theme') || 'dark')
  const [docsOverlay, setDocsOverlay] = useState(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
    localStorage.setItem('editor-theme', theme)
  }, [theme])

  useEffect(() => {
    const check = () => {
      const hash = window.location.hash
      if (hash.startsWith('#docs')) {
        const p = hash.replace('#docs/', '').replace('#docs', '')
        setDocsOverlay(p && p.includes('/') ? p : 'guide/getting-started')
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])

  const closeDocs = () => { setDocsOverlay(null); window.location.hash = '' }

  const openEditor = (id, template = false) => { setPresentationId(id); setIsTemplate(template); setPage('editor') }
  const goHome = () => { setPage('home'); setPresentationId(null); setIsTemplate(false) }

  return (
    <AuthGate>
      {page === 'home'
        ? <HomePage onOpen={openEditor} theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
        : <EditorPage presentationId={presentationId} isTemplate={isTemplate} onGoHome={goHome} />
      }
      {docsOverlay && <DocsOverlay onClose={closeDocs} initialPage={docsOverlay} />}
    </AuthGate>
  )
}
